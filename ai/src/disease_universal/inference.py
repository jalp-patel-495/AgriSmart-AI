"""
AgriSmart AI – Universal Multi-Crop Disease Inference Pipeline
Implements the 7-Stage Hierarchical AI Diagnostic Workflow:
1. Image Quality Check
2. Leaf Localization & Foliar Cropping
3. Dedicated Crop/Plant Identification (Stage A)
4. Out-Of-Distribution / Species Rejection (Stage A OOD)
5. Crop-Specific Disease Classification (Stage B)
6. Confidence Calibration & 65% Safety Gate
7. Safe Diagnostic Result Assembly
"""

import os
import io
import json
import time
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional, Union

import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
import torchvision.transforms as T

from ai.src.disease.quality_gate import check_image_quality
from ai.src.disease.segmentation import localize_leaf_specimen
from ai.src.disease_universal.models import (
    CANONICAL_CROPS, CROP_DISEASES, UniversalHierarchicalPlantModel
)
from ai.src.disease_universal.ood import UniversalOODDetector

ROOT_DIR = Path(r"j:\AGRISMART_AI")
MODEL_DIR = ROOT_DIR / "models" / "disease_universal"
FALLBACK_MODEL_PATH = ROOT_DIR / "models" / "disease" / "best_model_robust.pt"

