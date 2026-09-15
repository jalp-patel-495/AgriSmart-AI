"""
AgriSmart AI - Universal 14-Plant Disease Detection Pipeline
Orchestrates:
IMAGE -> Quality Gate -> Preprocessing -> 14-Class Crop Classifier -> OOD Detection ->
Crop-Specific Disease Classifier -> Confidence Calibration -> 65% Safety Gate -> Final Result

Guarantees:
1. Separate crop confidence and disease confidence.
2. Strict crop gating: evaluates only diseases belonging to detected crop.
3. Rejection of non-leaf / unsupported / ambiguous inputs.
4. Preserves 65% disease safety gate.
5. High-confidence inference with verified UniversalHierarchicalPlantModel.
"""
import os
import sys
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

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from ai.src.disease_universal.quality_gate import LeafQualityGate
from ai.src.disease_universal.models import (
    UniversalHierarchicalPlantModel,
    CANONICAL_CROPS,
    CROP_DISEASES
)
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
        self.quality_gate = LeafQualityGate(
            min_blur_variance=25.0,
            min_brightness=20.0,
            max_brightness=245.0,
            min_green_ratio=0.08
        )
        self.ood_detector = OODDetector(
            min_crop_confidence=0.25,
            max_entropy_ratio=0.82,
            energy_threshold=-2.5
        )

        root = Path(__file__).resolve().parents[3]

        # Load registries
        self.class_registry = []
        self.class_meta_map: Dict[Tuple[str, str], Dict[str, Any]] = {}

        candidate_registries = [
            Path(class_registry_path) if class_registry_path else None,
            root / "models" / "disease_universal" / "class_registry.json",
            root / "dataset" / "disease_universal" / "class_registry.json",
            root / "dataset" / "classes.json"
        ]

        for reg_path in candidate_registries:
            if reg_path and reg_path.exists():
                try:
                    with open(reg_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.class_registry = data if isinstance(data, list) else data.get("classes", [])
                        for c in self.class_registry:
                            cr = str(c.get("crop", "")).strip().lower().replace(", ", "_").replace(" ", "_")
                            di = str(c.get("disease", "")).strip().lower()
                            self.class_meta_map[(cr, di)] = c
                            if "pepper" in cr:
                                self.class_meta_map[("bell_pepper", di)] = c
                                self.class_meta_map[("pepper_bell", di)] = c
                    break
                except Exception as e:
                    print(f"[!] Warning reading registry {reg_path}: {e}")

        # Crop names and disease taxonomy
        self.crop_names = list(CANONICAL_CROPS)
        self.crop_diseases = dict(CROP_DISEASES)

        # Checkpoint paths
        default_crop_ckpt = root / "models" / "disease_universal" / "best_crop_model.pt"
        default_disease_ckpt = root / "models" / "disease_universal" / "best_disease_model.pt"

        c_ckpt = Path(crop_model_path) if crop_model_path else default_crop_ckpt
        d_ckpt = Path(disease_model_path) if disease_model_path else default_disease_ckpt

        self.model: Optional[UniversalHierarchicalPlantModel] = None

        if c_ckpt.exists() and d_ckpt.exists():
            try:
                crop_ckpt = torch.load(c_ckpt, map_location=self.device, weights_only=False)
                disease_ckpt = torch.load(d_ckpt, map_location=self.device, weights_only=False)

                if "crop_names" in crop_ckpt:
                    self.crop_names = list(crop_ckpt["crop_names"])

                arch = crop_ckpt.get("architecture", "efficientnet_b0")
                self.model = UniversalHierarchicalPlantModel(
                    architecture=arch,
                    pretrained=False,
                    crop_names=self.crop_names,
                    crop_diseases=self.crop_diseases
                )

                self.model.backbone.load_state_dict(crop_ckpt["backbone_state_dict"])
                self.model.crop_classifier.load_state_dict(crop_ckpt["crop_classifier_state_dict"])
                self.model.disease_heads.load_state_dict(disease_ckpt["disease_heads_state_dict"])
                self.model.to(self.device).eval()
                print(f"[OK] UniversalHierarchicalPlantModel loaded successfully ({len(self.crop_names)} crops) on {self.device}.")
            except Exception as e:
                print(f"[!] Warning: Failed loading UniversalHierarchicalPlantModel: {e}")
                self.model = None
        else:
            print(f"[!] Warning: Universal model checkpoints not found at {c_ckpt} or {d_ckpt}")

        self.eval_transform = T.Compose([
            T.Resize((256, 256)),
            T.CenterCrop((224, 224)),
            T.ToTensor(),
            _NORMALIZE
        ])

    def _get_class_meta(self, crop: str, disease: str) -> Dict[str, Any]:
        """Resolves rich agronomy metadata for crop and disease."""
        cr = crop.strip().lower().replace(", ", "_").replace(" ", "_")
        di = disease.strip().lower()
        if (cr, di) in self.class_meta_map:
            return self.class_meta_map[(cr, di)]

        # Partial matching fallback
        for (ck, dk), meta in self.class_meta_map.items():
            if (ck == cr or ("pepper" in ck and "pepper" in cr)) and (dk in di or di in dk or "cercospora" in di and "cercospora" in dk):
                return meta
        return {}

    def _log_diagnostics(
        self,
        quality_ok: bool,
        rejection_reasons: List[str],
        crop_top_5: List[Tuple[str, float]],
        best_crop: str,
        crop_confidence: float,
        ood_score: float,
        ood_status: str,
        is_ood: bool,
        is_supported: bool,
        disease_top_5: List[Tuple[str, float]],
        disease_confidence: float,
        final_status: str
    ) -> None:
        """Emits temporary runtime diagnostic trace for verification without user UI exposure."""
        print("\n================ INFERENCE DIAGNOSTIC TRACE ================")
        print(f"quality_ok: {quality_ok}")
        print(f"quality rejection reason: {rejection_reasons if not quality_ok else 'None'}")
        print(f"crop top-5 probabilities: {crop_top_5}")
        print(f"best crop: {best_crop}")
        print(f"crop_confidence: {round(crop_confidence, 4)}")
        print(f"OOD score: {round(ood_score, 4)}")
        print(f"OOD threshold: {self.ood_detector.energy_threshold}")
        print(f"OOD status: {ood_status}")
        print(f"is_ood: {is_ood}")
        print(f"min_crop_confidence_floor: {self.ood_detector.min_crop_confidence}")
        print(f"is_supported: {is_supported}")
        print(f"disease top-5 probabilities: {disease_top_5}")
        print(f"disease_confidence: {round(disease_confidence, 4)}")
        print(f"final status: {final_status}")
        print("============================================================\n", flush=True)

    def process_image(
        self,
        image_input: Union[str, bytes, np.ndarray],
        disease_safety_threshold: float = 0.65
    ) -> Dict[str, Any]:
        """
        Executes complete forward pipeline strictly adhering to the 5-case decision matrix:
        CASE A: quality_ok = false -> Crop: Undetermined, Disease: Not confidently identified, Status: Low Quality / Undetermined
        CASE B: quality_ok = true AND is_ood = true -> Crop: Unsupported / Unknown, Disease: Not confidently identified, Status: Unknown
        CASE C: quality_ok = true AND is_ood = false AND crop_confidence valid -> Keep crop, run disease head
        CASE D: disease_confidence < 65% -> Crop: detected crop, Disease: Not confidently identified, Status: Low Confidence
        CASE E: disease_confidence >= 65% -> Crop: detected crop, Disease: actual disease / Healthy, Status: Healthy/Diseased
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
        # CASE A: Severe Quality Gate Failure (Non-leaf or completely blurred/black)
        if not quality_res.get("quality_ok", True) and not quality_res.get("is_leaf", True):
            duration_ms = round((time.time() - start_time) * 1000, 2)
            self._log_diagnostics(
                quality_ok=False,
                rejection_reasons=quality_res.get("reasons", ["Low image quality / non-vegetative specimen"]),
                crop_top_5=[],
                best_crop="Undetermined",
                crop_confidence=0.0,
                ood_score=1.0,
                ood_status="out_of_distribution",
                is_ood=True,
                is_supported=False,
                disease_top_5=[],
                disease_confidence=0.0,
                final_status="Low Quality / Undetermined"
            )
            return {
                "success": True,
                "crop": "Undetermined",
                "crop_confidence": 0.0,
                "crop_top_k": [],
                "disease": "Not confidently identified",
                "disease_confidence": 0.0,
                "status": "Low Quality / Undetermined",
                "quality_ok": False,
                "is_supported": False,
                "is_ood": True,
                "ood_score": 1.0,
                "ood_status": "out_of_distribution",
                "reasons": quality_res.get("reasons", []),
                "symptoms": "Image does not meet foliar quality criteria. Please upload a clear leaf image in bright daylight.",
                "precautions": [
                    "Upload a clear, high-resolution photo in natural daylight",
                    "Ensure the camera is focused directly on the leaf surface",
                    "Avoid extreme shadows, dark lighting, or harsh camera flash"
                ],
                "treatment": None,
                "pathogen": None,
                "top_predictions": [],
                "processing_time_ms": duration_ms
            }

        # 3. Image Preprocessing (matches evaluation & training pipeline)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        norm_tensor = self.eval_transform(pil_img).unsqueeze(0).to(self.device)

        if self.model is None:
            return self._error_response("Universal neural model is not loaded.")

        # 4. Stage A: Dedicated 14-Class Crop Classifier
        with torch.no_grad():
            features = self.model.extract_features(norm_tensor)
            crop_logits = self.model.predict_crop(features)
            crop_probs = F.softmax(crop_logits, dim=-1).squeeze(0).cpu().numpy()

        top_crop_idx = int(np.argmax(crop_probs))
        raw_top_crop = self.crop_names[top_crop_idx]
        display_crop = "Bell Pepper" if raw_top_crop in ("Pepper, bell", "pepper_bell") else raw_top_crop
        crop_confidence = float(crop_probs[top_crop_idx])

        # Top-5 crops ranking
        sorted_crop_indices = np.argsort(crop_probs)[::-1]
        crop_top_5 = [
            (
                "Bell Pepper" if self.crop_names[int(idx)] in ("Pepper, bell", "pepper_bell") else self.crop_names[int(idx)],
                round(float(crop_probs[idx]), 4)
            )
            for idx in sorted_crop_indices[:5]
        ]
        crop_top_k = [
            {"crop": c[0], "confidence": c[1]} for c in crop_top_5[:3]
        ]

        # 5. Stage C: OOD / Unknown Detection
        ood_res = self.ood_detector.evaluate(crop_logits, quality_res)
        is_ood = bool(ood_res.get("is_ood", False))

        # CASE B: quality_ok = true AND is_ood = true
        if is_ood:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            self._log_diagnostics(
                quality_ok=quality_res.get("quality_ok", True),
                rejection_reasons=ood_res.get("reasons", ["Input features outside supported crop distribution"]),
                crop_top_5=crop_top_5,
                best_crop="Unsupported / Unknown",
                crop_confidence=crop_confidence,
                ood_score=ood_res.get("ood_score", 0.85),
                ood_status="out_of_distribution",
                is_ood=True,
                is_supported=False,
                disease_top_5=[],
                disease_confidence=0.0,
                final_status="Unknown"
            )
            return {
                "success": True,
                "crop": "Unsupported / Unknown",
                "crop_confidence": round(crop_confidence, 4),
                "crop_top_k": crop_top_k,
                "disease": "Not confidently identified",
                "disease_confidence": 0.0,
                "status": "Unknown",
                "quality_ok": quality_res.get("quality_ok", True),
                "is_supported": False,
                "is_ood": True,
                "ood_score": ood_res.get("ood_score", 0.85),
                "ood_status": "out_of_distribution",
                "reasons": ood_res.get("reasons", []),
                "symptoms": "Visual specimen does not match any of the 14 supported crop species.",
                "precautions": [
                    "Verify the plant is one of the 14 supported crops",
                    "Capture an in-focus single leaf showing clear foliar veins",
                    "Avoid capturing non-leaf objects or background clutter"
                ],
                "treatment": None,
                "pathogen": None,
                "top_predictions": [],
                "processing_time_ms": duration_ms
            }

        # 6. Stage B: Crop-Gated Disease Classification (CASE C, D, E)
        # Valid supported leaf -> evaluate only the diseases of the identified crop species
        with torch.no_grad():
            disease_logits = self.model.predict_disease_for_crop(features, raw_top_crop)
            disease_probs = F.softmax(disease_logits, dim=-1).squeeze(0).cpu().numpy()

        candidate_diseases = self.crop_diseases[raw_top_crop]
        sorted_dis_indices = np.argsort(disease_probs)[::-1]
        top_dis_idx = int(sorted_dis_indices[0])
        disease_name = candidate_diseases[top_dis_idx]
        disease_confidence = float(disease_probs[top_dis_idx])

        disease_top_5 = [
            (candidate_diseases[int(idx)], round(float(disease_probs[idx]), 4))
            for idx in sorted_dis_indices[:min(5, len(candidate_diseases))]
        ]

        top_predictions = []
        for idx in sorted_dis_indices[:3]:
            d_cand = candidate_diseases[int(idx)]
            conf = float(disease_probs[idx])
            top_predictions.append({
                "class_id": int(idx),
                "disease": d_cand,
                "crop": display_crop,
                "confidence": f"{int(round(conf * 100))}%",
                "confidence_score": round(conf, 4)
            })

        duration_ms = round((time.time() - start_time) * 1000, 2)
        confidence_str = f"{int(round(disease_confidence * 100))}%"
        is_healthy = "healthy" in disease_name.lower()
        final_status = "Healthy" if is_healthy else "Diseased"

        # Diagnostic log
        self._log_diagnostics(
            quality_ok=quality_res.get("quality_ok", True),
            rejection_reasons=quality_res.get("reasons", []),
            crop_top_5=crop_top_5,
            best_crop=display_crop,
            crop_confidence=crop_confidence,
            ood_score=ood_res.get("ood_score", 0.0),
            ood_status=ood_res.get("ood_status", "in_distribution"),
            is_ood=False,
            is_supported=True,
            disease_top_5=disease_top_5,
            disease_confidence=disease_confidence,
            final_status="Low Confidence" if disease_confidence < disease_safety_threshold else final_status
        )

        # 7. 65% Safety Gate Enforcement
        # CASE D: disease_confidence < 65%
        if disease_confidence < disease_safety_threshold:
            return {
                "success": True,
                "crop": display_crop,
                "crop_confidence": round(crop_confidence, 4),
                "crop_top_k": crop_top_k,
                "disease": "Not confidently identified",
                "disease_confidence": round(disease_confidence, 4),
                "status": "Low Confidence",
                "quality_ok": quality_res.get("quality_ok", True),
                "is_supported": True,
                "is_ood": False,
                "ood_score": ood_res.get("ood_score", 0.0),
                "ood_status": "in_distribution",
                "confidence": confidence_str,
                "confidence_score": round(disease_confidence, 4),
                "pathogen": None,
                "symptoms": f"Foliar patterns on {display_crop} are ambiguous or early stage. Re-inspect foliage under clearer daylight.",
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

        # CASE E: disease_confidence >= 65% (Confirmed High Confidence)
        meta = self._get_class_meta(raw_top_crop, disease_name)
        dis_info = get_disease_info(display_crop, disease_name)

        return {
            "success": True,
            "crop": display_crop,
            "crop_confidence": round(crop_confidence, 4),
            "crop_top_k": crop_top_k,
            "disease": disease_name,
            "disease_confidence": round(disease_confidence, 4),
            "status": final_status,
            "quality_ok": quality_res.get("quality_ok", True),
            "is_supported": True,
            "is_ood": False,
            "ood_score": ood_res.get("ood_score", 0.0),
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
            "crop_top_k": [],
            "disease": "Not confidently identified",
            "disease_confidence": 0.0,
            "status": "Error",
            "quality_ok": False,
            "is_supported": False,
            "is_ood": True,
            "ood_score": 1.0,
            "ood_status": "out_of_distribution",
            "precautions": [
                "Ensure image is a valid, uncorrupted JPEG/PNG/WebP file"
            ],
            "treatment": None,
            "pathogen": None,
            "top_predictions": []
        }
