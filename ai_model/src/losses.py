"""
AgriSmart AI – Loss Functions & Regularization
Provides:
1. Class-weighted CrossEntropyLoss
2. Focal Loss for focusing on hard/confusing examples
3. Mixup / CutMix blended loss calculator
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F


def compute_class_weights(df: pd.DataFrame, num_classes: int) -> torch.Tensor:
    """
    Computes inverse class frequency weights to counteract class imbalance.
    """
    counts = np.zeros(num_classes, dtype=np.float32)
    for class_id, count in df["class_id"].value_counts().items():
        if class_id < num_classes:
            counts[class_id] = count

    # Smooth zero counts
    counts = np.maximum(counts, 1.0)
    total_samples = len(df)
    weights = total_samples / (num_classes * counts)
    # Normalize weights so mean is 1.0
    weights = weights / np.mean(weights)
    return torch.tensor(weights, dtype=torch.float32)


class FocalLoss(nn.Module):
    """
    Focal Loss: FL(pt) = -alpha_t * (1 - pt)^gamma * log(pt)
    Penalizes easy examples and focuses gradient steps on hard ambiguous lesions.
    """
    def __init__(self, alpha=None, gamma: float = 2.0, reduction: str = "mean"):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        ce_loss = F.cross_entropy(inputs, targets, reduction="none", weight=self.alpha)
        pt = torch.exp(-ce_loss)
        focal_loss = ((1.0 - pt) ** self.gamma) * ce_loss

        if self.reduction == "mean":
            return focal_loss.mean()
        elif self.reduction == "sum":
            return focal_loss.sum()
        return focal_loss


def mixup_criterion(criterion, pred, y_a, y_b, lam):
    """Calculates blended loss for Mixup / CutMix targets."""
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)
