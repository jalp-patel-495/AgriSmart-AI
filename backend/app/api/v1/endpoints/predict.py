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
import torch
import torch.nn.functional as F
import torchvision.transforms as T
from fastapi import APIRouter, UploadFile, File, Form, Query, Request, HTTPException
from fastapi.responses import JSONResponse

from backend.app.schemas.prediction import (
    PredictionResponse,
    TopPredictionItem,
    ComprehensiveAdvisoryResponse,
    ComprehensiveAdvisoryRequest
)
from backend.app.core.config import settings
from ai_model.src.model import build_model
from src.disease.predict import predict_disease
from src.crop_recommendation.predict import predict_crop
from src.irrigation.predict import predict_irrigation
from src.yield_prediction.predict import predict_yield
from src.farmer_advisor.advisor import generate_farmer_advice

router = APIRouter()


# Global cached model and classes
_MODEL: Optional[torch.nn.Module] = None
_CLASSES_MAP: Dict[int, dict] = {}
_CLASSES_LIST: List[str] = []
_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

_NORMALIZE = T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)


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



def preprocess_image_with_opencv(image_bytes: bytes, target_size: int = 224) -> torch.Tensor:
    """
    Decodes image using OpenCV, converts color space, resizes, and converts to normalized PyTorch tensor.
    """
    # Decode raw bytes into OpenCV BGR numpy array
    np_buf = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)

    if img_bgr is None or img_bgr.size == 0:
        raise ValueError("Invalid or corrupted image format. OpenCV could not decode image.")

    # Convert BGR -> RGB
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    # High quality interpolation resize
    img_resized = cv2.resize(img_rgb, (target_size, target_size), interpolation=cv2.INTER_AREA)

    # Convert to float tensor (3, H, W) in [0.0, 1.0]
    tensor = torch.from_numpy(img_resized).permute(2, 0, 1).float() / 255.0

    # Apply ImageNet normalization
    normalized_tensor = _NORMALIZE(tensor).unsqueeze(0)
    return normalized_tensor


@router.post("/predict", tags=["Prediction"])
async def predict_crop_disease(
    file: UploadFile = File(...),
    format: Optional[str] = Query(None)
):
    """
    Live AI inference and crop disease diagnosis endpoint:
    - If format == 'advisory', returns unified end-to-end advisory response.
    - Otherwise returns standard PredictionResponse for frontend ResultView.
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

    try:
        # Preprocess with OpenCV and PyTorch
        input_tensor = preprocess_image_with_opencv(contents, target_size=224).to(_DEVICE)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image decoding failed: {str(e)}")

    load_classes_metadata()
    model = load_prediction_model()

    # Model Forward Pass
    with torch.no_grad():
        logits = model(input_tensor)
        probabilities = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()

    # Rank top predictions
    top_indices = np.argsort(probabilities)[::-1][:3]
    top_id = int(top_indices[0])
    raw_confidence = float(probabilities[top_id])

    # Get class metadata & precautions
    meta = _CLASSES_MAP.get(top_id, {
        "id": top_id,
        "name": _CLASSES_LIST[top_id] if top_id < len(_CLASSES_LIST) else f"Class_{top_id}",
        "crop": "Crop",
        "disease": "Plant Condition",
        "status": "Diseased",
        "pathogen": "Identified Pathogen",
        "symptoms": "Brown spots and discoloration on leaf surface",
        "precautions": [
            "Remove affected leaves to reduce spore spread",
            "Improve air circulation between plants",
            "Avoid overhead watering"
        ],
        "treatment": "Apply targeted organic or chemical remedies as recommended."
    })

    # Top predictions list
    top_predictions = []
    for idx in top_indices:
        cid = int(idx)
        c_meta = _CLASSES_MAP.get(cid, {})
        c_disease = c_meta.get("disease", _CLASSES_LIST[cid] if cid < len(_CLASSES_LIST) else f"Class {cid}")
        c_crop = c_meta.get("crop", "Crop")
        conf_score = float(probabilities[cid])
        top_predictions.append(TopPredictionItem(
            class_id=cid,
            disease=c_disease,
            crop=c_crop,
            confidence=f"{int(round(conf_score * 100))}%",
            confidence_score=round(conf_score, 4)
        ))

    duration_ms = round((time.time() - start_time) * 1000, 2)
    confidence_str = f"{int(round(raw_confidence * 100))}%"

    # Model Safety Rule: Confidence < 65% triggers inspection warning & suppresses treatments
    if raw_confidence < 0.65:
        return PredictionResponse(
            success=True,
            message="Low confidence prediction. Further inspection needed.",
            disease="Low Confidence — Further Inspection Needed",
            crop="Undetermined",
            confidence=confidence_str,
            confidence_score=round(raw_confidence, 4),
            status="Low Confidence",
            pathogen=None,
            symptoms="Unable to determine symptoms with high confidence. Please upload a clearer, high-resolution leaf image in good natural daylight.",
            precautions=[
                "Upload a clearer, high-resolution leaf image in bright daylight",
                "Ensure the leaf is in sharp focus without blur, harsh shadows, or glare",
                "Inspect both upper and lower leaf surfaces for early signs of disease",
                "Consult a certified local agricultural extension officer before applying chemical treatments"
            ],
            treatment=None,
            top_predictions=top_predictions,
            processing_time_ms=duration_ms
        )

    return PredictionResponse(
        success=True,
        message="Crop leaf image analyzed successfully.",
        disease=meta.get("disease", "Crop Condition"),
        crop=meta.get("crop", "Crop"),
        confidence=confidence_str,
        confidence_score=round(raw_confidence, 4),
        status=meta.get("status", "Diseased"),
        pathogen=meta.get("pathogen"),
        symptoms=meta.get("symptoms", "Visible foliar lesions"),
        precautions=meta.get("precautions", [
            "Remove affected leaves",
            "Improve air circulation",
            "Avoid overhead watering"
        ]),
        treatment=meta.get("treatment", "Apply recommended protective treatments."),
        top_predictions=top_predictions,
        processing_time_ms=duration_ms
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

