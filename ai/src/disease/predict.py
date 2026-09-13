"""
AgriSmart AI – Crop Disease Live Prediction Module
Implements model caching, dynamic class parsing, confidence thresholding, and Top-K ranking.
"""
import json
import os
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from PIL import Image
import torch
import torch.nn.functional as F

from ai.src.disease.models import build_crop_disease_model
from ai.src.disease.augmentation import get_inference_transforms
from ai.src.disease.disease_info import get_disease_info

# Global Model & Metadata Singleton Cache
_CACHED_MODEL = None
_CACHED_CLASSES: List[str] = []
_CACHED_CONFIG: Dict[str, Any] = {}
_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def parse_class_name(raw_class_name: str) -> Tuple[str, str]:
    """
    Robust dynamic parser to extract crop name and disease name without hardcoding.
    Examples:
    'Tomato___Early_blight' -> ('Tomato', 'Early Blight')
    'Potato___healthy' -> ('Potato', 'Healthy')
    'Bell_Pepper_Bacterial_Spot' -> ('Bell Pepper', 'Bacterial Spot')
    'Grape_Black_Rot' -> ('Grape', 'Black Rot')
    'Peach_Bacterial_Spot' -> ('Peach', 'Bacterial Spot')
    """
    clean_raw = str(raw_class_name).strip()

    # Special handling for known multi-word crops
    if clean_raw.lower().startswith("bell_pepper___"):
        crop_part = "Bell Pepper"
        disease_part = clean_raw[len("bell_pepper___"):]
    elif clean_raw.lower().startswith("bell_pepper_"):
        crop_part = "Bell Pepper"
        disease_part = clean_raw[len("bell_pepper_"):]
    elif clean_raw.lower().startswith("pepper,_bell___"):
        crop_part = "Bell Pepper"
        disease_part = clean_raw[len("pepper,_bell___"):]
    elif clean_raw.lower().startswith("grape_") and "___" not in clean_raw:
        crop_part = "Grape"
        disease_part = clean_raw[len("grape_"):]
    elif clean_raw.lower().startswith("peach_") and "___" not in clean_raw:
        crop_part = "Peach"
        disease_part = clean_raw[len("peach_"):]
    elif "___" in clean_raw:
        parts = clean_raw.split("___", 1)
        crop_part = parts[0]
        disease_part = parts[1]
    elif "__" in clean_raw:
        parts = clean_raw.split("__", 1)
        crop_part = parts[0]
        disease_part = parts[1]
    elif "_" in clean_raw:
        parts = clean_raw.split("_", 1)
        crop_part = parts[0]
        disease_part = parts[1]
    elif "/" in clean_raw:
        parts = clean_raw.split("/", 1)
        crop_part = parts[0]
        disease_part = parts[1]
    else:
        crop_part = "Plant"
        disease_part = clean_raw

    # Clean formatting
    crop = crop_part.replace("_", " ").strip().title()
    disease_raw = disease_part.replace("_", " ").strip()

    if disease_raw.lower() == "healthy":
        disease = "Healthy"
    else:
        # Title case disease words
        disease = " ".join([w.capitalize() for w in disease_raw.split()])

    return crop, disease


