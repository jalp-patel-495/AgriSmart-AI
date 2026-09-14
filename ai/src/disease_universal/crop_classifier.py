"""
AgriSmart AI - Dedicated 14-Class Crop Classifier
Stage A in the Unified Disease Detection Pipeline.
Classifies input foliage into exactly one of 14 supported crop species:
1. Apple
2. Blueberry
3. Cherry
4. Corn
5. Grape
6. Orange
7. Peach
8. Bell Pepper
9. Potato
10. Raspberry
11. Soybean
12. Squash
13. Strawberry
14. Tomato
"""
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models

CROPS_14: List[str] = [
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

CROP_TO_IDX = {crop: idx for idx, crop in enumerate(CROPS_14)}
IDX_TO_CROP = {idx: crop for idx, crop in enumerate(CROPS_14)}

class Crop14Classifier(nn.Module):
    """
    Dedicated 14-Class Crop Identification Neural Network.
    Uses EfficientNet-B0 backbone with feature pooling and dropout regularization.
    """
    def __init__(self, architecture: str = "efficientnet_b0", pretrained: bool = True, dropout: float = 0.3):
        super().__init__()
        self.architecture = architecture.lower()
        self.num_classes = len(CROPS_14)
        weights_arg = "DEFAULT" if pretrained else None

        if self.architecture == "efficientnet_b0":
            base = models.efficientnet_b0(weights=weights_arg)
            in_features = base.classifier[1].in_features
            base.classifier = nn.Sequential(
                nn.Dropout(p=dropout),
                nn.Linear(in_features, self.num_classes)
            )
            self.model = base
        elif self.architecture in {"mobilenet_v3_small", "mobilenet_v3"}:
            base = models.mobilenet_v3_small(weights=weights_arg)
            in_features = base.classifier[3].in_features
            base.classifier[3] = nn.Linear(in_features, self.num_classes)
            self.model = base
        elif self.architecture == "resnet34":
            base = models.resnet34(weights=weights_arg)
            in_features = base.fc.in_features
            base.fc = nn.Sequential(
                nn.Dropout(p=dropout),
                nn.Linear(in_features, self.num_classes)
            )
            self.model = base
        else:
            raise ValueError(f"Unsupported architecture: {architecture}")

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.model(x)

    def extract_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extracts penultimate feature representation before classification head."""
        if hasattr(self.model, "features"):
            feats = self.model.features(x)
            return self.model.avgpool(feats).flatten(1)
        elif hasattr(self.model, "conv1"):
            x = self.model.conv1(x)
            x = self.model.bn1(x)
            x = self.model.relu(x)
            x = self.model.maxpool(x)
            x = self.model.layer1(x)
            x = self.model.layer2(x)
            x = self.model.layer3(x)
            x = self.model.layer4(x)
            return self.model.avgpool(x).flatten(1)
        return self.forward(x)

def build_crop_classifier(checkpoint_path: Optional[str] = None, device: str = "cpu") -> Crop14Classifier:
    """Builds and loads the 14-crop classifier model."""
    model = Crop14Classifier(pretrained=(checkpoint_path is None))
    if checkpoint_path and Path(checkpoint_path).exists():
        ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
        state_dict = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt
        model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model
