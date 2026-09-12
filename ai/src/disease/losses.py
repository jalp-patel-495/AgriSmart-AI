"""
AgriSmart AI – Loss Functions for Imbalanced Crop Disease Classification
Supports Standard Cross-Entropy, Class-Weighted Cross-Entropy, and Focal Loss.
"""
from typing import Optional
import torch
import torch.nn as nn
import torch.nn.functional as F


class FocalLoss(nn.Module):
    """
    Multi-class Focal Loss for hard example mining and class imbalance mitigation:
    FL(p_t) = - alpha_t * (1 - p_t)^gamma * log(p_t)
    """
    def __init__(self, weight: Optional[torch.Tensor] = None, gamma: float = 2.0, reduction: str = "mean"):
        super().__init__()
        self.weight = weight
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        ce_loss = F.cross_entropy(inputs, targets, weight=self.weight, reduction="none")
        pt = torch.exp(-ce_loss)
        focal_loss = ((1.0 - pt) ** self.gamma) * ce_loss

        if self.reduction == "mean":
            return focal_loss.mean()
        elif self.reduction == "sum":
            return focal_loss.sum()
        return focal_loss


def build_criterion(
    loss_type: str = "weighted_cross_entropy",
    class_weights: Optional[torch.Tensor] = None,
    gamma: float = 2.0,
    label_smoothing: float = 0.0
) -> nn.Module:
    """
    Builds the loss criterion according to configuration.
    """
    loss_type = loss_type.lower()
    if loss_type in {"weighted_cross_entropy", "weighted"}:
        return nn.CrossEntropyLoss(weight=class_weights, label_smoothing=label_smoothing)
    elif loss_type in {"focal_loss", "focal"}:
        return FocalLoss(weight=class_weights, gamma=gamma)
    else:
        return nn.CrossEntropyLoss(label_smoothing=label_smoothing)