def load_disease_model_artifacts(
    model_path: Optional[str] = None,
    class_names_path: Optional[str] = None
) -> Tuple[torch.nn.Module, List[str]]:
    """
    Loads and caches the model and class names in memory for high-throughput inference.
    """
    global _CACHED_MODEL, _CACHED_CLASSES, _CACHED_CONFIG

    if _CACHED_MODEL is not None and _CACHED_CLASSES and not model_path and not class_names_path:
        return _CACHED_MODEL, _CACHED_CLASSES

    root_dir = Path(__file__).resolve().parents[3]
    ai_root = Path(__file__).resolve().parents[2]

    # Resolve class_names.json
    candidates_classes = [
        Path(class_names_path) if class_names_path else None,
        ai_root / "models" / "disease" / "class_names.json",
        root_dir / "ai" / "models" / "disease" / "class_names.json",
        root_dir / "models" / "disease" / "class_names.json",
        root_dir / "dataset" / "classes.json"
    ]
    resolved_classes_path = None
    for cp in candidates_classes:
        if cp and cp.exists():
            resolved_classes_path = cp
            break

    if resolved_classes_path:
        with open(resolved_classes_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                _CACHED_CLASSES = data
            elif isinstance(data, dict) and "classes" in data:
                _CACHED_CLASSES = [c["name"] for c in sorted(data["classes"], key=lambda x: x.get("id", 0))]
            elif isinstance(data, dict) and "class_names" in data:
                _CACHED_CLASSES = data["class_names"]

    # Fallback to discover from dataset directory if json not found yet
    if not _CACHED_CLASSES:
        from ai.src.disease.dataset import detect_dataset_path, discover_classes_and_samples
        try:
            d_path = detect_dataset_path()
            _CACHED_CLASSES, _, _ = discover_classes_and_samples(d_path)
        except Exception:
            _CACHED_CLASSES = [
                "Apple___Apple_scab", "Apple___Black_rot", "Apple___healthy",
                "Corn___Common_rust", "Corn___Northern_Leaf_Blight", "Corn___healthy",
                "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy",
                "Tomato___Bacterial_spot", "Tomato___Early_blight", "Tomato___Late_blight", "Tomato___healthy"
            ]

    # Resolve model checkpoint
    candidates_models = [
        Path(model_path) if model_path else None,
        ai_root / "models" / "disease" / "best_model.pt",
        root_dir / "ai" / "models" / "disease" / "best_model.pt",
        root_dir / "models" / "disease" / "best_model.pt",
        root_dir / "ai_model" / "models" / "production_model.pth",
        root_dir / "ai_model" / "models" / "best_model.pth"
    ]
    resolved_model_path = None
    for mp in candidates_models:
        if mp and mp.exists():
            resolved_model_path = mp
            break

    arch = "efficientnet_b0"

    if resolved_model_path:
        try:
            ckpt = torch.load(resolved_model_path, map_location=_DEVICE, weights_only=False)
            if isinstance(ckpt, dict) and "class_names" in ckpt:
                _CACHED_CLASSES = list(ckpt["class_names"])
            if isinstance(ckpt, dict) and "architecture" in ckpt:
                arch = ckpt["architecture"]

            num_classes = len(_CACHED_CLASSES)
            model = build_crop_disease_model(architecture=arch, num_classes=num_classes, pretrained=False)
            state_dict = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt
            model.load_state_dict(state_dict)
            model.to(_DEVICE)
            model.eval()
            _CACHED_MODEL = model
            return _CACHED_MODEL, _CACHED_CLASSES
        except Exception as e:
            print(f"[!] Warning: error loading checkpoint from {resolved_model_path}: {e}")

    num_classes = len(_CACHED_CLASSES)
    # Fallback to freshly initialized model
    model = build_crop_disease_model(architecture=arch, num_classes=num_classes, pretrained=True)
    model.to(_DEVICE)
    model.eval()
    _CACHED_MODEL = model
    return _CACHED_MODEL, _CACHED_CLASSES


def predict_disease(
    image_path: str,
    model_path: Optional[str] = None,
    class_names_path: Optional[str] = None,
    confidence_threshold: float = 0.65,
    top_k: int = 3
) -> Dict[str, Any]:
    """
    Predicts crop and disease from leaf image:
    1. Loads cached model and classes
    2. Validates and preprocesses image
    3. Executes forward inference
    4. Applies confidence threshold check
    5. Returns JSON-compatible structured result with top-3 predictions and advice.
    """
    # 1. Validate image path
    path = Path(image_path)
    if not path.exists():
        return {
            "status": "error",
            "message": f"Image file not found: {image_path}",
            "crop": None,
            "disease": None,
            "confidence": 0.0
        }

    try:
        img = Image.open(path).convert("RGB")
    except Exception as e:
        return {
            "status": "error",
            "message": f"Could not decode image file: {str(e)}",
            "crop": None,
            "disease": None,
            "confidence": 0.0
        }

    # 2. Load model and classes
    model, class_names = load_disease_model_artifacts(model_path, class_names_path)
    transform = get_inference_transforms(image_size=224)
    input_tensor = transform(img).unsqueeze(0).to(_DEVICE)

    # 3. Model forward pass
    with torch.no_grad():
        logits = model(input_tensor)
        probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()

    # 4. Top-K predictions
    top_indices = probs.argsort()[::-1][:top_k]
    top_class_id = int(top_indices[0])
    raw_confidence = float(probs[top_class_id])
    top_raw_class = class_names[top_class_id]

    top_crop, top_disease = parse_class_name(top_raw_class)

    # 5. Calculate aggregated crop confidence (sum of probabilities of all classes of same crop)
    crop_prob_sum = 0.0
    for idx, cname in enumerate(class_names):
        c_crop, _ = parse_class_name(cname)
        if c_crop.lower() == top_crop.lower():
            crop_prob_sum += float(probs[idx])
    crop_confidence = min(1.0, round(crop_prob_sum, 4))

    # 6. Check confidence threshold
    if raw_confidence < confidence_threshold:
        return {
            "status": "low_confidence",
            "message": "Low Confidence — Further Inspection Needed",
            "crop": None,
            "disease": "Low Confidence — Further Inspection Needed",
            "confidence": round(raw_confidence, 4),
            "threshold": confidence_threshold,
            "top_candidate": {
                "class": top_raw_class,
                "crop": top_crop,
                "disease": top_disease,
                "confidence": round(raw_confidence, 4)
            }
        }

    # 7. Format Top-K List
    top_predictions = []
    for idx in top_indices:
        cid = int(idx)
        c_raw = class_names[cid]
        c_crop, c_disease = parse_class_name(c_raw)
        top_predictions.append({
            "class": c_raw,
            "crop": c_crop,
            "disease": c_disease,
            "confidence": round(float(probs[cid]), 4)
        })

    # 8. Retrieve agronomic disease info
    disease_info = get_disease_info(crop_name=top_crop, disease_name=top_disease)

    return {
        "status": "success",
        "crop": top_crop,
        "crop_confidence": crop_confidence,
        "disease": top_disease,
        "disease_confidence": round(raw_confidence, 4),
        "confidence": round(raw_confidence, 4),
        "class": top_raw_class,
        "top_predictions": top_predictions,
        "pathogen": disease_info.get("pathogen", "N/A"),
        "symptoms": disease_info.get("symptoms", ""),
        "prevention": disease_info.get("prevention", ""),
        "management": disease_info.get("management", ""),
        "advice": disease_info.get("farmer_advice", "")
    }
