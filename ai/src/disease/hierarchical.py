"""
AgriSmart AI – Hierarchical Crop-Disease Detection Pipeline
Implements two-stage inference:
Stage A: Leaf Image -> Supported Crop Species (Apple, Bell Pepper, Corn, Grape, Peach, Potato, Tomato)
Stage B: Detected Crop + Leaf Image -> Disease/Healthy within detected crop species

Eliminates cross-crop confusion (e.g. Apple leaf can NEVER produce Grape Black Rot).
Enforces unknown/unsupported rejection and model-based OOD detection without conflating
disease uncertainty with crop rejection.
"""
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import torch
import torch.nn.functional as F

from ai.src.disease.ood_detector import evaluate_ood_status


# The 14 canonical PlantVillage supported crops
SUPPORTED_CROPS = [
    "Apple",
    "Blueberry",
    "Cherry",
    "Corn",
    "Grape",
    "Orange",
    "Peach",
    "Bell Pepper",
    "Potato",
    "Raspberry",
    "Soybean",
    "Squash",
    "Strawberry",
    "Tomato"
]


def build_crop_classes_mapping(class_names: List[str]) -> Tuple[Dict[str, List[int]], Dict[str, Optional[int]]]:
    """
    Dynamically maps class names to supported crops and healthy class indices,
    strictly preserving canonical checkpoint indices without alphabetical reordering.
    """
    crop_classes: Dict[str, List[int]] = {c: [] for c in SUPPORTED_CROPS}
    healthy_map: Dict[str, Optional[int]] = {c: None for c in SUPPORTED_CROPS}

    for idx, cname in enumerate(class_names):
        c_low = cname.lower()
        matched_crop = None
        if "apple" in c_low:
            matched_crop = "Apple"
        elif "blueberry" in c_low:
            matched_crop = "Blueberry"
        elif "cherry" in c_low:
            matched_crop = "Cherry"
        elif "corn" in c_low or "maize" in c_low:
            matched_crop = "Corn"
        elif "grape" in c_low:
            matched_crop = "Grape"
        elif "orange" in c_low:
            matched_crop = "Orange"
        elif "peach" in c_low:
            matched_crop = "Peach"
        elif "bell_pepper" in c_low or "pepper" in c_low:
            matched_crop = "Bell Pepper"
        elif "potato" in c_low:
            matched_crop = "Potato"
        elif "raspberry" in c_low:
            matched_crop = "Raspberry"
        elif "soybean" in c_low:
            matched_crop = "Soybean"
        elif "squash" in c_low:
            matched_crop = "Squash"
        elif "strawberry" in c_low:
            matched_crop = "Strawberry"
        elif "tomato" in c_low:
            matched_crop = "Tomato"

        if matched_crop:
            crop_classes[matched_crop].append(idx)
            if "healthy" in c_low:
                healthy_map[matched_crop] = idx

    return crop_classes, healthy_map


