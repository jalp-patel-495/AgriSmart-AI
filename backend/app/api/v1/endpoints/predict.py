"""
AgriSmart AI – Crop Disease Live Prediction API Endpoint
Technologies: Python, FastAPI, PyTorch, OpenCV, Pydantic
"""

import os
import json
import time
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import cv2
import numpy as np
try:
    import torch
    import torch.nn.functional as F
    import torchvision.transforms as T
    _TORCH_AVAILABLE = True
    _DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _NORMALIZE = T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
except ImportError:
    torch = None
    F = None
    T = None
    _TORCH_AVAILABLE = False
    _DEVICE = "cpu"
    _NORMALIZE = None
from fastapi import APIRouter, UploadFile, File, Form, Query, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.db.database import get_db
from backend.app.api.deps import extract_token_from_request
from backend.app.services.auth_service import verify_session_token_and_get_user
from backend.app.db.models import DiseaseDiagnosisRecord

from backend.app.schemas.prediction import (
    PredictionResponse,
    TopPredictionItem,
    ComprehensiveAdvisoryResponse,
    ComprehensiveAdvisoryRequest
)
try:
    from ai_model.src.model import build_model
except ImportError:
    build_model = None

try:
    from src.disease.predict import predict_disease
    from src.crop_recommendation.predict import predict_crop
    from src.irrigation.predict import predict_irrigation
    from src.yield_prediction.predict import predict_yield
    from src.farmer_advisor.advisor import generate_farmer_advice
except ImportError:
    predict_disease = None
    predict_crop = None
    predict_irrigation = None
    predict_yield = None
    generate_farmer_advice = None

from ai.src.disease.quality_gate import check_image_quality
from ai.src.disease.segmentation import localize_leaf_specimen
from ai.src.disease.hierarchical import predict_hierarchical

router = APIRouter()


# Global cached model and classes
_MODEL: Optional[Any] = None
_CLASSES_MAP: Dict[int, dict] = {}
_CLASSES_LIST: List[str] = []



def load_classes_metadata():
    """Loads and caches canonical crop disease ontology and agronomy precautions aligned with trained model."""
    global _CLASSES_MAP, _CLASSES_LIST
    if _CLASSES_MAP:
        return

    from ai.src.disease.predict import load_disease_model_artifacts, parse_class_name
    from ai.src.disease.disease_info import get_disease_info

    # Load canonical class names directly from best trained model
    _, class_names = load_disease_model_artifacts()
    _CLASSES_LIST = list(class_names)

    # Load rich agronomy metadata from classes.json indexed by canonical class name
    classes_path = Path(settings.CLASSES_PATH)
    if not classes_path.exists():
        classes_path = Path(__file__).resolve().parents[5] / "dataset" / "classes.json"
    if not classes_path.exists():
        classes_path = Path(__file__).resolve().parents[4] / "dataset" / "classes.json"

    meta_by_name = {}
    if classes_path.exists():
        with open(classes_path, "r", encoding="utf-8") as f:
            for c in json.load(f).get("classes", []):
                k = c["name"].strip()
                meta_by_name[k] = c
                meta_by_name[k.lower()] = c
                meta_by_name[k.lower().replace("___", "_")] = c
                meta_by_name[k.replace("___", "_")] = c

    for idx, cname in enumerate(_CLASSES_LIST):
        matched_meta = (
            meta_by_name.get(cname) or
            meta_by_name.get(cname.lower()) or
            meta_by_name.get(cname.lower().replace("___", "_")) or
            meta_by_name.get(cname.replace("___", "_"))
        )
        if matched_meta:
            m = dict(matched_meta)
            m["id"] = idx
            m["name"] = cname
            _CLASSES_MAP[idx] = m
        else:
            crop, disease = parse_class_name(cname)
            dis_info = get_disease_info(crop, disease)
            _CLASSES_MAP[idx] = {
                "id": idx,
                "name": cname,
                "crop": crop,
                "disease": disease,
                "status": "Healthy" if "healthy" in disease.lower() else "Diseased",
                "pathogen": dis_info.get("pathogen", "N/A"),
                "symptoms": dis_info.get("symptoms", "Visible foliar lesions"),
                "precautions": [
                    "Remove affected leaves to reduce spore spread",
                    "Improve air circulation between plants",
                    "Avoid overhead watering"
                ],
                "treatment": dis_info.get("management", "Apply recommended protective treatments.")
            }

    print(f"[*] Loaded aligned metadata for {len(_CLASSES_MAP)} disease classes.")


