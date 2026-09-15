"""
AgriSmart AI – Farmer Dashboard & Disease History API Endpoints
Accessible strictly by FARMER and ADMIN roles.
Provides farmer-specific telemetry, leaf diagnosis history, and crop holdings.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import User, DiseaseDiagnosisRecord, IrrigationLog, CropRecommendationRecord, CropItem
from backend.app.schemas.auth import ROLE_FARMER, ROLE_ADMIN
from backend.app.api.deps import require_role

router = APIRouter(prefix="/farmer", tags=["Farmer Operations & History"])


@router.get("/dashboard-stats", summary="Fetch summary metrics for Farmer Dashboard")
def get_farmer_dashboard_stats(
    current_user: User = Depends(require_role(ROLE_FARMER, ROLE_ADMIN)),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns authentic dashboard metrics for the logged-in farmer:
    - total scans
    - healthy scans
    - diseased scans
    - recent diagnoses list
    """
    diagnoses_query = db.query(DiseaseDiagnosisRecord).filter(
        DiseaseDiagnosisRecord.farmer_id == current_user.id
    )

    total_scans = diagnoses_query.count()
    healthy_plants = diagnoses_query.filter(DiseaseDiagnosisRecord.status == "Healthy").count()
    diseased_plants = diagnoses_query.filter(DiseaseDiagnosisRecord.status == "Diseased").count()

    recent_records = diagnoses_query.order_by(
        DiseaseDiagnosisRecord.created_at.desc()
    ).limit(5).all()

    recent_items = [
        {
            "id": r.id,
            "crop": r.crop,
            "disease": r.disease,
            "confidence": r.confidence_str or f"{int(round(r.confidence * 100))}%",
            "confidence_score": r.confidence,
            "status": r.status,
            "pathogen": r.pathogen,
            "symptoms": r.symptoms,
            "treatment": r.treatment,
            "image_filename": r.image_filename,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "Recently",
            "expert_reviewed": bool(r.expert_reviewed),
            "expert_status": r.expert_status or "PENDING",
            "expert_notes": r.expert_notes,
            "expert_treatment": r.expert_treatment,
        }
        for r in recent_records
    ]

    return {
        "status": "success",
        "farmer_name": current_user.full_name,
        "farm_name": current_user.farm_name or "Family Farm",
        "farm_location": current_user.farm_location or "Punjab, India",
        "preferred_crop": current_user.preferred_crop or "Wheat",
        "total_scans": total_scans,
        "healthy_plants": healthy_plants,
        "diseased_plants": diseased_plants,
        "recent_diagnoses": recent_items,
    }


