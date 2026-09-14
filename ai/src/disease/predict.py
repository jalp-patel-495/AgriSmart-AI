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

import cv2
import numpy as np

from ai.src.disease.models import build_crop_disease_model
from ai.src.disease.augmentation import get_inference_transforms
from ai.src.disease.disease_info import get_disease_info
from ai.src.disease.quality_gate import check_image_quality
from ai.src.disease.segmentation import localize_leaf_specimen
from ai.src.disease.hierarchical import predict_hierarchical

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
        root_dir / "models" / "disease" / "plantvillage_model.pt",
        root_dir / "models" / "disease" / "best_model.pt",
        ai_root / "models" / "disease" / "plantvillage_model.pt",
        ai_root / "models" / "disease" / "best_model.pt",
        root_dir / "models" / "disease" / "best_model_robust.pt",
        ai_root / "models" / "disease" / "best_model_robust.pt",
        root_dir / "ai" / "models" / "disease" / "best_model.pt",
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
    Hierarchical crop-disease prediction pipeline:
    1. Image Quality Check
    2. Leaf Detection / Segmentation
    3. Crop Identification (Stage A)
    4. Supported / Unsupported Check
    5. Disease Classification (Stage B)
    6. Confidence Calibration + OOD Detection
    7. Final Safe Result
    """
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
        with open(path, "rb") as f:
            image_bytes = f.read()
    except Exception as e:
        return {
            "status": "error",
            "message": f"Could not read image file: {str(e)}",
            "crop": None,
            "disease": None,
            "confidence": 0.0
        }

    # 1. Image Quality Check
    quality_ok, quality_msg, quality_metrics = check_image_quality(image_bytes)
    if not quality_ok:
        return {
            "status": "image_quality_insufficient",
            "message": quality_msg,
            "crop": "Undetermined",
            "disease": "Not confidently identified",
            "confidence": 0.0,
            "is_supported": False,
            "is_ood": True,
            "quality_ok": False,
            "top_predictions": []
        }

    # 2. Leaf Localization / Segmentation
    np_buf = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
    cropped_bgr, bbox, foliar_ratio = localize_leaf_specimen(img_bgr)
    img_rgb = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img_rgb)

    # 3. Model Forward Pass
    model, class_names = load_disease_model_artifacts(model_path, class_names_path)
    transform = get_inference_transforms(image_size=224)
    input_tensor = transform(pil_img).unsqueeze(0).to(_DEVICE)

    with torch.no_grad():
        logits = model(input_tensor)

    # Build canonical class map for hierarchical resolver
    class_map = {}
    for idx, cname in enumerate(class_names):
        c_crop, c_dis = parse_class_name(cname)
        d_info = get_disease_info(c_crop, c_dis)
        class_map[idx] = {
            "id": idx,
            "name": cname,
            "crop": c_crop,
            "disease": c_dis,
            "status": "Healthy" if "healthy" in c_dis.lower() else "Diseased",
            "pathogen": d_info.get("pathogen", "N/A"),
            "symptoms": d_info.get("symptoms", "Foliar discoloration"),
            "precautions": [
                "Remove affected leaves to reduce spore spread",
                "Improve air circulation between plants",
                "Avoid overhead watering"
            ],
            "treatment": d_info.get("management", "Apply recommended protective treatments.")
        }

    hierarchical_res = predict_hierarchical(
        logits=logits,
        class_map=class_map,
        class_names=class_names,
        confidence_threshold=confidence_threshold,
        min_crop_confidence_floor=0.22
    )

    if hierarchical_res["status"] == "uncertain":
        is_supp = hierarchical_res.get("is_supported", False)
        crop_label = "Unsupported / Unknown" if not is_supp else "Undetermined"
        return {
            "status": "uncertain",
            "crop": crop_label,
            "disease": "Not confidently identified",
            "confidence": round(hierarchical_res["confidence"], 4),
            "crop_confidence": round(hierarchical_res.get("crop_confidence", 0.0), 4),
            "disease_confidence": round(hierarchical_res.get("disease_confidence", 0.0), 4),
            "top_crop": hierarchical_res.get("top_crop"),
            "top_crop_confidence": hierarchical_res.get("top_crop_confidence"),
            "second_crop": hierarchical_res.get("second_crop"),
            "second_crop_confidence": hierarchical_res.get("second_crop_confidence"),
            "crop_distribution": hierarchical_res.get("crop_distribution"),
            "is_supported": is_supp,
            "is_ood": hierarchical_res.get("is_ood", False),
            "quality_ok": True,
            "rejection_reason": hierarchical_res.get("rejection_reason"),
            "ood_score": hierarchical_res.get("ood_score", 0.85),
            "ood_status": hierarchical_res.get("ood_status", "out_of_distribution"),
            "top_predictions": []
        }

    top_crop = hierarchical_res["crop"]
    top_disease = hierarchical_res["disease"]
    crop_conf = round(hierarchical_res.get("crop_confidence", 0.0), 4)
    disease_conf = round(hierarchical_res.get("disease_confidence", 0.0), 4)

    if hierarchical_res["status"] == "Low Confidence":
        return {
            "status": "Low Confidence",
            "crop": top_crop,
            "crop_confidence": crop_conf,
            "disease": "Not confidently identified",
            "disease_confidence": disease_conf,
            "confidence": disease_conf,
            "class": None,
            "top_predictions": [],
            "pathogen": None,
            "symptoms": "Unable to determine symptoms with high confidence. Please upload a clearer, high-resolution leaf image in good natural daylight.",
            "prevention": "Inspect both upper and lower leaf surfaces for early signs of disease.",
            "management": "Consult a certified local agricultural extension officer before applying chemical treatments.",
            "advice": "Capture a closer, sharp foliar photograph in bright daylight.",
            "is_supported": True,
            "is_ood": False,
            "quality_ok": True,
            "ood_score": hierarchical_res.get("ood_score", 0.0),
            "ood_status": "in_distribution"
        }

    disease_info = get_disease_info(crop_name=top_crop, disease_name=top_disease)
    top_preds = [
        {
            "class": class_names[p["class_id"]] if p["class_id"] < len(class_names) else p["disease"],
            "crop": p["crop"],
            "disease": p["disease"],
            "confidence": round(p["confidence"], 4)
        }
        for p in hierarchical_res.get("top_predictions", [])[:top_k]
    ]

    return {
        "status": "success",
        "crop": top_crop,
        "crop_confidence": crop_conf,
        "disease": top_disease,
        "disease_confidence": disease_conf,
        "confidence": disease_conf,
        "class": hierarchical_res.get("canonical_disease", f"{top_crop}___{top_disease}"),
        "top_predictions": top_preds,
        "pathogen": disease_info.get("pathogen", "N/A"),
        "symptoms": disease_info.get("symptoms", ""),
        "prevention": disease_info.get("prevention", ""),
        "management": disease_info.get("management", ""),
        "advice": disease_info.get("farmer_advice", ""),
        "is_supported": True,
        "is_ood": False,
        "quality_ok": True,
        "ood_score": hierarchical_res.get("ood_score", 0.0),
        "ood_status": "in_distribution"
    }