def load_prediction_model(force_reload: bool = False) -> torch.nn.Module:
    """
    Loads and caches the best fine-tuned PyTorch EfficientNet-B0 model (Macro-F1: 0.9036).
    """
    global _MODEL
    if _MODEL is not None and not force_reload:
        return _MODEL

    from ai.src.disease.predict import load_disease_model_artifacts
    load_classes_metadata()
    model, _ = load_disease_model_artifacts()
    _MODEL = model
    print(f"[OK] Production disease model loaded successfully ({len(_CLASSES_MAP)} classes) on {_DEVICE}.")
    return _MODEL



def format_confidence_pct(score: float) -> str:
    """Formats confidence percentage: e.g. 0.37% for small non-zero values, integer % otherwise."""
    pct = score * 100.0
    if pct <= 0.0:
        return "0%"
    elif pct < 1.0:
        return f"{pct:.2f}%"
    return f"{int(round(pct))}%"


def preprocess_image_with_opencv(image_input: Union[bytes, np.ndarray], target_size: int = 224) -> torch.Tensor:
    """
    Standardizes preprocessing aligned with model training pipeline:
    RGB -> Resize(255) -> CenterCrop(224) -> ToTensor() -> ImageNet Normalization.
    Accepts either raw bytes or pre-cropped BGR numpy ndarray.
    """
    import io
    from PIL import Image
    from ai.src.disease.augmentation import get_inference_transforms

    if isinstance(image_input, (bytes, bytearray)):
        try:
            pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
        except Exception:
            np_buf = np.frombuffer(image_input, np.uint8)
            img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
            if img_bgr is None or img_bgr.size == 0:
                raise ValueError("Invalid or corrupted image format. Image could not be decoded.")
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(img_rgb)
    elif isinstance(image_input, np.ndarray):
        img_rgb = cv2.cvtColor(image_input, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
    else:
        raise ValueError("Unsupported image input type for preprocessing.")

    inference_transforms = get_inference_transforms(image_size=target_size)
    normalized_tensor = inference_transforms(pil_img).unsqueeze(0)
    return normalized_tensor


@router.post("/predict", tags=["Prediction"])
async def predict_crop_disease(
    request: Request,
    file: UploadFile = File(...),
    format: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Hierarchical AI crop-disease diagnosis endpoint:
    1. Image Quality Check
    2. Leaf Detection / Segmentation
    3. Crop Identification (Stage A)
    4. Supported / Unsupported Check
    5. Disease Classification (Stage B)
    6. Confidence Calibration + OOD Detection
    7. Final Safe Result
    """
    if format == "advisory":
        contents = await file.read()
        result = execute_farmer_advisory_pipeline(
            image_bytes=contents,
            image_filename=file.filename
        )
        return JSONResponse(content=result)

    start_time = time.time()

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image format (JPEG, PNG, WebP)")

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty")

    # 1. IMAGE QUALITY GATE
    quality_ok, quality_msg, quality_metrics = check_image_quality(contents)
    if not quality_ok:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        return PredictionResponse(
            success=False,
            message=quality_msg or "Image quality insufficient. Please upload a clearer, well-lit, single-leaf image.",
            disease="Not confidently identified",
            crop="Undetermined",
            confidence="0%",
            confidence_score=0.0,
            status="image_quality_insufficient",
            pathogen=None,
            symptoms="Image quality does not meet foliar diagnostic standards. Please upload a clearer, well-lit, single-leaf image in bright natural daylight.",
            precautions=[
                "Upload a clearer, high-resolution leaf image",
                "Ensure the leaf is well-lit in natural daylight without harsh flash or shadows",
                "Capture a single leaf occupying the center of the frame against a plain background",
                "Avoid excessive camera shake, blur, or severe background occlusion"
            ],
            treatment=None,
            top_predictions=[],
            processing_time_ms=duration_ms,
            is_supported=False,
            is_ood=True,
            quality_ok=False,
            quality_message=quality_msg,
            canonical_disease=None,
            crop_confidence=0.0,
            disease_confidence=0.0,
            ood_score=1.0,
            ood_status="quality_insufficient"
        )

    # 2. UNIVERSAL MULTI-CROP HIERARCHICAL AI DIAGNOSIS (14 crops, 38 classes)
    try:
        from ai.src.disease_universal.inference import predict_universal
        universal_res = predict_universal(contents, confidence_threshold=0.65, top_k=3)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        
        top_preds = [
            TopPredictionItem(
                class_id=p_idx,
                disease=p["disease"],
                crop=p["crop"],
                confidence=format_confidence_pct(p["confidence"]),
                confidence_score=round(p["confidence"], 4)
            )
            for p_idx, p in enumerate(universal_res.get("top_predictions", [])[:3])
        ]
        
        crop_dist = {item["crop"]: item["confidence"] for item in universal_res.get("crop_top_k", [])}
        dis_conf = universal_res.get("disease_confidence", 0.0)
        crop_conf = universal_res.get("crop_confidence", 0.0)
        crop_top_k_list = universal_res.get("crop_top_k", [])
        top_crop_name = crop_top_k_list[0]["crop"] if crop_top_k_list else universal_res.get("crop")
        top_crop_conf = crop_top_k_list[0]["confidence"] if crop_top_k_list else crop_conf
        sec_crop_name = crop_top_k_list[1]["crop"] if len(crop_top_k_list) > 1 else None
        sec_crop_conf = crop_top_k_list[1]["confidence"] if len(crop_top_k_list) > 1 else 0.0

        # Section 10: Diagnostic Information to Backend Logs
        print("\n" + "=" * 65)
        print(f"[*] UNIVERSAL AI DIAGNOSTIC AUDIT LOG — Specimen: {getattr(file, 'filename', 'upload')}")
        print(f"Quality status         : {'PASS' if quality_ok else 'FAIL'}")
        print(f"Detected Crop (Top-1)  : {top_crop_name} ({top_crop_conf:.4f})")
        print(f"Runner-up Crop (Top-2) : {sec_crop_name} ({sec_crop_conf:.4f})")
        print(f"Disease Stage B        : {universal_res.get('disease')} ({dis_conf:.4f})")
        print(f"OOD evaluation         : score={universal_res.get('ood_score', 0.0):.4f}, status={universal_res.get('ood_status')}, is_ood={universal_res.get('is_ood')}")
        print(f"Final Decision         : Crop='{universal_res.get('crop')}', Disease='{universal_res.get('disease')}', Status='{universal_res.get('status', 'Low Confidence')}'")
        print("=" * 65 + "\n")

        return PredictionResponse(
            success=universal_res["success"],
            message=universal_res.get("message", "Universal diagnosis completed successfully."),
            disease=universal_res["disease"],
            crop=universal_res["crop"],
            confidence=format_confidence_pct(dis_conf),
            confidence_score=round(dis_conf, 4),
            status=universal_res.get("status", "Low Confidence"),
            pathogen=universal_res.get("pathogen"),
            symptoms=universal_res.get("symptoms", "Visible foliar lesions"),
            precautions=universal_res.get("precautions", [
                "Upload a clearer, high-resolution leaf image in bright daylight",
                "Ensure the leaf is in sharp focus without blur, harsh shadows, or glare",
                "Capture the entire leaf surface against a plain background",
                "Consult a certified local agricultural extension officer before applying chemical treatments"
            ]),
            treatment=universal_res.get("treatment"),
            top_predictions=top_preds,
            processing_time_ms=duration_ms,
            is_supported=universal_res.get("is_supported", True),
            is_ood=universal_res.get("is_ood", False),
            quality_ok=universal_res.get("quality_ok", True),
            canonical_disease=universal_res.get("canonical_disease"),
            crop_confidence=round(crop_conf, 4),
            disease_confidence=round(dis_conf, 4),
            ood_score=round(universal_res.get("ood_score", 0.0), 4),
            ood_status=universal_res.get("ood_status", "in_distribution"),
            top_crop=top_crop_name,
            top_crop_confidence=round(top_crop_conf, 4),
            second_crop=sec_crop_name,
            second_crop_confidence=round(sec_crop_conf, 4),
            crop_distribution=crop_dist,
            diseases=universal_res.get("diseases", []),
            is_multilabel=universal_res.get("is_multilabel", False)
        )
    except Exception as exc:
        print(f"[!] Warning: Universal inference encountered exception: {exc}. Falling back to legacy pipeline.")

    # 3. LEGACY FALLBACK PIPELINE
    np_buf = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
    cropped_leaf_bgr, bbox, foliar_ratio = localize_leaf_specimen(img_bgr)

    try:
        input_tensor = preprocess_image_with_opencv(cropped_leaf_bgr, target_size=224).to(_DEVICE)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image preprocessing failed: {str(e)}")

    load_classes_metadata()
    model = load_prediction_model()

    # 3-6. HIERARCHICAL PREDICTION + CROP OOD EVALUATION + CONFIDENCE CALIBRATION
    with torch.no_grad():
        logits = model(input_tensor)

    hierarchical_res = predict_hierarchical(
        logits=logits,
        class_map=_CLASSES_MAP,
        class_names=_CLASSES_LIST,
        confidence_threshold=0.65,
        min_crop_confidence_floor=0.22
    )

    duration_ms = round((time.time() - start_time) * 1000, 2)
    crop_conf = hierarchical_res.get("crop_confidence", 0.0)
    disease_conf = hierarchical_res.get("disease_confidence", 0.0)
    top_crop = hierarchical_res.get("top_crop", hierarchical_res.get("crop"))
    top_crop_conf = hierarchical_res.get("top_crop_confidence", crop_conf)
    second_crop = hierarchical_res.get("second_crop")
    second_crop_conf = hierarchical_res.get("second_crop_confidence", 0.0)
    crop_dist = hierarchical_res.get("crop_distribution", {})
    is_ood = hierarchical_res.get("is_ood", False)
    is_supported = hierarchical_res.get("is_supported", True)
    ood_score = hierarchical_res.get("ood_score", 0.0)
    ood_status = hierarchical_res.get("ood_status", "in_distribution")

    # Section 10: Diagnostic Information to Backend Logs
    sorted_dist = sorted(crop_dist.items(), key=lambda x: x[1], reverse=True)
    print("\n" + "=" * 65)
    print(f"[*] DIAGNOSTIC AUDIT LOG — Image: {getattr(file, 'filename', 'unknown')}")
    print(f"Quality status         : {'PASS' if quality_ok else 'FAIL'} (quality_ok={quality_ok})")
    print("Crop Stage A Distribution:")
    for c_name, c_prob in sorted_dist:
        print(f"  {c_name:<14} = {c_prob:.4f} ({c_prob*100:.1f}%)")
    print(f"Detected Crop (Top-1)  : {top_crop} ({top_crop_conf:.4f})")
    print(f"Second Crop (Top-2)    : {second_crop} ({second_crop_conf:.4f})")
    print(f"Disease Stage B        : {hierarchical_res.get('disease')} ({disease_conf:.4f})")
    print(f"OOD evaluation         : score={ood_score:.4f}, status={ood_status}, is_ood={is_ood}")
    print(f"Final Decision         : Crop='{hierarchical_res.get('crop')}', Disease='{hierarchical_res.get('disease')}', Status='{hierarchical_res.get('status_str', 'Low Confidence')}'")
    print("=" * 65 + "\n")

    # Persist genuine disease observation if requested by authenticated farmer
    try:
        token = extract_token_from_request(request)
        if token:
            farmer_user = verify_session_token_and_get_user(token, db)
            if farmer_user:
                if is_ood or not is_supported:
                    diag_crop = "Unsupported / Unknown"
                    diag_disease = "Not confidently identified"
                    diag_status = "Low Confidence"
                    diag_pathogen = None
                    diag_treatment = "Further inspection needed"
                elif disease_conf < 0.65:
                    diag_crop = hierarchical_res.get("crop", "Undetermined")
                    diag_disease = "Not confidently identified"
                    diag_status = "Low Confidence"
                    diag_pathogen = None
                    diag_treatment = "Further inspection needed"
                else:
                    diag_crop = hierarchical_res.get("crop", "Crop")
                    diag_disease = hierarchical_res.get("disease", "Condition")
                    diag_status = hierarchical_res.get("status_str", "Diseased")
                    diag_pathogen = hierarchical_res.get("pathogen")
                    diag_treatment = hierarchical_res.get("treatment")

                diag_rec = DiseaseDiagnosisRecord(
                    farmer_id=farmer_user.id,
                    crop=diag_crop,
                    disease=diag_disease,
                    confidence=round(disease_conf, 4),
                    confidence_str=format_confidence_pct(disease_conf),
                    status=diag_status,
                    pathogen=diag_pathogen,
                    symptoms=hierarchical_res.get("symptoms", "Foliar assessment"),
                    treatment=diag_treatment,
                    image_filename=file.filename or "leaf_upload.jpg"
                )
                db.add(diag_rec)
                db.commit()
    except Exception as e:
        db.rollback()
        print(f"[!] Warning: Failed to persist disease diagnosis: {e}")

    # CASE 2: Genuine OOD -> Crop: "Unsupported / Unknown", Disease: "Not confidently identified"
    if is_ood or not is_supported:
        return PredictionResponse(
            success=True,
            message="Input appears out of distribution or unsupported crop species. Further inspection needed.",
            disease="Not confidently identified",
            crop="Unsupported / Unknown",
            confidence=format_confidence_pct(disease_conf),
            confidence_score=round(disease_conf, 4),
            status="Low Confidence",
            pathogen=None,
            symptoms="Unable to determine symptoms with high confidence. Please upload a clearer, high-resolution leaf image in good natural daylight.",
            precautions=[
                "Upload a clearer, high-resolution leaf image in bright daylight",
                "Ensure the leaf is in sharp focus without blur, harsh shadows, or glare",
                "Capture the entire leaf surface against a plain background",
                "Consult a certified local agricultural extension officer before applying chemical treatments"
            ],
            treatment=None,
            top_predictions=[],
            processing_time_ms=duration_ms,
            is_supported=False,
            is_ood=True,
            quality_ok=True,
            quality_message=hierarchical_res.get("rejection_reason"),
            canonical_disease=None,
            crop_confidence=round(crop_conf, 4),
            disease_confidence=round(disease_conf, 4),
            ood_score=ood_score,
            ood_status=ood_status,
            top_crop=top_crop,
            top_crop_confidence=round(top_crop_conf, 4),
            second_crop=second_crop,
            second_crop_confidence=round(second_crop_conf, 4),
            crop_distribution=crop_dist
        )

    # CASE 3: Supported crop BUT disease confidence < 65%
    # Preserve detected crop species, set Disease to Not confidently identified
    if disease_conf < 0.65:
        return PredictionResponse(
            success=True,
            message="Supported crop identified, but disease confidence is low. Further inspection needed.",
            disease="Not confidently identified",
            crop=hierarchical_res["crop"],
            confidence=format_confidence_pct(disease_conf),
            confidence_score=round(disease_conf, 4),
            status="Low Confidence",
            pathogen=None,
            symptoms="Unable to determine symptoms with high confidence. Please upload a clearer, high-resolution leaf image in good natural daylight.",
            precautions=[
                "Upload a clearer, high-resolution leaf image in bright daylight",
                "Ensure the leaf is in sharp focus without blur, harsh shadows, or glare",
                "Capture the entire leaf surface against a plain background",
                "Consult a certified local agricultural extension officer before applying chemical treatments"
            ],
            treatment=None,
            top_predictions=[],
            processing_time_ms=duration_ms,
            is_supported=True,
            is_ood=False,
            quality_ok=True,
            quality_message="Supported crop identified; disease confidence below 65% safety gate.",
            canonical_disease=None,
            crop_confidence=round(crop_conf, 4),
            disease_confidence=round(disease_conf, 4),
            ood_score=ood_score,
            ood_status=ood_status,
            top_crop=top_crop,
            top_crop_confidence=round(top_crop_conf, 4),
            second_crop=second_crop,
            second_crop_confidence=round(second_crop_conf, 4),
            crop_distribution=crop_dist
        )

    # CASE 4: Supported crop AND disease confidence >= 65%
    top_preds = [
        TopPredictionItem(
            class_id=p["class_id"],
            disease=p["disease"],
            crop=p["crop"],
            confidence=format_confidence_pct(p["confidence"]),
            confidence_score=round(p["confidence"], 4)
        )
        for p in hierarchical_res.get("top_predictions", [])[:3]
    ]

    return PredictionResponse(
        success=True,
        message="Crop leaf image analyzed successfully.",
        disease=hierarchical_res["disease"],
        crop=hierarchical_res["crop"],
        confidence=format_confidence_pct(disease_conf),
        confidence_score=round(disease_conf, 4),
        status=hierarchical_res.get("status_str", "Diseased"),
        pathogen=hierarchical_res.get("pathogen"),
        symptoms=hierarchical_res.get("symptoms", "Visible foliar lesions"),
        precautions=hierarchical_res.get("precautions", [
            "Remove affected leaves to reduce spore spread",
            "Improve air circulation between plants",
            "Avoid overhead watering"
        ]),
        treatment=hierarchical_res.get("treatment"),
        top_predictions=top_preds,
        processing_time_ms=duration_ms,
        is_supported=True,
        is_ood=False,
        quality_ok=True,
        quality_message=None,
        canonical_disease=hierarchical_res.get("canonical_disease"),
        crop_confidence=round(crop_conf, 4),
        disease_confidence=round(disease_conf, 4),
        ood_score=ood_score,
        ood_status=ood_status,
        top_crop=top_crop,
        top_crop_confidence=round(top_crop_conf, 4),
        second_crop=second_crop,
        second_crop_confidence=round(second_crop_conf, 4),
        crop_distribution=crop_dist
    )


def execute_farmer_advisory_pipeline(
    image_bytes: Optional[bytes] = None,
    image_filename: Optional[str] = None,
    structured_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Executes the integrated AgriSmart AI decision pipeline:
    1. Disease detection from leaf image (if provided)
    2. Crop recommendation from soil N-P-K (if provided)
    3. Irrigation requirement from soil moisture telemetry (if provided)
    4. Yield estimation from farm area & agrochemical metrics (if provided)
    5. Farmer advisor agronomic rule synthesis & risk priority assessment.
    """
    structured = structured_data or {}

    # 1. Disease Detection via Leaf Image
    disease_result = None
    disease_block = {
        "crop": "Data unavailable",
        "name": "Data unavailable",
        "confidence": 0.0
    }

    if image_bytes is not None and len(image_bytes) > 0:
        # Validate format via OpenCV decoding
        np_buf = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
        if img_bgr is None or img_bgr.size == 0:
            raise HTTPException(
                status_code=400,
                detail="Invalid or corrupted image format. OpenCV could not decode image."
            )

        suffix = Path(image_filename).suffix if image_filename else ".jpg"
        if suffix.lower() not in [".jpg", ".jpeg", ".png", ".webp"]:
            suffix = ".jpg"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            # We call predict_disease with threshold 0.0 to capture raw confidence
            raw_res = predict_disease(tmp_path, confidence_threshold=0.0)
            if raw_res.get("status") in ["success", "low_confidence"]:
                disease_result = raw_res
                disease_block = {
                    "crop": str(raw_res.get("crop", "Unknown")),
                    "name": str(raw_res.get("disease", "Unknown")),
                    "confidence": round(float(raw_res.get("confidence", 0.0)), 4)
                }
            elif raw_res.get("status") == "error":
                raise HTTPException(status_code=400, detail=raw_res.get("message", "Disease prediction failed."))
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    # 2. Crop Recommendation
    crop_rec_result = None
    n_val = structured.get("n", structured.get("N", structured.get("nitrogen")))
    p_val = structured.get("p", structured.get("P", structured.get("phosphorus")))
    k_val = structured.get("k", structured.get("K", structured.get("potassium")))

    if n_val is not None and p_val is not None and k_val is not None:
        try:
            temp_val = structured.get("temperature", structured.get("temp", 25.0))
            humid_val = structured.get("humidity", 70.0)
            ph_val = structured.get("ph", structured.get("soil_ph", 6.5))
            rain_val = structured.get("rainfall", 100.0)

            crop_features = {
                "N": float(n_val),
                "P": float(p_val),
                "K": float(k_val),
                "temperature": float(temp_val),
                "humidity": float(humid_val),
                "ph": float(ph_val),
                "rainfall": float(rain_val)
            }
            c_res = predict_crop(crop_features)
            if c_res.get("status") == "success":
                crop_rec_result = c_res
                crop_rec_block = {
                    "recommended_crop": str(c_res["recommended_crop"]),
                    "confidence": round(float(c_res["confidence"]), 4)
                }
            else:
                crop_rec_block = {
                    "recommended_crop": "Data unavailable",
                    "confidence": 0.0
                }
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid numerical value for crop recommendation: {str(e)}")
    else:
        crop_rec_block = {
            "recommended_crop": "Data unavailable",
            "confidence": 0.0
        }

    # 3. Irrigation Prediction
    irrigation_result = None
    moist_val = structured.get("soil_moisture", structured.get("moisture"))
    if moist_val is not None:
        try:
            temp_val = structured.get("temperature", structured.get("temp", 25.0))
            humid_val = structured.get("humidity", 70.0)
            irr_features = {
                "soil_moisture": float(moist_val),
                "temperature": float(temp_val),
                "humidity": float(humid_val)
            }
            i_res = predict_irrigation(irr_features)
            if i_res.get("status") == "success":
                irrigation_result = i_res
                irrigation_block = {
                    "required": bool(i_res["irrigation_required"]),
                    "prediction": str(i_res["prediction"]),
                    "confidence": round(float(i_res["confidence"]), 4),
                    "priority": str(i_res["priority"])
                }
            else:
                irrigation_block = {
                    "required": False,
                    "prediction": "Data unavailable",
                    "confidence": 0.0,
                    "priority": "Data unavailable"
                }
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid numerical value for irrigation prediction: {str(e)}")
    else:
        irrigation_block = {
            "required": False,
            "prediction": "Data unavailable",
            "confidence": 0.0,
            "priority": "Data unavailable"
        }

    # 4. Yield Prediction
    yield_result = None
    area_val = structured.get("area", structured.get("Area"))
    fert_val = structured.get("fertilizer", structured.get("Fertilizer"))
    pest_val = structured.get("pesticide", structured.get("Pesticide"))

    if area_val is not None and fert_val is not None and pest_val is not None:
        try:
            detected_crop = (disease_result.get("crop") if disease_result else None) or (crop_rec_result.get("recommended_crop") if crop_rec_result else None)
            crop_name = structured.get("crop", structured.get("Crop", detected_crop or "Rice"))
            season_name = structured.get("season", structured.get("Season", "Kharif"))
            state_name = structured.get("state", structured.get("State", "Assam"))
            rain_val = structured.get("annual_rainfall", structured.get("Annual_Rainfall", structured.get("rainfall", 1500.0)))

            yield_features = {
                "Crop": str(crop_name).strip().capitalize(),
                "Season": str(season_name).strip(),
                "State": str(state_name).strip(),
                "Area": float(area_val),
                "Annual_Rainfall": float(rain_val),
                "Fertilizer": float(fert_val),
                "Pesticide": float(pest_val)
            }
            y_res = predict_yield(yield_features)
            if y_res.get("status") == "success":
                yield_result = y_res
                yield_block = {
                    "estimated": round(float(y_res["predicted_yield"]), 2),
                    "unit": str(y_res.get("unit", "Tonnes/Ha"))
                }
            else:
                yield_block = {
                    "estimated": "Data unavailable",
                    "unit": "Tonnes/Ha"
                }
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid numerical value for yield prediction: {str(e)}")
    else:
        yield_block = {
            "estimated": "Data unavailable",
            "unit": "Tonnes/Ha"
        }

    # 5. Farmer Advisor Decision Engine
    env_info = {}
    if moist_val is not None:
        env_info["soil_moisture"] = float(moist_val)
    if "temperature" in structured or "temp" in structured:
        env_info["temperature"] = float(structured.get("temperature", structured.get("temp")))
    if "humidity" in structured:
        env_info["humidity"] = float(structured["humidity"])
    if "rainfall" in structured:
        env_info["rainfall"] = float(structured["rainfall"])
    if "ph" in structured or "soil_ph" in structured:
        env_info["soil_pH"] = float(structured.get("ph", structured.get("soil_ph")))

    target_crop = structured.get("crop") or (disease_result.get("crop") if disease_result else None) or (crop_rec_result.get("recommended_crop") if crop_rec_result else None)

    advisor_result = generate_farmer_advice(
        crop=target_crop,
        disease_result=disease_result,
        irrigation_result=irrigation_result,
        yield_result=yield_result,
        crop_rec_result=crop_rec_result,
        environmental_info=env_info if env_info else None
    )

    farmer_advisor_block = {
        "farm_status": advisor_result["farm_status"],
        "overall_priority": advisor_result["overall_priority"],
        "recommendations": advisor_result["recommendations"],
        "warnings": advisor_result["warnings"]
    }

    return {
        "status": "success",
        "disease": disease_block,
        "crop_recommendation": crop_rec_block,
        "irrigation": irrigation_block,
        "yield": yield_block,
        "farmer_advisor": farmer_advisor_block
    }


@router.post("/predict/advisory", tags=["Farmer Advisory"])
@router.post("/farmer-advisory", tags=["Farmer Advisory"])
async def predict_advisory(request: Request):
    """
    Unified AI-to-Application Integration Endpoint:
    Coordinates Leaf Disease Detection, Crop Recommendation, Irrigation Scheduling,
    and Yield Estimation into an actionable Farmer Advisory payload.
    Accepts both multipart/form-data (with file and form fields) and application/json.
    """
    content_type = request.headers.get("content-type", "")
    image_bytes = None
    image_filename = None
    structured_data: Dict[str, Any] = {}

    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                structured_data = body
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload provided.")
    elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        for k, v in form.items():
            if hasattr(v, "filename") and hasattr(v, "read"):
                image_bytes = await v.read()
                image_filename = v.filename
                content_type_val = getattr(v, "content_type", "")
                if content_type_val and not content_type_val.startswith("image/") and not content_type_val.startswith("application/octet-stream"):
                    raise HTTPException(status_code=400, detail="Uploaded file must be a valid image format (JPEG, PNG, WebP)")
            else:
                try:
                    structured_data[k] = float(v)
                except (ValueError, TypeError):
                    structured_data[k] = str(v)
    else:
        # Fallback to query parameters
        for k, v in request.query_params.items():
            try:
                structured_data[k] = float(v)
            except (ValueError, TypeError):
                structured_data[k] = str(v)

    # Merge any query params not yet in structured_data
    for k, v in request.query_params.items():
        if k not in structured_data:
            try:
                structured_data[k] = float(v)
            except (ValueError, TypeError):
                structured_data[k] = str(v)


    result = execute_farmer_advisory_pipeline(
        image_bytes=image_bytes,
        image_filename=image_filename,
        structured_data=structured_data
    )
    return JSONResponse(content=result)


@router.get("/predict/coverage", tags=["Prediction"])
async def get_universal_coverage_catalog():
    """
    Returns the dynamic catalog of all 14 supported crops and 38 disease classes
    directly generated from class_registry.json.
    """
    reg_path = Path(r"j:\AGRISMART_AI\models\disease_universal\class_registry.json")
    if not reg_path.exists():
        reg_path = Path(r"j:\AGRISMART_AI\dataset\class_registry.json")
    if reg_path.exists():
        with open(reg_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "total_supported_crops": 14,
        "total_supported_classes": 38,
        "summary": "AI-powered plant leaf disease detection across supported crop and disease classes."
    }

