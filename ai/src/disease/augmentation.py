import albumentations as A
import cv2
import numpy as np
import torch
import torchvision.transforms as T

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class AlbumentationsTransformWrapper:
    """Wraps an Albumentations Compose pipeline into a PyTorch-compatible callable."""
    def __init__(self, transform: A.Compose):
        self.transform = transform

    def __call__(self, img) -> torch.Tensor:
        if not isinstance(img, np.ndarray):
            img = np.array(img)
        augmented = self.transform(image=img)
        res = augmented["image"]
        if isinstance(res, np.ndarray):
            tensor = torch.from_numpy(res.transpose(2, 0, 1)).float()
        else:
            tensor = res
        return tensor


def get_albumentations_train_transforms(image_size: int = 224) -> AlbumentationsTransformWrapper:
    """
    Returns training transform pipeline using Albumentations:
    - HorizontalFlip (p=0.5)
    - RandomRotate90 (p=0.5)
    - ShiftScaleRotate (p=0.5, translation, scale, rotation)
    - RandomBrightnessContrast (p=0.5, gentle brightness & contrast jitter)
    - Resize (image_size x image_size)
    - Normalize with ImageNet mean and std
    """
    pipeline = A.Compose([
        A.Resize(image_size, image_size, interpolation=cv2.INTER_AREA),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.3),
        A.RandomRotate90(p=0.5),
        A.Affine(
            scale=(0.9, 1.1),
            translate_percent=(-0.06, 0.06),
            rotate=(-25, 25),
            border_mode=cv2.BORDER_REFLECT,
            p=0.5
        ),
        A.RandomBrightnessContrast(
            brightness_limit=0.15,
            contrast_limit=0.15,
            p=0.5
        ),
        A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    return AlbumentationsTransformWrapper(pipeline)


def get_albumentations_val_transforms(image_size: int = 224) -> AlbumentationsTransformWrapper:
    """
    Returns validation/test transform pipeline using Albumentations:
    - Resize (image_size x image_size)
    - Normalize with ImageNet mean and std
    - Zero random augmentations
    """
    pipeline = A.Compose([
        A.Resize(image_size, image_size, interpolation=cv2.INTER_AREA),
        A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])
    return AlbumentationsTransformWrapper(pipeline)



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
