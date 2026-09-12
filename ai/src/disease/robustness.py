"""
AgriSmart AI – Field Robustness Evaluation Pipeline
Applies realistic farmer smartphone camera distortions (illumination, shadows, motion blur,
contrast, Gaussian noise, and partial occlusions) to test model degradation.
"""
from typing import Dict, Any, List, Optional
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from PIL import Image, ImageEnhance, ImageFilter
from sklearn.metrics import f1_score, accuracy_score

from ai.src.disease.augmentation import IMAGENET_MEAN, IMAGENET_STD
import torchvision.transforms as T


class RobustDistortionTransform:
    """
    Simulates field mobile photography conditions on PIL images:
    - Random brightness variation
    - Contrast variation
    - Gaussian blur
    - Additive Gaussian noise
    - Partial patch occlusion / leaf shadow
    """
    def __init__(self, image_size: int = 224):
        self.image_size = image_size
        self.to_tensor_norm = T.Compose([
            T.Resize((image_size, image_size)),
            T.ToTensor(),
            T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
        ])

    def __call__(self, img: Image.Image) -> torch.Tensor:
        # 1. Random Brightness & Contrast
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(float(np.random.uniform(0.6, 1.4)))

        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(float(np.random.uniform(0.6, 1.4)))

        # 2. Camera Blur
        if np.random.rand() > 0.4:
            img = img.filter(ImageFilter.GaussianBlur(radius=float(np.random.uniform(0.5, 2.0))))

        tensor = self.to_tensor_norm(img)

        # 3. Additive noise
        if np.random.rand() > 0.4:
            noise = torch.randn_like(tensor) * 0.08
            tensor = tensor + noise

        # 4. Partial occlusion (simulate finger, dirt, or harsh shadow block)
        if np.random.rand() > 0.5:
            c, h, w = tensor.shape
            occ_h = int(h * np.random.uniform(0.15, 0.35))
            occ_w = int(w * np.random.uniform(0.15, 0.35))
            y0 = int(np.random.randint(0, h - occ_h))
            x0 = int(np.random.randint(0, w - occ_w))
            tensor[:, y0:y0 + occ_h, x0:x0 + occ_w] = 0.0

        return tensor


def evaluate_field_robustness(
    model: nn.Module,
    val_samples: List[tuple],
    device: torch.device,
    class_names: List[str],
    image_size: int = 224,
    batch_size: int = 32
) -> Dict[str, Any]:
    """
    Evaluates model on corrupted field validation images to calculate robustness degradation.
    """
    from ai.src.disease.dataset import PlantVillageDataset

    robust_transform = RobustDistortionTransform(image_size=image_size)
    robust_dataset = PlantVillageDataset(val_samples, transform=robust_transform)
    robust_loader = DataLoader(robust_dataset, batch_size=batch_size, shuffle=False)

    model.eval()
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for inputs, targets in robust_loader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            preds = torch.argmax(outputs, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_targets.extend(targets.numpy())

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)

    robust_f1 = float(f1_score(all_targets, all_preds, average="macro", zero_division=0))
    robust_acc = float(accuracy_score(all_targets, all_preds))

    return {
        "robust_macro_f1": round(robust_f1, 4),
        "robust_accuracy": round(robust_acc, 4),
        "distortions_evaluated": [
            "brightness_variation",
            "contrast_variation",
            "gaussian_blur",
            "gaussian_noise",
            "partial_occlusion_shadow"
        ]
    }
