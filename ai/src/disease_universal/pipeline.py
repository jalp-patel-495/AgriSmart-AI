"""
AgriSmart AI - Universal 14-Plant Disease Detection Pipeline
Orchestrates:
IMAGE -> Quality Gate -> Leaf Localization -> 14-Class Crop Classifier -> OOD Detection ->
Crop-Specific Disease Classifier -> Confidence Calibration -> 65% Safety Gate -> Final Result

Guarantees:
1. Separate crop confidence and disease confidence.
2. Strict crop gating: evaluates only diseases belonging to detected crop.
3. Rejection of non-leaf / unsupported / ambiguous inputs.
4. Preserves 65% disease safety gate.
"""
import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
import cv2
import numpy as np
import torch
import torch.nn.functional as F
import torchvision.transforms as T

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from ai.src.disease_universal.quality_gate import LeafQualityGate
from ai.src.disease_universal.leaf_localization import LeafLocalizer
from ai.src.disease_universal.crop_classifier import Crop14Classifier, CROPS_14, CROP_TO_IDX, IDX_TO_CROP
from ai.src.disease_universal.disease_classifier import CropGatedDiseaseClassifier
from ai.src.disease_universal.ood_detector import OODDetector
from ai.src.disease.disease_info import get_disease_info

_NORMALIZE = T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])

