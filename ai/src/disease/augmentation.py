"""
AgriSmart AI – Image Preprocessing & Augmentation Pipelines
Provides reproducible torchvision transformation pipelines for training and validation.
"""
from typing import Tuple
import torchvision.transforms as T

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def get_train_transforms(image_size: int = 224) -> T.Compose:
    """
    Returns training transform pipeline:
    - Resize
    - RandomResizedCrop
    - HorizontalFlip
    - Rotation
    - ColorJitter
    - RandomAffine
    - RandomPerspective
    - GaussianBlur
    - ToTensor
    - Normalize
    - RandomErasing
    """
    return T.Compose([
        T.Resize((int(image_size * 1.15), int(image_size * 1.15))),
        T.RandomResizedCrop(image_size, scale=(0.8, 1.0), ratio=(0.9, 1.1)),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomVerticalFlip(p=0.2),
        T.RandomRotation(degrees=25),
        T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
        T.RandomAffine(degrees=0, translate=(0.08, 0.08), scale=(0.95, 1.05)),
        T.RandomPerspective(distortion_scale=0.15, p=0.3),
        T.GaussianBlur(kernel_size=(3, 3), sigma=(0.1, 2.0)),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        T.RandomErasing(p=0.2, scale=(0.02, 0.2), ratio=(0.3, 3.3), value="random")
    ])


def get_targeted_train_transforms(image_size: int = 224) -> T.Compose:
    """
    Enhanced leaf-disease specific augmentation:
    - Conservative crop to retain boundary leaf spots (scale 0.88-1.0)
    - Full 4-way flips (horizontal + vertical) for orientation invariance
    - Gentle color jitter to retain chlorotic yellow halos and necrotic lesion contrast
    - Omission of RandomErasing to avoid masking diagnostic fungal lesions
    """
    return T.Compose([
        T.Resize((int(image_size * 1.12), int(image_size * 1.12))),
        T.RandomResizedCrop(image_size, scale=(0.88, 1.0), ratio=(0.92, 1.08)),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomVerticalFlip(p=0.5),
        T.RandomRotation(degrees=20),
        T.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15, hue=0.03),
        T.RandomAffine(degrees=0, translate=(0.05, 0.05), scale=(0.96, 1.04)),
        T.GaussianBlur(kernel_size=(3, 3), sigma=(0.1, 1.0)),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])


def get_val_transforms(image_size: int = 224) -> T.Compose:
    """
    Returns validation transform pipeline:
    - Resize
    - CenterCrop
    - ToTensor
    - Normalize
    (No random augmentations applied to validation/testing data)
    """
    return T.Compose([
        T.Resize((int(image_size * 1.14), int(image_size * 1.14))),
        T.CenterCrop(image_size),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])


def get_inference_transforms(image_size: int = 224) -> T.Compose:
    """
    Returns inference transform pipeline for single image prediction.
    """
    return get_val_transforms(image_size=image_size)
