import os
import json
from typing import Dict, Any, List, Optional
import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
import numpy as np

from ai.src.disease_universal.apple_model import AppleMultiLabelClassifier

APPLE_CLASSES = [
    "healthy",
    "scab",
    "frog_eye_leaf_spot",
    "rust",
    "powdery_mildew",
    "complex"
]

APPLE_DISPLAY_NAMES = [
    "Healthy",
    "Apple Scab",
    "Frog Eye Leaf Spot",
    "Cedar Apple Rust",
    "Powdery Mildew",
    "Complex Foliar Disease"
]

class AppleMultiLabelEngine:
    """
    Dedicated Multi-Label Foliar Disease Engine for Apple (Malus domestica).
    Trained on Plant Pathology 2021 (FGVC8) and compatible field datasets.
    """
    def __init__(self, model_dir: str = "models/disease_universal/apple", device: str = "cpu"):
        self.device = torch.device(device)
        self.model_dir = model_dir
        self.model = None
        self.config = {}
        self.class_names = APPLE_DISPLAY_NAMES
        self.safety_threshold = 0.65

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

        self._load_artifacts()

    def _load_artifacts(self):
        ckpt_path = os.path.join(self.model_dir, "best_model.pt")
        cfg_path = os.path.join(self.model_dir, "multilabel_config.json")
        meta_path = os.path.join(self.model_dir, "model_metadata.json")

        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    self.config = json.load(f)
                    self.class_names = self.config.get("display_names", APPLE_DISPLAY_NAMES)
                    self.safety_threshold = self.config.get("safety_threshold", 0.65)
            except Exception as e:
                print(f"[!] Warning reading apple config: {e}")

        arch = "efficientnet_b0"
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    arch = meta.get("architecture", "efficientnet_b0")
            except Exception:
                pass

        if os.path.exists(ckpt_path):
            try:
                model = AppleMultiLabelClassifier(architecture=arch, num_classes=len(APPLE_CLASSES), pretrained=False)
                state_dict = torch.load(ckpt_path, map_location=self.device)
                model.load_state_dict(state_dict)
                model.to(self.device)
                model.eval()
                self.model = model
                print(f"[*] Apple Multi-Label Classifier ({arch}) loaded successfully from {ckpt_path}.")
            except Exception as e:
                print(f"[!] Error loading Apple multi-label checkpoint: {e}")
                self.model = None
        else:
            print(f"[!] Apple multi-label checkpoint not found at {ckpt_path}.")

    def predict(self, image: Image.Image) -> Dict[str, Any]:
        """
        Runs multi-label inference for an Apple leaf image.
        Returns primary disease, multi-label list of diseases above threshold, and safety gate result.
        """
        if self.model is None:
            return {
                "available": False,
                "disease": "Not confidently identified",
                "disease_confidence": 0.0,
                "diseases": [],
                "status": "Low Confidence",
                "is_multilabel": True
            }

        tensor = self.transform(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.sigmoid(logits)[0].cpu().numpy()

        # All class probabilities
        prob_dict = {name: float(prob) for name, prob in zip(self.class_names, probs)}

        # Primary disease (highest probability)
        primary_idx = int(np.argmax(probs))
        primary_name = self.class_names[primary_idx]
        primary_conf = float(probs[primary_idx])

        # Multi-label detection: filter diseases above safety threshold
        confident_diseases = []
        for idx, (name, prob) in enumerate(zip(self.class_names, probs)):
            if prob >= self.safety_threshold and name != "Healthy":
                confident_diseases.append({
                    "name": name,
                    "confidence": round(float(prob), 4),
                    "code": APPLE_CLASSES[idx]
                })

        # Sort by confidence descending
        confident_diseases.sort(key=lambda x: x["confidence"], reverse=True)

        # Apply strict 65% safety gate
        if primary_conf < self.safety_threshold:
            return {
                "available": True,
                "disease": "Not confidently identified",
                "disease_confidence": round(primary_conf, 4),
                "primary_candidate": primary_name,
                "diseases": [],
                "status": "Low Confidence",
                "is_multilabel": True,
                "all_probabilities": {k: round(v, 4) for k, v in prob_dict.items()}
            }

        # Confident single or multi-label diagnosis
        if primary_name == "Healthy":
            status = "Healthy"
            diseases_list = [{"name": "Healthy", "confidence": round(primary_conf, 4), "code": "healthy"}]
        else:
            status = "Diseased"
            # Ensure primary disease is in the list
            if not any(d["name"] == primary_name for d in confident_diseases):
                confident_diseases.insert(0, {
                    "name": primary_name,
                    "confidence": round(primary_conf, 4),
                    "code": APPLE_CLASSES[primary_idx]
                })
            diseases_list = confident_diseases

        return {
            "available": True,
            "disease": primary_name,
            "disease_confidence": round(primary_conf, 4),
            "diseases": diseases_list,
            "status": status,
            "is_multilabel": True,
            "all_probabilities": {k: round(v, 4) for k, v in prob_dict.items()}
        }
