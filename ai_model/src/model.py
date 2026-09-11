"""
AgriSmart AI – Crop Disease Detection Neural Network Architectures
Supported Backbones: EfficientNet-B0, ResNet-18, ResNet-50, MobileNetV3
Framework: PyTorch & Torchvision
"""

import torch
import torch.nn as nn
from torchvision import models


def build_model(
    architecture: str = "efficientnet_b0",
    num_classes: int = 13,
    pretrained: bool = True,
    dropout_rate: float = 0.3
) -> nn.Module:
    """
    Builds and initializes a transfer learning model for crop disease classification.
    
    Args:
        architecture: Name of backbone ('efficientnet_b0', 'resnet18', 'resnet50', 'mobilenet_v3')
        num_classes: Number of disease categories to classify
        pretrained: Whether to load ImageNet pretrained backbone weights
        dropout_rate: Dropout probability in the classification head
        
    Returns:
        nn.Module: PyTorch neural network ready for training / fine-tuning
    """
    arch = architecture.lower().replace("-", "_")

    if arch == "efficientnet_b0":
        try:
            weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
            model = models.efficientnet_b0(weights=weights)
        except Exception as e:
            print(f"[!] Warning: Pretrained weights download unavailable ({e}), using randomly initialized weights.")
            model = models.efficientnet_b0(weights=None)
            
        in_features = model.classifier[1].in_features
        model.classifier = nn.Sequential(
            nn.Dropout(p=dropout_rate, inplace=True),
            nn.Linear(in_features, num_classes)
        )

    elif arch == "resnet18":
        try:
            weights = models.ResNet18_Weights.DEFAULT if pretrained else None
            model = models.resnet18(weights=weights)
        except Exception as e:
            print(f"[!] Warning: Pretrained weights download unavailable ({e}), using randomly initialized weights.")
            model = models.resnet18(weights=None)
            
        in_features = model.fc.in_features
        model.fc = nn.Sequential(
            nn.Dropout(p=dropout_rate),
            nn.Linear(in_features, num_classes)
        )

    elif arch == "resnet50":
        try:
            weights = models.ResNet50_Weights.DEFAULT if pretrained else None
            model = models.resnet50(weights=weights)
        except Exception as e:
            print(f"[!] Warning: Pretrained weights download unavailable ({e}), using randomly initialized weights.")
            model = models.resnet50(weights=None)
            
        in_features = model.fc.in_features
        model.fc = nn.Sequential(
            nn.Dropout(p=dropout_rate),
            nn.Linear(in_features, num_classes)
        )

    elif "mobilenet" in arch:
        try:
            weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
            model = models.mobilenet_v3_small(weights=weights)
        except Exception as e:
            print(f"[!] Warning: Pretrained weights download unavailable ({e}), using randomly initialized weights.")
            model = models.mobilenet_v3_small(weights=None)
            
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Linear(in_features, num_classes)

    else:
        raise ValueError(
            f"Unsupported architecture '{architecture}'. "
            f"Choose from: 'efficientnet_b0', 'resnet18', 'resnet50', 'mobilenet_v3_small'"
        )

    return model


if __name__ == "__main__":
    test_model = build_model("efficientnet_b0", num_classes=13, pretrained=False)
    dummy_input = torch.randn(2, 3, 224, 224)
    output = test_model(dummy_input)
    print(f"Model Architecture : EfficientNet-B0")
    print(f"Test Input Shape   : {dummy_input.shape}")
    print(f"Test Output Shape  : {output.shape} (Expected: [2, 13])")
    assert output.shape == (2, 13), "Output shape mismatch"
    print("[OK] Model forward pass test passed!")
