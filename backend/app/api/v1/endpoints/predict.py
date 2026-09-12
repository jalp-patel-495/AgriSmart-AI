"""
AgriSmart AI – Crop Disease Live Prediction API Endpoint
Technologies: Python, FastAPI, PyTorch, OpenCV, Pydantic
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Optional
import cv2
import numpy as np
import torch
import torch.nn.functional as F
import torchvision.transforms as T
from fastapi import APIRouter, UploadFile, File, HTTPException

from backend.app.schemas.prediction import PredictionResponse, TopPredictionItem
from backend.app.core.config import settings
from ai_model.src.model import build_model

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
    """Loads and caches canonical crop disease ontology and agronomy precautions."""
    global _CLASSES_MAP, _CLASSES_LIST
    if _CLASSES_MAP:
        return

    classes_path = Path(settings.CLASSES_PATH)
    if not classes_path.exists():
        classes_path = Path(__file__).resolve().parents[5] / "dataset" / "classes.json"
    if not classes_path.exists():
        classes_path = Path(__file__).resolve().parents[4] / "dataset" / "classes.json"

    if classes_path.exists():
        with open(classes_path, "r", encoding="utf-8") as f:
            classes = json.load(f)["classes"]
            for c in classes:
                _CLASSES_MAP[c["id"]] = c
            _CLASSES_LIST = [c["name"] for c in sorted(classes, key=lambda x: x["id"])]
            print(f"[*] Loaded metadata for {len(_CLASSES_MAP)} disease classes.")


def load_prediction_model(force_reload: bool = False) -> torch.nn.Module:
    """
    Loads and caches the best available trained PyTorch model on server startup.
    """
    global _MODEL
    if _MODEL is not None and not force_reload:
        return _MODEL

    load_classes_metadata()
    num_classes = len(_CLASSES_MAP) if _CLASSES_MAP else 13

    # Priority checkpoints
    root_candidates = [
        Path.cwd(),
        Path(__file__).resolve().parents[5],
        Path(__file__).resolve().parents[4],
    ]
    project_root = next((r for r in root_candidates if (r / "ai_model" / "models").exists()), Path.cwd())
    checkpoints = [
        project_root / "ai_model" / "models" / "production_model.pth",
        project_root / "ai_model" / "models" / "robust_model.pth",
        project_root / "ai_model" / "models" / "best_model.pth"
    ]

    chosen_path = None
    for ckpt in checkpoints:
        if ckpt.exists():
            chosen_path = ckpt
            break

    if chosen_path:
        try:
            print(f"[*] Loading PyTorch inference model from: {chosen_path}")
            checkpoint = torch.load(chosen_path, map_location=_DEVICE, weights_only=False)
            arch = checkpoint.get("architecture", "efficientnet_b0")
            model = build_model(architecture=arch, num_classes=num_classes, pretrained=False)
            model.load_state_dict(checkpoint["model_state_dict"])
            model.to(_DEVICE)
            model.eval()
            _MODEL = model
            print(f"[OK] Production model loaded successfully ({arch.upper()}) on {_DEVICE}.")
            return _MODEL
        except Exception as e:
            print(f"[!] Error loading checkpoint from {chosen_path}: {e}")

    # Fallback initialization
    print("[!] Checkpoint not found; initializing standard model.")
    model = build_model(architecture="efficientnet_b0", num_classes=num_classes, pretrained=False)
    model.to(_DEVICE)
    model.eval()
    _MODEL = model
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


@router.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict_crop_disease(file: UploadFile = File(...)):
    """
    Live AI inference and crop disease diagnosis endpoint:
    - Preprocesses uploaded image using OpenCV and PyTorch.
    - Executes deep learning forward pass.
    - Returns disease name, confidence, symptoms, and actionable precautions.
    """
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
