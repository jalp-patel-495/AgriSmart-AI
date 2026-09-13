"""
AgriSmart AI — Farmer ↔ Stakeholder Connection Endpoints
Enables Farmers to view connected organizations, discover registered agricultural stakeholders,
and manage connection requests to share agricultural data transparently.
Strictly authorized to FARMER and ADMIN roles.
"""
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import User, StakeholderFarmerRelationship
from backend.app.schemas.auth import ROLE_FARMER, ROLE_ADMIN, ROLE_AGRICULTURAL_STAKEHOLDER
from backend.app.api.deps import require_role
from backend.app.schemas.stakeholder import (
    CreateConnectionRequest,
    FarmerConnectionItem,
    FarmerConnectionsResponse,
)

router = APIRouter(prefix="/farmer", tags=["Farmer Stakeholder Connections"])


@router.get("/stakeholder-connections", response_model=FarmerConnectionsResponse, summary="List connected organizations and available stakeholders")
def get_farmer_stakeholder_connections(
    current_user: User = Depends(require_role(ROLE_FARMER, ROLE_ADMIN)),
    db: Session = Depends(get_db)
):
    """
    Returns:
    1. Active, pending, and past stakeholder connections for the authenticated farmer.
    2. List of active agricultural stakeholder organizations available for connection.
    Strictly isolated to the authenticated farmer's own records.
    """
    relations = db.query(StakeholderFarmerRelationship).filter(
        StakeholderFarmerRelationship.farmer_id == current_user.id
    ).order_by(StakeholderFarmerRelationship.created_at.desc()).all()

    connections: List[FarmerConnectionItem] = []
    connected_stakeholder_ids = set()

    for r in relations:
        stk = r.stakeholder
        if not stk:
            stk = db.query(User).filter(User.id == r.stakeholder_id).first()
        if stk:
            connected_stakeholder_ids.add(stk.id)
            connections.append(
                FarmerConnectionItem(
                    relationship_id=r.id,
                    stakeholder_id=stk.id,
                    organization_name=getattr(stk, "organization_name", None) or stk.full_name,
                    stakeholder_name=stk.full_name,
                    stakeholder_type=getattr(stk, "stakeholder_type", None) or "Agricultural Enterprise",
                    operating_regions=getattr(stk, "operating_regions", None) or stk.farm_location,
                    primary_crops=getattr(stk, "primary_crops", None),
                    status=r.status,
                    created_at=r.created_at.strftime("%Y-%m-%d %H:%M UTC") if r.created_at else "Recently",
                    updated_at=r.updated_at.strftime("%Y-%m-%d %H:%M UTC") if r.updated_at else None,
                )
            )

    # Discoverable stakeholders
    all_stakeholders = db.query(User).filter(
        User.role == ROLE_AGRICULTURAL_STAKEHOLDER,
        User.is_active == True
    ).all()

    available: List[Dict[str, Any]] = []
    for s in all_stakeholders:
        is_connected = s.id in connected_stakeholder_ids
        available.append({
            "stakeholder_id": s.id,
            "organization_name": getattr(s, "organization_name", None) or s.full_name,
            "stakeholder_name": s.full_name,
            "organization_type": getattr(s, "organization_type", None) or "Farmer Producer Organization",
            "stakeholder_type": getattr(s, "stakeholder_type", None) or "Procurement / Buyer",
            "operating_regions": getattr(s, "operating_regions", None) or s.farm_location or "National",
            "primary_crops": getattr(s, "primary_crops", None) or "Multi-Crop",
            "already_connected": is_connected,
        })

    return FarmerConnectionsResponse(
        status="success",
        connections=connections,
        available_stakeholders=available,
    )


@router.post("/stakeholder-connections", status_code=status.HTTP_201_CREATED, summary="Create connection request to an agricultural stakeholder")
def create_stakeholder_connection(
    req: CreateConnectionRequest,
    current_user: User = Depends(require_role(ROLE_FARMER, ROLE_ADMIN)),
    db: Session = Depends(get_db)
):
    """
    Creates a new connection request to an Agricultural Stakeholder.
    Starts with PENDING status until approved by the stakeholder.
    """
    stakeholder = db.query(User).filter(
        User.id == req.stakeholder_id,
        User.role.in_([ROLE_AGRICULTURAL_STAKEHOLDER, ROLE_ADMIN]),
        User.is_active == True
    ).first()

    if not stakeholder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agricultural Stakeholder organization not found or inactive."
        )

    # Check for existing relationship
    existing = db.query(StakeholderFarmerRelationship).filter(
        StakeholderFarmerRelationship.stakeholder_id == req.stakeholder_id,
        StakeholderFarmerRelationship.farmer_id == current_user.id
    ).first()

    if existing:
        if existing.status == "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A connection request to this organization is already pending approval."
            )
        elif existing.status == "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already actively connected to this organization."
            )
        else:
            # Re-apply if previously REJECTED or REMOVED
            existing.status = "PENDING"
            existing.notes = req.notes
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return {
                "status": "success",
                "message": "Connection request re-submitted to organization.",
                "relationship_id": existing.id,
                "connection_status": "PENDING"
            }

    new_rel = StakeholderFarmerRelationship(
        stakeholder_id=stakeholder.id,
        farmer_id=current_user.id,
        status="PENDING",
        notes=req.notes
    )
    db.add(new_rel)
    db.commit()
    db.refresh(new_rel)

    return {
        "status": "success",
        "message": f"Connection request submitted to {getattr(stakeholder, 'organization_name', None) or stakeholder.full_name}.",
        "relationship_id": new_rel.id,
        "connection_status": "PENDING"
    }


@router.delete("/stakeholder-connections/{relationship_id}", summary="Remove or cancel a stakeholder connection")
def remove_stakeholder_connection(
    relationship_id: int,
    current_user: User = Depends(require_role(ROLE_FARMER, ROLE_ADMIN)),
    db: Session = Depends(get_db)
):
    """
    Cancels a pending request or disconnects from an agricultural stakeholder organization.
    Ensures the stakeholder immediately loses access to the farmer's agricultural telemetry.
    """
    rel = db.query(StakeholderFarmerRelationship).filter(
        StakeholderFarmerRelationship.id == relationship_id
    ).first()

    if not rel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection record not found."
        )

    # Privacy / Ownership check: Farmer can only remove their own relationship
    if rel.farmer_id != current_user.id and current_user.role != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this connection."
        )

    rel.status = "REMOVED"
    rel.updated_at = datetime.utcnow()
    db.commit()

    return {
        "status": "success",
        "message": "Successfully disconnected from organization. Your private farm data is no longer shared.",
        "relationship_id": rel.id,
        "connection_status": "REMOVED"
    }
