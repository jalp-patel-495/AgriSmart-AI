"""
AgriSmart AI – Universal Hierarchical Crop and Disease Neural Models
Defines dedicated crop classifier, crop-specific disease heads,
and backbone architectures (EfficientNet, ResNet, ConvNeXt/MobileNet).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as tv_models
from typing import Dict, List, Tuple, Optional, Any

# 14 Canonical Crops
CANONICAL_CROPS = [
    "Apple", "Blueberry", "Cherry", "Corn", "Grape",
    "Orange", "Peach", "Pepper, bell", "Potato", "Raspberry",
    "Soybean", "Squash", "Strawberry", "Tomato"
]

# Diseases per crop mapping
CROP_DISEASES: Dict[str, List[str]] = {
    "Apple": ["Apple Scab", "Black Rot", "Cedar Apple Rust", "Healthy"],
    "Blueberry": ["Healthy"],
    "Cherry": ["Powdery Mildew", "Healthy"],
    "Corn": ["Cercospora Gray Leaf Spot", "Common Rust", "Northern Leaf Blight", "Healthy"],
    "Grape": ["Black Rot", "Esca (Black Measles)", "Leaf Blight (Isariopsis Leaf Spot)", "Healthy"],
    "Orange": ["Huanglongbing (Citrus Greening)"],
    "Peach": ["Bacterial Spot", "Healthy"],
    "Pepper, bell": ["Bacterial Spot", "Healthy"],
    "Potato": ["Early Blight", "Late Blight", "Healthy"],
    "Raspberry": ["Healthy"],
    "Soybean": ["Healthy"],
    "Squash": ["Powdery Mildew"],
    "Strawberry": ["Leaf Scorch", "Healthy"],
    "Tomato": [
        "Bacterial Spot", "Early Blight", "Late Blight", "Leaf Mold",
        "Septoria Leaf Spot", "Spider Mites (Two-Spotted Spider Mite)",
        "Target Spot", "Tomato Yellow Leaf Curl Virus", "Tomato Mosaic Virus", "Healthy"
    ]
}


def create_backbone(architecture: str = "efficientnet_b0", pretrained: bool = True):
    """Creates vision feature extractor backbone and returns (backbone_module, feature_dim)."""
    arch = architecture.lower().replace("-", "_")
    if arch == "efficientnet_b0":
        weights = tv_models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        base = tv_models.efficientnet_b0(weights=weights)
        feature_dim = base.classifier[1].in_features  # 1280
        base.classifier = nn.Identity()
        return base, feature_dim
    elif arch == "resnet50":
        weights = tv_models.ResNet50_Weights.DEFAULT if pretrained else None
        base = tv_models.resnet50(weights=weights)
        feature_dim = base.fc.in_features  # 2048
        base.fc = nn.Identity()
        return base, feature_dim
    elif arch == "resnet18":
        weights = tv_models.ResNet18_Weights.DEFAULT if pretrained else None
        base = tv_models.resnet18(weights=weights)
        feature_dim = base.fc.in_features  # 512
        base.fc = nn.Identity()
        return base, feature_dim
    elif arch == "mobilenet_v3":
        weights = tv_models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        base = tv_models.mobilenet_v3_large(weights=weights)
        feature_dim = base.classifier[0].in_features  # 960
        base.classifier = nn.Identity()
        return base, feature_dim
    else:
        raise ValueError(f"Unsupported architecture: {architecture}")


class DedicatedCropClassifier(nn.Module):
    """
    Dedicated Stage A Crop Species Classifier.
    Classifies an input leaf image across the 14 supported crops.
    """
    def __init__(self, in_features: int, num_crops: int = len(CANONICAL_CROPS)):
        super().__init__()
        self.num_crops = num_crops
        self.head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(in_features, 512),
            nn.LayerNorm(512),
            nn.SiLU(),
            nn.Dropout(0.2),
            nn.Linear(512, num_crops)
        )

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        return self.head(features)


class CropSpecificDiseaseHeads(nn.Module):
    """
    Stage B Crop-Specific Disease Classifiers.
    Houses independent classification heads for each supported crop.
    Only the head matching the detected crop is evaluated.
    """
    def __init__(self, in_features: int, crop_diseases: Optional[Dict[str, List[str]]] = None):
        super().__init__()
        self.crop_diseases = crop_diseases or CROP_DISEASES
        self.heads = nn.ModuleDict()
        
        for crop_name, diseases in self.crop_diseases.items():
            safe_key = crop_name.replace(", ", "_").replace(" ", "_").lower()
            num_classes = len(diseases)
            self.heads[safe_key] = nn.Sequential(
                nn.Dropout(0.3),
                nn.Linear(in_features, 256),
                nn.LayerNorm(256),
                nn.SiLU(),
                nn.Dropout(0.15),
                nn.Linear(256, num_classes)
            )

    def _get_key(self, crop_name: str) -> str:
        return crop_name.replace(", ", "_").replace(" ", "_").lower()

    def forward_for_crop(self, features: torch.Tensor, crop_name: str) -> torch.Tensor:
        key = self._get_key(crop_name)
        if key not in self.heads:
            raise ValueError(f"Crop '{crop_name}' (key '{key}') is not in supported disease heads.")
        return self.heads[key](features)


class UniversalHierarchicalPlantModel(nn.Module):
    """
    Unified Hierarchical Neural Model:
    Stage A: Crop Classifier
    Stage B: Crop-Specific Disease Classifier
    """
    def __init__(
        self,
        architecture: str = "efficientnet_b0",
        pretrained: bool = True,
        crop_names: List[str] = CANONICAL_CROPS,
        crop_diseases: Dict[str, List[str]] = CROP_DISEASES
    ):
        super().__init__()
        self.architecture = architecture
        self.crop_names = list(crop_names)
        self.crop_diseases = crop_diseases
        
        self.backbone, self.feature_dim = create_backbone(architecture, pretrained=pretrained)
        self.crop_classifier = DedicatedCropClassifier(self.feature_dim, num_crops=len(self.crop_names))
        self.disease_heads = CropSpecificDiseaseHeads(self.feature_dim, crop_diseases=self.crop_diseases)

    def extract_features(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)

    def predict_crop(self, features: torch.Tensor) -> torch.Tensor:
        return self.crop_classifier(features)

    def predict_disease_for_crop(self, features: torch.Tensor, crop_name: str) -> torch.Tensor:
        return self.disease_heads.forward_for_crop(features, crop_name)

    def forward(self, x: torch.Tensor, crop_name: Optional[str] = None) -> Tuple[torch.Tensor, Optional[torch.Tensor]]:
        features = self.extract_features(x)
        crop_logits = self.predict_crop(features)
        
        disease_logits = None
        if crop_name is not None:
            disease_logits = self.predict_disease_for_crop(features, crop_name)
        return crop_logits, disease_logits
