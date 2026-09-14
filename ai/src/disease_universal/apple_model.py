import torch
import torch.nn as nn
import torchvision.models as models

class AppleMultiLabelClassifier(nn.Module):
    """
    Dedicated Multi-Label Foliar Disease Classifier for Apple (Malus domestica)
    Trained on Plant Pathology 2021 (FGVC8) and compatible field datasets.
    
    Classes:
    0: Healthy
    1: Scab
    2: Frog Eye Leaf Spot
    3: Rust
    4: Powdery Mildew
    5: Complex
    """
    def __init__(self, architecture="efficientnet_b0", num_classes=6, pretrained=True, dropout=0.3):
        super().__init__()
        self.architecture = architecture
        self.num_classes = num_classes
        
        if architecture == "efficientnet_b0":
            weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
            backbone = models.efficientnet_b0(weights=weights)
            in_features = backbone.classifier[1].in_features
            backbone.classifier = nn.Identity()
            self.backbone = backbone
        elif architecture == "resnet18":
            weights = models.ResNet18_Weights.DEFAULT if pretrained else None
            backbone = models.resnet18(weights=weights)
            in_features = backbone.fc.in_features
            backbone.fc = nn.Identity()
            self.backbone = backbone
        elif architecture == "mobilenet_v3":
            weights = models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
            backbone = models.mobilenet_v3_large(weights=weights)
            in_features = backbone.classifier[0].in_features
            backbone.classifier = nn.Identity()
            self.backbone = backbone
        else:
            raise ValueError(f"Unsupported architecture: {architecture}")
            
        self.head = nn.Sequential(
            nn.LayerNorm(in_features),
            nn.Dropout(dropout),
            nn.Linear(in_features, 256),
            nn.SiLU(),
            nn.Dropout(dropout * 0.5),
            nn.Linear(256, num_classes)
        )

    def forward(self, x):
        features = self.backbone(x)
        logits = self.head(features)
        return logits

    def predict_probabilities(self, x):
        logits = self.forward(x)
        return torch.sigmoid(logits)