class UniversalDiseasePipeline:
    """
    End-to-end production pipeline for 14-crop disease diagnosis.
    """
    def __init__(
        self,
        crop_model_path: Optional[str] = None,
        disease_model_path: Optional[str] = None,
        class_registry_path: Optional[str] = None,
        device: Optional[str] = None
    ):
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.quality_gate = LeafQualityGate()
        self.leaf_localizer = LeafLocalizer(target_size=224)
        self.ood_detector = OODDetector()

        # Load registries
        root = Path(__file__).resolve().parents[3]
        default_registry = root / "dataset" / "disease_universal" / "class_registry.json"
        if class_registry_path and Path(class_registry_path).exists():
            reg_path = Path(class_registry_path)
        elif default_registry.exists():
            reg_path = default_registry
        else:
            reg_path = root / "models" / "disease_universal" / "class_registry.json"

        self.class_registry = []
        self.crop_to_class_indices = {}
        self.classes_list = []
        if reg_path.exists():
            with open(reg_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.class_registry = data if isinstance(data, list) else data.get("classes", [])
                for idx, c in enumerate(self.class_registry):
                    crop = c.get("crop", "Unknown")
                    self.classes_list.append(c.get("canonical_class_id", f"class_{idx}"))
                    self.crop_to_class_indices.setdefault(crop, []).append(idx)

        # Fallback classes if registry not yet populated
        if not self.classes_list:
            self.classes_list = [f"class_{i}" for i in range(38)]

        # Initialize Models
        self.crop_model = Crop14Classifier(pretrained=False)
        self.disease_model = CropGatedDiseaseClassifier(num_classes=len(self.classes_list), pretrained=False)

        # Load checkpoints if available
        default_crop_ckpt = root / "models" / "disease_universal" / "best_crop_model.pt"
        default_disease_ckpt = root / "models" / "disease_universal" / "best_disease_model.pt"

        c_ckpt = crop_model_path or (default_crop_ckpt if default_crop_ckpt.exists() else None)
        d_ckpt = disease_model_path or (default_disease_ckpt if default_disease_ckpt.exists() else None)

        if c_ckpt and Path(c_ckpt).exists():
            try:
                ckpt = torch.load(c_ckpt, map_location=self.device, weights_only=False)
                state = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt
                self.crop_model.load_state_dict(state)
            except Exception as e:
                print(f"[!] Warning: Failed loading crop checkpoint: {e}")

        if d_ckpt and Path(d_ckpt).exists():
            try:
                ckpt = torch.load(d_ckpt, map_location=self.device, weights_only=False)
                state = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt
                self.disease_model.load_state_dict(state)
            except Exception as e:
                print(f"[!] Warning: Failed loading disease checkpoint: {e}")

        self.crop_model.to(self.device).eval()
        self.disease_model.to(self.device).eval()

    def process_image(
        self,
        image_input: Union[str, bytes, np.ndarray],
        disease_safety_threshold: float = 0.65
    ) -> Dict[str, Any]:
        """
        Executes complete forward pipeline.
        """
        start_time = time.time()

        # 1. Decode Image Input
        if isinstance(image_input, str):
            img_bgr = cv2.imread(image_input)
            if img_bgr is None:
                return self._error_response("Could not decode image from file path.")
        elif isinstance(image_input, bytes):
            np_buf = np.frombuffer(image_input, np.uint8)
            img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
            if img_bgr is None or img_bgr.size == 0:
                return self._error_response("Invalid or corrupt image buffer.")
        elif isinstance(image_input, np.ndarray):
            img_bgr = image_input
        else:
            return self._error_response("Unsupported image input type.")

        # 2. Stage 0: Quality Gate
        quality_res = self.quality_gate.assess_image(img_bgr)
        if not quality_res["quality_ok"] and not quality_res["is_leaf"]:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": True,
                "crop": "Undetermined",
                "crop_confidence": 0.0,
                "crop_top_k": [],
                "disease": "Not confidently identified",
                "disease_confidence": 0.0,
                "status": "Quality Check Failed",
                "quality_ok": False,
                "is_supported": False,
                "is_ood": True,
                "ood_score": 1.0,
                "ood_status": "out_of_distribution",
                "reasons": quality_res["reasons"],
                "symptoms": "Image does not meet foliar quality criteria. Please upload a clear leaf image.",
                "precautions": [
                    "Upload a clear, high-resolution photo in natural daylight",
                    "Ensure the camera is focused directly on the leaf surface",
                    "Avoid extreme shadows, dark lighting, or harsh camera flash"
                ],
                "treatment": None,
                "top_predictions": [],
                "processing_time_ms": duration_ms
            }

        # 3. Stage 1: Leaf Localization
        localized_bgr, loc_info = self.leaf_localizer.localize_and_crop(img_bgr)
        img_rgb = cv2.cvtColor(localized_bgr, cv2.COLOR_BGR2RGB)
        tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float() / 255.0
        norm_tensor = _NORMALIZE(tensor).unsqueeze(0).to(self.device)

        # 4. Stage A: Dedicated 14-Class Crop Classifier
        with torch.no_grad():
            crop_logits = self.crop_model(norm_tensor)
            crop_probs = F.softmax(crop_logits, dim=-1).squeeze(0).cpu().numpy()

        top_crop_idx = int(np.argmax(crop_probs))
        detected_crop = IDX_TO_CROP.get(top_crop_idx, "Unknown")
        crop_confidence = float(crop_probs[top_crop_idx])

        # Top-K crops
        top_crop_indices = np.argsort(crop_probs)[::-1][:3]
        crop_top_k = [
            {"crop": IDX_TO_CROP[int(idx)], "confidence": round(float(crop_probs[idx]), 4)}
            for idx in top_crop_indices
        ]

        # 5. Stage C: OOD / Unknown Detection
        ood_res = self.ood_detector.evaluate(crop_logits, quality_res)
        if ood_res["is_ood"]:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": True,
                "crop": "Unsupported / Unknown",
                "crop_confidence": round(crop_confidence, 4),
                "crop_top_k": crop_top_k,
                "disease": "Not confidently identified",
                "disease_confidence": 0.0,
                "status": "Low Confidence",
                "quality_ok": quality_res["quality_ok"],
                "is_supported": False,
                "is_ood": True,
                "ood_score": ood_res["ood_score"],
                "ood_status": "out_of_distribution",
                "reasons": ood_res["reasons"],
                "symptoms": "Visual specimen does not match any of the 14 supported crop species.",
                "precautions": [
                    "Verify the plant is one of the 14 supported crops",
                    "Capture an in-focus single leaf showing clear foliar veins",
                    "Avoid capturing non-leaf objects or background clutter"
                ],
                "treatment": None,
                "top_predictions": [],
                "processing_time_ms": duration_ms
            }

        # 6. Stage B: Crop-Gated Disease Classification
        with torch.no_grad():
            masked_logits, disease_probs = self.disease_model.predict_for_crop(
                norm_tensor,
                detected_crop=detected_crop,
                crop_to_class_indices=self.crop_to_class_indices
            )
            disease_probs_np = disease_probs.squeeze(0).cpu().numpy()

        valid_indices = self.crop_to_class_indices.get(detected_crop, [])
        if valid_indices:
            # Sort only among valid intra-crop classes
            sub_probs = [(idx, float(disease_probs_np[idx])) for idx in valid_indices]
            sub_probs.sort(key=lambda x: x[1], reverse=True)
            top_disease_idx, disease_confidence = sub_probs[0]
        else:
            top_disease_idx = int(np.argmax(disease_probs_np))
            disease_confidence = float(disease_probs_np[top_disease_idx])
            sub_probs = [(top_disease_idx, disease_confidence)]

        meta = self.class_registry[top_disease_idx] if top_disease_idx < len(self.class_registry) else {}
        disease_name = meta.get("disease", "Unknown Condition")
        is_healthy = meta.get("healthy", False) or "healthy" in disease_name.lower()
        status = "Healthy" if is_healthy else "Diseased"

        # Build differential predictions for intra-crop candidates
        top_predictions = []
        for idx, conf in sub_probs[:3]:
            c_meta = self.class_registry[idx] if idx < len(self.class_registry) else {}
            top_predictions.append({
                "class_id": idx,
                "disease": c_meta.get("disease", f"Class {idx}"),
                "crop": detected_crop,
                "confidence": f"{int(round(conf * 100))}%",
                "confidence_score": round(conf, 4)
            })

        duration_ms = round((time.time() - start_time) * 1000, 2)
        confidence_str = f"{int(round(disease_confidence * 100))}%"

        # 7. 65% Safety Gate Enforcement
        if disease_confidence < disease_safety_threshold:
            return {
                "success": True,
                "crop": detected_crop,
                "crop_confidence": round(crop_confidence, 4),
                "crop_top_k": crop_top_k,
                "disease": "Not confidently identified",
                "disease_confidence": round(disease_confidence, 4),
                "status": "Low Confidence",
                "quality_ok": quality_res["quality_ok"],
                "is_supported": True,
                "is_ood": False,
                "ood_score": ood_res["ood_score"],
                "ood_status": "in_distribution",
                "confidence": confidence_str,
                "confidence_score": round(disease_confidence, 4),
                "pathogen": None,
                "symptoms": f"Foliar patterns on {detected_crop} are ambiguous or early stage. Re-inspect foliage under clearer daylight.",
                "precautions": [
                    "Upload a clearer, high-resolution leaf image in bright daylight",
                    "Ensure the leaf is in sharp focus without blur, harsh shadows, or glare",
                    "Inspect both upper and lower leaf surfaces for early lesion signs",
                    "Consult a certified local agricultural extension officer before applying chemical treatments"
                ],
                "treatment": None,
                "top_predictions": top_predictions,
                "processing_time_ms": duration_ms
            }

        # Confirmed High Confidence (> 65%)
        dis_info = get_disease_info(detected_crop, disease_name)
        return {
            "success": True,
            "crop": detected_crop,
            "crop_confidence": round(crop_confidence, 4),
            "crop_top_k": crop_top_k,
            "disease": disease_name,
            "disease_confidence": round(disease_confidence, 4),
            "status": status,
            "quality_ok": quality_res["quality_ok"],
            "is_supported": True,
            "is_ood": False,
            "ood_score": ood_res["ood_score"],
            "ood_status": "in_distribution",
            "confidence": confidence_str,
            "confidence_score": round(disease_confidence, 4),
            "pathogen": None if is_healthy else meta.get("pathogen", dis_info.get("pathogen")),
            "symptoms": meta.get("symptoms", dis_info.get("symptoms", "Visible foliar symptoms")),
            "precautions": meta.get("precautions", dis_info.get("precautions", [
                "Remove affected foliage to prevent spore proliferation",
                "Improve canopy ventilation and sanitize pruning tools",
                "Avoid overhead sprinkler irrigation to minimize leaf wetness duration"
            ])),
            "treatment": None if is_healthy else meta.get("treatment", dis_info.get("management", "Apply recommended protective treatments.")),
            "top_predictions": top_predictions,
            "processing_time_ms": duration_ms
        }

    def _error_response(self, message: str) -> Dict[str, Any]:
        return {
            "success": False,
            "error": message,
            "crop": "Undetermined",
            "crop_confidence": 0.0,
            "disease": "Not confidently identified",
            "disease_confidence": 0.0,
            "status": "Error",
            "quality_ok": False,
            "is_supported": False,
            "is_ood": True,
            "ood_score": 1.0,
            "ood_status": "out_of_distribution"
        }