@router.get("/diagnoses", summary="List historical disease scans for authenticated farmer")
def get_farmer_diagnoses(
    crop: Optional[str] = Query(None, description="Filter by crop name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Healthy/Diseased)"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role(ROLE_FARMER, ROLE_ADMIN)),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns filterable disease diagnosis history for the authenticated farmer.
    """
    query = db.query(DiseaseDiagnosisRecord).filter(
        DiseaseDiagnosisRecord.farmer_id == current_user.id
    )

    if crop and crop.strip():
        query = query.filter(DiseaseDiagnosisRecord.crop.ilike(f"%{crop.strip()}%"))

    if status_filter and status_filter.strip():
        query = query.filter(DiseaseDiagnosisRecord.status.ilike(f"%{status_filter.strip()}%"))

    records = query.order_by(DiseaseDiagnosisRecord.created_at.desc()).limit(limit).all()

    items = [
        {
            "id": r.id,
            "crop": r.crop,
            "disease": r.disease,
            "confidence": r.confidence_str or f"{int(round(r.confidence * 100))}%",
            "confidence_score": r.confidence,
            "status": r.status,
            "pathogen": r.pathogen or "N/A",
            "symptoms": r.symptoms,
            "treatment": r.treatment,
            "image_filename": r.image_filename,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M UTC") if r.created_at else "Recently",
            "expert_reviewed": bool(r.expert_reviewed),
            "expert_status": r.expert_status or "PENDING",
            "expert_notes": r.expert_notes,
            "expert_treatment": r.expert_treatment,
        }
        for r in records
    ]

    return {
        "status": "success",
        "total": len(items),
        "diagnoses": items,
    }


@router.get("/diagnoses/{diagnosis_id}", summary="Get detailed diagnosis by ID")
def get_diagnosis_detail(
    diagnosis_id: int,
    current_user: User = Depends(require_role(ROLE_FARMER, ROLE_ADMIN)),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns single diagnosis detail for the authenticated farmer.
    """
    record = db.query(DiseaseDiagnosisRecord).filter(
        DiseaseDiagnosisRecord.id == diagnosis_id,
        DiseaseDiagnosisRecord.farmer_id == current_user.id
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnosis record {diagnosis_id} not found."
        )

    return {
        "status": "success",
        "diagnosis": {
            "id": record.id,
            "crop": record.crop,
            "disease": record.disease,
            "confidence": record.confidence_str or f"{int(round(record.confidence * 100))}%",
            "confidence_score": record.confidence,
            "status": record.status,
            "pathogen": record.pathogen or "N/A",
            "symptoms": record.symptoms,
            "treatment": record.treatment,
            "image_filename": record.image_filename,
            "created_at": record.created_at.strftime("%Y-%m-%d %H:%M UTC") if record.created_at else "Recently",
            "expert_reviewed": bool(record.expert_reviewed),
            "expert_status": record.expert_status or "PENDING",
            "expert_notes": record.expert_notes,
            "expert_treatment": record.expert_treatment,
        }
    }


@router.get("/crops", summary="Fetch farmer's registered crops and recommendations")
def get_farmer_crops(
    current_user: User = Depends(require_role(ROLE_FARMER, ROLE_ADMIN)),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns crops registered to this farmer, dynamically integrated with authentic
    disease surveillance scans, irrigation sensor telemetry, and crop catalog imagery.
    """
    # 1. Discover all authentic crop holdings for this farmer
    crop_names = []
    if current_user.preferred_crop and current_user.preferred_crop.strip():
        crop_names.append(current_user.preferred_crop.strip())

    if current_user.primary_crops:
        for raw_c in current_user.primary_crops.replace('&', ',').split(','):
            c_clean = raw_c.strip()
            if c_clean and c_clean not in crop_names:
                crop_names.append(c_clean)

    # Add crops monitored in disease diagnostics
    diag_crops = db.query(DiseaseDiagnosisRecord.crop).filter(
        DiseaseDiagnosisRecord.farmer_id == current_user.id
    ).distinct().all()
    for r in diag_crops:
        c_name = r[0].strip() if r[0] else ""
        if c_name and c_name != "Unsupported / Unknown" and c_name not in crop_names:
            crop_names.append(c_name)

    # Add crops with irrigation logs
    irr_crops = db.query(IrrigationLog.crop_name).filter(
        IrrigationLog.farmer_id == current_user.id
    ).distinct().all()
    for r in irr_crops:
        c_name = r[0].strip() if r[0] else ""
        if c_name and c_name not in crop_names:
            crop_names.append(c_name)

    latest_crop_rec = db.query(CropRecommendationRecord).filter(
        CropRecommendationRecord.farmer_id == current_user.id
    ).order_by(CropRecommendationRecord.created_at.desc()).first()

    user_crops = []
    for idx, name in enumerate(crop_names, 1):
        # Look up catalog metadata
        crop_item = db.query(CropItem).filter(CropItem.name.ilike(f"%{name}%")).first()

        # Look up latest disease scan for this farmer & crop
        last_diag = db.query(DiseaseDiagnosisRecord).filter(
            DiseaseDiagnosisRecord.farmer_id == current_user.id,
            DiseaseDiagnosisRecord.crop.ilike(f"%{name}%")
        ).order_by(DiseaseDiagnosisRecord.created_at.desc()).first()

        # Look up latest irrigation record for this farmer & crop
        latest_irr = db.query(IrrigationLog).filter(
            IrrigationLog.farmer_id == current_user.id,
            IrrigationLog.crop_name.ilike(f"%{name}%")
        ).order_by(IrrigationLog.created_at.desc()).first()

        # Determine authentic status badge based on genuine data
        status = "Status Unavailable"
        if last_diag:
            if last_diag.status == "Healthy":
                status = "Healthy"
            elif last_diag.status == "Diseased":
                status = "Disease Risk" if (last_diag.confidence and last_diag.confidence >= 0.85) else "Attention Needed"
            else:
                status = "Attention Needed"

        if latest_irr and latest_irr.status in ["Immediate", "Waterlogged"]:
            if status in ["Healthy", "Status Unavailable"]:
                status = "Attention Needed"

        # Acreage calculation: 1 ha = 2.47105 acres
        acreage = round(latest_irr.field_size_hectares * 2.47105, 1) if (latest_irr and latest_irr.field_size_hectares) else None
        field_size = f"{latest_irr.field_size_hectares:.1f} ha" if (latest_irr and latest_irr.field_size_hectares) else None

        user_crops.append({
            "id": idx,
            "name": name,
            "variety": crop_item.scientific_name if (crop_item and crop_item.scientific_name) else "Certified Hybrid",
            "scientific_name": crop_item.scientific_name if crop_item else None,
            "category": crop_item.category if crop_item else "Field Crop",
            "image_url": crop_item.image_url if crop_item else None,
            "acreage": acreage,
            "field_size": field_size,
            "sowing_date": None,  # Not tracked in database schema
            "irrigation_status": latest_irr.status if latest_irr else None,
            "irrigation_urgency": latest_irr.status if latest_irr else None,
            "soil_moisture": f"{latest_irr.moisture_15cm:.1f}%" if (latest_irr and latest_irr.moisture_15cm is not None) else None,
            "soil_moisture_num": latest_irr.moisture_15cm if latest_irr else None,
            "last_scanned": last_diag.created_at.strftime("%b %d, %Y") if (last_diag and last_diag.created_at) else None,
            "last_disease": last_diag.disease if last_diag else None,
            "status": status,
            "recommended_rotation": latest_crop_rec.top_crop_2 if latest_crop_rec else None,
        })

    return {
        "status": "success",
        "farmer_name": current_user.full_name,
        "farm_name": current_user.farm_name,
        "crops": user_crops,
    }