_CACHED_ENGINE = None
_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class UniversalInferenceEngine:
    def __init__(self, model_dir: Path = MODEL_DIR):
        self.model_dir = Path(model_dir)
        self.device = _DEVICE
        
        # 1. Load Registry & Taxonomy
        reg_path = self.model_dir / "class_registry.json"
        if not reg_path.exists():
            reg_path = ROOT_DIR / "dataset" / "class_registry.json"
        
        with open(reg_path, "r", encoding="utf-8") as f:
            self.registry = json.load(f)
            
        self.classes_list = self.registry["classes"]
        self.crops_list = self.registry["crops"]
        self.crop_names = [c["name"] for c in self.crops_list]
        self.crop_to_id = {c["name"]: c["id"] for c in self.crops_list}
        self.id_to_crop = {c["id"]: c["name"] for c in self.crops_list}
        
        # Map class metadata by (crop_name, disease_name)
        self.meta_by_crop_disease = {}
        for c in self.classes_list:
            key = (c["crop_name"].lower(), c["disease_name"].lower())
            self.meta_by_crop_disease[key] = c

        # 2. Load OOD Detector
        ood_cfg_path = self.model_dir / "ood" / "ood_calibration.json"
        energy_thresh = -2.5
        entropy_thresh = 0.82
        conf_floor = 0.22
        if ood_cfg_path.exists():
            try:
                with open(ood_cfg_path, "r", encoding="utf-8") as f:
                    ocfg = json.load(f)
                    energy_thresh = ocfg.get("energy_threshold", -2.5)
                    entropy_thresh = ocfg.get("entropy_threshold", 0.82)
                    conf_floor = ocfg.get("confidence_floor", 0.22)
            except Exception:
                pass
                
        self.ood_detector = UniversalOODDetector(
            energy_threshold=energy_thresh,
            entropy_threshold=entropy_thresh,
            confidence_floor=conf_floor
        )

        # 3. Load Trained Hierarchical Model
        self.model = None
        self.architecture = "efficientnet_b0"
        
        crop_model_path = self.model_dir / "best_crop_model.pt"
        disease_model_path = self.model_dir / "best_disease_model.pt"
        
        if crop_model_path.exists() and disease_model_path.exists():
            try:
                crop_ckpt = torch.load(crop_model_path, map_location=self.device, weights_only=False)
                disease_ckpt = torch.load(disease_model_path, map_location=self.device, weights_only=False)
                self.architecture = crop_ckpt.get("architecture", "efficientnet_b0")
                
                self.model = UniversalHierarchicalPlantModel(
                    architecture=self.architecture,
                    pretrained=False,
                    crop_names=self.crop_names,
                    crop_diseases=CROP_DISEASES
                )
                self.model.backbone.load_state_dict(crop_ckpt["backbone_state_dict"])
                self.model.crop_classifier.load_state_dict(crop_ckpt["crop_classifier_state_dict"])
                self.model.disease_heads.load_state_dict(disease_ckpt["disease_heads_state_dict"])
                self.model.to(self.device)
                self.model.eval()
                print(f"[*] Universal multi-crop model loaded successfully ({self.architecture}) covering {len(self.crop_names)} crops & {len(self.classes_list)} classes.")
            except Exception as e:
                print(f"[!] Warning loading universal model checkpoint: {e}")
                self.model = None

        # Transforms
        self.transform = T.Compose([
            T.Resize((256, 256)),
            T.CenterCrop((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def predict(
        self,
        image_input: Union[str, bytes, np.ndarray],
        confidence_threshold: float = 0.65,
        top_k: int = 3
    ) -> Dict[str, Any]:
        """
        Executes the full 7-stage diagnostic workflow on an uploaded leaf image.
        """
        start_time = time.time()
        
        # Decode image to bytes & numpy array
        if isinstance(image_input, str):
            with open(image_input, "rb") as f:
                image_bytes = f.read()
        elif isinstance(image_input, (bytes, bytearray)):
            image_bytes = bytes(image_input)
        elif isinstance(image_input, np.ndarray):
            _, buf = cv2.imencode(".jpg", image_input)
            image_bytes = buf.tobytes()
        else:
            raise ValueError("Unsupported image input type.")

        # ==========================================
        # STAGE 1: Image Quality Gate
        # ==========================================
        quality_ok, quality_msg, quality_metrics = check_image_quality(image_bytes)
        if not quality_ok:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": False,
                "crop": "Undetermined",
                "crop_confidence": 0.0,
                "crop_top_k": [],
                "disease": "Not confidently identified",
                "disease_confidence": 0.0,
                "confidence": 0.0,
                "confidence_score": 0.0,
                "status": "image_quality_insufficient",
                "quality_ok": False,
                "is_supported": False,
                "is_ood": True,
                "ood_score": 1.0,
                "ood_status": "quality_insufficient",
                "message": quality_msg or "Image quality insufficient. Please upload a clearer leaf image.",
                "pathogen": None,
                "symptoms": "Image quality does not meet foliar diagnostic standards. Please upload a clearer, well-lit image in bright natural daylight.",
                "precautions": [
                    "Upload a clearer, high-resolution leaf image",
                    "Ensure the leaf is well-lit in natural daylight without harsh glare or shadow",
                    "Capture a single leaf occupying the center of the frame against a plain background",
                    "Avoid excessive camera shake, blur, or severe background occlusion"
                ],
                "treatment": None,
                "top_predictions": [],
                "processing_time_ms": elapsed_ms
            }

        # ==========================================
        # STAGE 2: Leaf Localization / Segmentation
        # ==========================================
        np_buf = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
        cropped_leaf_bgr, bbox, foliar_ratio = localize_leaf_specimen(img_bgr)
        
        img_rgb = cv2.cvtColor(cropped_leaf_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        input_tensor = self.transform(pil_img).unsqueeze(0).to(self.device)

        # ==========================================
        # STAGE 3: Dedicated Crop Classification
        # ==========================================
        with torch.no_grad():
            features = self.model.extract_features(input_tensor)
            crop_logits = self.model.predict_crop(features)
            crop_probs = F.softmax(crop_logits, dim=-1)[0]
            
        sorted_probs, sorted_indices = torch.sort(crop_probs, descending=True)
        top_crop_idx = int(sorted_indices[0].item())
        top_crop_name = self.crop_names[top_crop_idx]
        top_crop_conf = float(sorted_probs[0].item())
        
        crop_top_k = [
            {"crop": self.crop_names[int(idx.item())], "confidence": round(float(prob.item()), 4)}
            for prob, idx in zip(sorted_probs[:3], sorted_indices[:3])
        ]

        # ==========================================
        # STAGE 4: Unknown / OOD Detection
        # ==========================================
        ood_res = self.ood_detector.evaluate_crop_prediction(
            crop_logits=crop_logits[0],
            crop_probs=crop_probs,
            crop_names=self.crop_names
        )
        
        is_ood = ood_res["is_ood"]
        ood_score = ood_res["ood_score"]
        ood_status = ood_res["ood_status"]
        
        if is_ood:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": True,
                "crop": "Unsupported / Unknown",
                "crop_confidence": round(top_crop_conf, 4),
                "crop_top_k": crop_top_k,
                "disease": "Not confidently identified",
                "disease_confidence": 0.0,
                "confidence": 0.0,
                "confidence_score": 0.0,
                "status": "Low Confidence",
                "quality_ok": True,
                "is_supported": False,
                "is_ood": True,
                "ood_score": ood_score,
                "ood_status": ood_status,
                "message": "The uploaded specimen could not be verified as a supported crop species.",
                "pathogen": None,
                "symptoms": "Specimen appears out of distribution or unsupported crop species. Please verify plant type.",
                "precautions": [
                    "Ensure the photo shows a clear leaf from a supported agricultural crop",
                    "Take a focused photograph in bright natural daylight",
                    "Avoid photographing non-plant objects, human hands, or complex clutter"
                ],
                "treatment": None,
                "top_predictions": [],
                "processing_time_ms": elapsed_ms
            }

        # ==========================================
        # STAGE 5: Crop-Specific Disease Classification
        # ==========================================
        # Only evaluate diseases belonging to the identified crop!
        with torch.no_grad():
            disease_logits = self.model.predict_disease_for_crop(features, top_crop_name)
            disease_probs = F.softmax(disease_logits, dim=-1)[0]
            
        crop_disease_names = CROP_DISEASES[top_crop_name]
        sorted_d_probs, sorted_d_indices = torch.sort(disease_probs, descending=True)
        top_d_idx = int(sorted_d_indices[0].item())
        top_disease_name = crop_disease_names[top_d_idx]
        top_disease_conf = float(sorted_d_probs[0].item())

        top_predictions = [
            {
                "crop": top_crop_name,
                "disease": crop_disease_names[int(idx.item())],
                "confidence": round(float(prob.item()), 4),
                "class": f"{top_crop_name}___{crop_disease_names[int(idx.item())]}".replace(" ", "_")
            }
            for prob, idx in zip(sorted_d_probs[:top_k], sorted_d_indices[:top_k])
        ]

        # Retrieve rich metadata from registry
        meta_key = (top_crop_name.lower(), top_disease_name.lower())
        disease_meta = self.meta_by_crop_disease.get(meta_key, {})

        # ==========================================
        # STAGE 6 & 7: Confidence Calibration & Safe Diagnostic Result
        # ==========================================
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        
        # STRICT 65% SAFETY GATE
        if top_disease_conf < confidence_threshold:
            # Preserve detected crop species, mark disease as unconfirmed
            return {
                "success": True,
                "crop": top_crop_name,
                "crop_confidence": round(top_crop_conf, 4),
                "crop_top_k": crop_top_k,
                "disease": "Not confidently identified",
                "disease_confidence": round(top_disease_conf, 4),
                "confidence": round(top_disease_conf, 4),
                "confidence_score": round(top_disease_conf, 4),
                "status": "Low Confidence",
                "quality_ok": True,
                "is_supported": True,
                "is_ood": False,
                "ood_score": ood_score,
                "ood_status": "in_distribution",
                "message": f"Supported crop '{top_crop_name}' identified, but disease confidence is below the 65% safety gate.",
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
                "processing_time_ms": elapsed_ms
            }

        # Confident Result (>= 65%)
        is_healthy = "healthy" in top_disease_name.lower()
        status_str = "Healthy" if is_healthy else "Diseased"
        
        return {
            "success": True,
            "crop": top_crop_name,
            "crop_confidence": round(top_crop_conf, 4),
            "crop_top_k": crop_top_k,
            "disease": top_disease_name,
            "disease_confidence": round(top_disease_conf, 4),
            "confidence": round(top_disease_conf, 4),
            "confidence_score": round(top_disease_conf, 4),
            "status": status_str,
            "quality_ok": True,
            "is_supported": True,
            "is_ood": False,
            "ood_score": ood_score,
            "ood_status": "in_distribution",
            "message": f"Verified diagnostic diagnosis for {top_crop_name}.",
            "pathogen": disease_meta.get("pathogen"),
            "symptoms": disease_meta.get("symptoms", ""),
            "prevention": disease_meta.get("prevention", ""),
            "management": disease_meta.get("management", ""),
            "advice": disease_meta.get("management", ""),
            "canonical_disease": f"{top_crop_name}___{top_disease_name}".replace(" ", "_"),
            "top_predictions": top_predictions,
            "processing_time_ms": elapsed_ms
        }


def get_universal_engine() -> UniversalInferenceEngine:
    global _CACHED_ENGINE
    if _CACHED_ENGINE is None:
        _CACHED_ENGINE = UniversalInferenceEngine()
    return _CACHED_ENGINE


def predict_universal(
    image_input: Union[str, bytes, np.ndarray],
    confidence_threshold: float = 0.65,
    top_k: int = 3
) -> Dict[str, Any]:
    """Top-level convenience prediction function."""
    engine = get_universal_engine()
    return engine.predict(
        image_input=image_input,
        confidence_threshold=confidence_threshold,
        top_k=top_k
    )
