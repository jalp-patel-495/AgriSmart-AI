"""
AgriSmart AI – Advanced Augmentation Techniques (Mixup, CutMix & Multi-Condition Transforms)
Implements:
1. Mixup Data Augmentation: Linear blending of image pairs and label distributions
2. CutMix Data Augmentation: Random rectangular crop and paste between images
3. Multi-condition Albumentations: Severe agricultural background, shadow & perspective shifts
"""

import random
from typing import Tuple
import numpy as np
import torch
import albumentations as A
import cv2

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def mixup_data(x: torch.Tensor, y: torch.Tensor, alpha: float = 0.2) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, float]:
    """Returns mixed inputs, pairs of targets, and blending lambda."""
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1.0

    batch_size = x.size(0)
    index = torch.randperm(batch_size).to(x.device)

    mixed_x = lam * x + (1 - lam) * x[index, :]
    y_a, y_b = y, y[index]
    return mixed_x, y_a, y_b, lam


def cutmix_data(x: torch.Tensor, y: torch.Tensor, alpha: float = 1.0) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, float]:
    """Applies CutMix: cuts a patch from one leaf image and pastes onto another."""
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1.0

    batch_size = x.size(0)
    index = torch.randperm(batch_size).to(x.device)

    # Box coordinates
    _, _, h, w = x.shape
    cut_rat = np.sqrt(1.0 - lam)
    cut_w = int(w * cut_rat)
    cut_h = int(h * cut_rat)

    cx = np.random.randint(w)
    cy = np.random.randint(h)

    bbx1 = np.clip(cx - cut_w // 2, 0, w)
    bby1 = np.clip(cy - cut_h // 2, 0, h)
    bbx2 = np.clip(cx + cut_w // 2, 0, w)
    bby2 = np.clip(cy + cut_h // 2, 0, h)

    mixed_x = x.clone()
    mixed_x[:, :, bby1:bby2, bbx1:bbx2] = x[index, :, bby1:bby2, bbx1:bbx2]

    # Adjusted lambda to match actual bounding box pixel ratio
    lam = 1.0 - ((bbx2 - bbx1) * (bby2 - bby1) / (x.size()[-1] * x.size()[-2]))
    y_a, y_b = y, y[index]
    return mixed_x, y_a, y_b, lam


def get_advanced_field_pipeline(img_size: int = 224) -> A.Compose:
    """Comprehensive real-world agricultural augmentation pipeline."""
    return A.Compose([
        A.Resize(img_size, img_size, interpolation=cv2.INTER_CUBIC),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.3),
        A.RandomRotate90(p=0.5),
        A.Affine(
            scale=(0.85, 1.2),
            translate_percent=(-0.08, 0.08),
            rotate=(-40, 40),
            shear=(-10, 10),
            border_mode=cv2.BORDER_REFLECT,
            p=0.6
        ),
        A.Perspective(scale=(0.04, 0.1), p=0.4),
        A.RandomBrightnessContrast(brightness_limit=0.25, contrast_limit=0.25, p=0.6),
        A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1, p=0.5),
        A.OneOf([
            A.MotionBlur(blur_limit=(3, 7), p=0.5),
            A.GaussianBlur(blur_limit=(3, 5), p=0.5),
        ], p=0.4),
        A.CoarseDropout(
            num_holes_range=(1, 4),
            hole_height_range=(16, 40),
            hole_width_range=(16, 40),
            fill=0,
            p=0.4
        ),
        A.GaussNoise(p=0.3),
        A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
