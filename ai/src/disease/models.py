"""
AgriSmart AI – Deep Learning Model Architectures for Crop Disease Detection
Supports EfficientNet-B0, ResNet50, DenseNet121, MobileNetV3, and ConvNeXt-Tiny
with 2-Stage Transfer Learning (Backbone Freezing & Upper-Layer Unfreezing).
"""
from typing import Tuple, Optional
import torch
import torch.nn as nn
import torchvision.models as models


class CropDiseaseClassifier(nn.Module):
    """
    Unified wrapper for transfer-learning backbones with custom dropout and classification head.
    Supports Stage 1 (Head-only) and Stage 2 (Fine-tuning) parameter freezing/unfreezing.
    """
    def __init__(
        self,
        architecture: str,
        num_classes: int,
        pretrained: bool = True,
        dropout: float = 0.3
    ):
        super().__init__()
        self.architecture = architecture.lower()
        self.num_classes = num_classes
        self.dropout_rate = dropout

        weights_arg = "DEFAULT" if pretrained else None

        if self.architecture == "efficientnet_b0":
            base = models.efficientnet_b0(weights=weights_arg)
            in_features = base.classifier[1].in_features
            base.classifier = nn.Sequential(
                nn.Dropout(p=dropout),
                nn.Linear(in_features, num_classes)
            )
            self.model = base
            self.head_module = self.model.classifier

        elif self.architecture == "resnet50":
            base = models.resnet50(weights=weights_arg)
            in_features = base.fc.in_features
            base.fc = nn.Sequential(
                nn.Dropout(p=dropout),
                nn.Linear(in_features, num_classes)
            )
            self.model = base
            self.head_module = self.model.fc

        elif self.architecture == "densenet121":
            base = models.densenet121(weights=weights_arg)
            in_features = base.classifier.in_features
            base.classifier = nn.Sequential(
                nn.Dropout(p=dropout),
                nn.Linear(in_features, num_classes)
            )
            self.model = base
            self.head_module = self.model.classifier

        elif self.architecture in {"mobilenet_v3", "mobilenet_v3_small", "mobilenet_v3_large"}:
            if "small" in self.architecture:
                base = models.mobilenet_v3_small(weights=weights_arg)
            else:
                base = models.mobilenet_v3_large(weights=weights_arg)
            in_features = base.classifier[3].in_features
            base.classifier[3] = nn.Linear(in_features, num_classes)
            self.model = base
            self.head_module = self.model.classifier

        elif self.architecture in {"convnext_tiny", "convnext"}:
            base = models.convnext_tiny(weights=weights_arg)
            in_features = base.classifier[2].in_features
            base.classifier[2] = nn.Linear(in_features, num_classes)
            self.model = base
            self.head_module = self.model.classifier

        else:
            raise ValueError(f"Unsupported architecture: {architecture}")

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.model(x)

    def freeze_backbone(self) -> None:
        """
        Stage 1: Freeze all backbone parameters; only head_module remains trainable.
        """
        for param in self.model.parameters():
            param.requires_grad = False
        for param in self.head_module.parameters():
            param.requires_grad = True

    def unfreeze_upper_layers(self) -> None:
        """
        Stage 2: Unfreeze upper layers of the backbone for fine-tuning.
        """
        if self.architecture == "efficientnet_b0":
            # Unfreeze features blocks 5, 6, 7, 8 (top 4 stages) and head
            for param in self.model.features[-4:].parameters():
                param.requires_grad = True
            for param in self.head_module.parameters():
                param.requires_grad = True

        elif self.architecture == "resnet50":
            # Unfreeze layer4 and head
            for param in self.model.layer4.parameters():
                param.requires_grad = True
            for param in self.head_module.parameters():
                param.requires_grad = True

        elif self.architecture == "densenet121":
            # Unfreeze denseblock4 and norm5
            for param in self.model.features.denseblock4.parameters():
                param.requires_grad = True
            for param in self.model.features.norm5.parameters():
                param.requires_grad = True
            for param in self.head_module.parameters():
                param.requires_grad = True

        elif "mobilenet" in self.architecture:
            # Unfreeze last 4 inverted residual blocks
            for param in self.model.features[-4:].parameters():
                param.requires_grad = True
            for param in self.head_module.parameters():
                param.requires_grad = True

        elif "convnext" in self.architecture:
            # Unfreeze last stage
            for param in self.model.features[-2:].parameters():
                param.requires_grad = True
            for param in self.head_module.parameters():
                param.requires_grad = True
        else:
            for param in self.model.parameters():
                param.requires_grad = True


def build_crop_disease_model(
    architecture: str,
    num_classes: int,
    pretrained: bool = True,
    dropout: float = 0.3
) -> CropDiseaseClassifier:
    """
    Factory function to instantiate a CropDiseaseClassifier.
    """
    return CropDiseaseClassifier(
        architecture=architecture,
        num_classes=num_classes,
        pretrained=pretrained,
        dropout=dropout
    )