def predict_hierarchical(
    logits: torch.Tensor,
    class_map: Dict[int, dict],
    class_names: List[str],
    confidence_threshold: float = 0.65,
    min_crop_confidence_floor: float = 0.22
) -> Dict[str, Any]:
    """
    Executes hierarchical crop-disease inference strictly separating:
    Decision A: Image Quality (handled upstream)
    Decision B: Crop Species Identification & OOD Evaluation (Stage A)
    Decision C: Conditional Disease Classification within Detected Crop (Stage B)

    Safe Result Rules:
    CASE 2 — Genuine OOD:
        Crop = "Unsupported / Unknown", Disease = "Not confidently identified"
    CASE 3 — Supported crop, low disease confidence (< 65%):
        Crop = detected supported crop, Disease = "Not confidently identified", Status = "Low Confidence"
    CASE 4 — Supported crop, high disease confidence (>= 65%):
        Crop = detected supported crop, Disease = actual disease/healthy class
    """
    if logits.ndim == 1:
        logits = logits.unsqueeze(0)

    raw_probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()
    crop_classes_map, healthy_map = build_crop_classes_mapping(class_names)

    # 1. Stage A: 7-Crop Probability Aggregation
    # crop_score = sum of the probabilities belonging to that crop's classes
    crop_scores: Dict[str, float] = {}
    for crop_name in SUPPORTED_CROPS:
        cids = crop_classes_map.get(crop_name, [])
        crop_scores[crop_name] = float(sum(raw_probs[cid] for cid in cids)) if cids else 0.0

    sorted_crops = sorted(crop_scores.items(), key=lambda x: x[1], reverse=True)
    best_crop, crop_confidence = sorted_crops[0]
    runner_up_crop, runner_up_confidence = sorted_crops[1]

    # 2. Model-Based OOD Evaluation on Crop Level (Never on disease confidence alone)
    is_ood, ood_reason, ood_metrics = evaluate_ood_status(
        logits=logits,
        probabilities=raw_probs,
        crop_confidence=crop_confidence,
        min_crop_confidence_floor=min_crop_confidence_floor
    )

    top_disease_raw_id = int(np.argmax(raw_probs))
    top_disease_raw_conf = float(raw_probs[top_disease_raw_id])

    # 3. CASE 2: Genuine OOD Check
    # Reject as Unsupported/Unknown ONLY if there is genuine evidence the image is outside supported crop distribution
    if is_ood or crop_confidence < min_crop_confidence_floor:
        return {
            "status": "uncertain",
            "crop": "Unsupported / Unknown",
            "crop_confidence": round(crop_confidence, 4),
            "disease": "Not confidently identified",
            "disease_confidence": round(top_disease_raw_conf, 4),
            "confidence": round(top_disease_raw_conf, 4),
            "top_crop": best_crop,
            "top_crop_confidence": round(crop_confidence, 4),
            "second_crop": runner_up_crop,
            "second_crop_confidence": round(runner_up_confidence, 4),
            "crop_distribution": {k: round(v, 4) for k, v in crop_scores.items()},
            "status_str": "Low Confidence",
            "is_supported": False,
            "is_ood": True,
            "quality_ok": True,
            "rejection_reason": ood_reason if is_ood else f"Crop evidence ({crop_confidence:.2%}) below minimum floor of {min_crop_confidence_floor:.2%}.",
            "ood_score": ood_metrics.get("ood_score", 0.85),
            "ood_status": "out_of_distribution",
            "top_predictions": []
        }

    # 4. Stage B: Conditional Disease Classification strictly within identified supported crop
    crop_class_ids = crop_classes_map.get(best_crop, [])
    crop_raw_prob_sum = sum(raw_probs[cid] for cid in crop_class_ids)

    conditional_probs = {}
    for cid in crop_class_ids:
        conditional_probs[cid] = raw_probs[cid] / crop_raw_prob_sum if crop_raw_prob_sum > 0 else 0.0

    sorted_diseases = sorted(conditional_probs.items(), key=lambda x: x[1], reverse=True)
    top_disease_id, top_cond_conf = sorted_diseases[0]

    # Overall calibrated disease confidence
    disease_confidence = float(raw_probs[top_disease_id])

    # 5. Healthy vs. Diseased Logic within detected crop
    healthy_cid = healthy_map.get(best_crop)
    is_predicted_healthy = (top_disease_id == healthy_cid)

    if not is_predicted_healthy and healthy_cid is not None:
        healthy_cond_conf = conditional_probs.get(healthy_cid, 0.0)
        # If disease does not clearly beat healthy by a significant margin, treat cautiously
        if top_cond_conf < (healthy_cond_conf + 0.15) and disease_confidence < confidence_threshold:
            top_disease_id = healthy_cid
            is_predicted_healthy = True
            top_cond_conf = healthy_cond_conf
            disease_confidence = float(raw_probs[healthy_cid])

    top_meta = class_map.get(top_disease_id, {})
    resolved_disease_name = top_meta.get("disease", class_names[top_disease_id] if top_disease_id < len(class_names) else f"Class_{top_disease_id}")

    # Build conditional top predictions strictly within detected crop
    top_predictions = []
    for cid, c_conf in sorted_diseases:
        meta = class_map.get(cid, {})
        top_predictions.append({
            "class_id": cid,
            "crop": best_crop,
            "disease": meta.get("disease", class_names[cid]),
            "confidence": round(float(raw_probs[cid]), 4),
            "conditional_confidence": round(float(c_conf), 4)
        })

    # 6. CASE 3: Supported crop BUT disease confidence < 65%
    # Preserve detected crop species, set Disease: Not confidently identified
    if disease_confidence < confidence_threshold:
        return {
            "status": "Low Confidence",
            "crop": best_crop,
            "crop_confidence": round(crop_confidence, 4),
            "disease": "Not confidently identified",
            "disease_confidence": round(disease_confidence, 4),
            "confidence": round(disease_confidence, 4),
            "top_crop": best_crop,
            "top_crop_confidence": round(crop_confidence, 4),
            "second_crop": runner_up_crop,
            "second_crop_confidence": round(runner_up_confidence, 4),
            "crop_distribution": {k: round(v, 4) for k, v in crop_scores.items()},
            "status_str": "Low Confidence",
            "is_supported": True,
            "is_ood": False,
            "quality_ok": True,
            "pathogen": None,
            "symptoms": "Unable to determine symptoms with high confidence. Please upload a clearer, high-resolution leaf image in good natural daylight.",
            "precautions": [
                "Upload a clearer, high-resolution leaf image in bright daylight",
                "Ensure the leaf is in sharp focus without blur, harsh shadows, or glare",
                "Capture the entire leaf surface against a plain background",
                "Consult a certified local agricultural extension officer before applying chemical treatments"
            ],
            "treatment": None,
            "top_predictions": [],
            "canonical_disease": None,
            "ood_score": ood_metrics.get("ood_score", 0.25),
            "ood_status": "in_distribution"
        }

    # 7. CASE 4: Supported crop AND disease confidence >= 65%
    return {
        "status": "success",
        "crop": best_crop,
        "crop_confidence": round(crop_confidence, 4),
        "disease": resolved_disease_name,
        "disease_confidence": round(disease_confidence, 4),
        "confidence": round(disease_confidence, 4),
        "top_crop": best_crop,
        "top_crop_confidence": round(crop_confidence, 4),
        "second_crop": runner_up_crop,
        "second_crop_confidence": round(runner_up_confidence, 4),
        "crop_distribution": {k: round(v, 4) for k, v in crop_scores.items()},
        "status_str": "Healthy" if is_predicted_healthy else "Diseased",
        "is_supported": True,
        "is_ood": False,
        "quality_ok": True,
        "canonical_disease": class_names[top_disease_id] if top_disease_id < len(class_names) else f"Class_{top_disease_id}",
        "pathogen": top_meta.get("pathogen") if not is_predicted_healthy else None,
        "symptoms": top_meta.get("symptoms", "Foliar inspection complete."),
        "precautions": top_meta.get("precautions", [
            "Remove affected leaves to reduce spore spread",
            "Improve air circulation between plants",
            "Avoid overhead watering"
        ]),
        "treatment": top_meta.get("treatment") if not is_predicted_healthy else None,
        "top_predictions": top_predictions,
        "ood_score": ood_metrics.get("ood_score", 0.10),
        "ood_status": "in_distribution"
    }
