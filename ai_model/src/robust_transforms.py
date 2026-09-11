"""
AgriSmart AI – Real-World Agricultural Robustness Transformations
Library: Albumentations & OpenCV

Simulates outdoor field conditions:
1. Solar glare, harsh contrast, and overcast illumination
2. Wind flutter motion blur and lens defocus blur
3. Partial leaf occlusion, dirt smudges, and foliage shadows (CoarseDropout)
4. Mobile sensor ISO grain and image compression artifacts
5. Oblique camera shooting angles (Affine & Perspective shifts)
"""

import albumentations as A
import cv2

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def get_field_robust_pipeline(img_size: int = 224) -> A.Compose:
    """
    Robust training augmentation pipeline for real agricultural field conditions.
    """
    return A.Compose([
        A.Resize(img_size, img_size, interpolation=cv2.INTER_CUBIC),
        
        # 1. Orientation & Angles
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.3),
        A.RandomRotate90(p=0.5),
        A.Affine(
            scale=(0.85, 1.15),
            translate_percent=(-0.08, 0.08),
            rotate=(-35, 35),
            shear=(-8, 8),
            border_mode=cv2.BORDER_REFLECT,
            p=0.6
        ),

        # 2. Lighting, Glare & Sun Shadows
        A.RandomBrightnessContrast(
            brightness_limit=0.25,
            contrast_limit=0.25,
            p=0.6
        ),
        A.ColorJitter(
            brightness=0.15,
            contrast=0.15,
            saturation=0.15,
            hue=0.08,
            p=0.5
        ),

        # 3. Wind Flutter & Hand Camera Motion Blur
        A.OneOf([
            A.MotionBlur(blur_limit=(3, 7), p=0.5),
            A.GaussianBlur(blur_limit=(3, 5), p=0.5),
        ], p=0.4),

        # 4. Partial Leaf Occlusion & Dirt Shadow (CoarseDropout / Cutout)
        A.CoarseDropout(
            num_holes_range=(1, 4),
            hole_height_range=(16, 36),
            hole_width_range=(16, 36),
            fill=0,
            p=0.4
        ),

        # 5. Mobile Sensor Noise
        A.GaussNoise(p=0.3),

        # 6. Tensor Normalization
        A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_field_stress_test_pipeline(img_size: int = 224) -> A.Compose:
    """
    Stress-test transformation simulating harsh field photography:
    Applies blur, high contrast glare, and partial occlusion on evaluation images.
    """
    return A.Compose([
        A.Resize(img_size, img_size, interpolation=cv2.INTER_AREA),
        A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.8),
        A.GaussianBlur(blur_limit=(3, 5), p=0.5),
        A.CoarseDropout(num_holes_range=(1, 2), hole_height_range=(16, 32), hole_width_range=(16, 32), fill=0, p=0.5),
        A.GaussNoise(p=0.4),
        A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_standard_eval_pipeline(img_size: int = 224) -> A.Compose:
    """Clean evaluation pipeline."""
    return A.Compose([
        A.Resize(img_size, img_size, interpolation=cv2.INTER_AREA),
        A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
