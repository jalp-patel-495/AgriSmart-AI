"""
AgriSmart AI – PyTorch Dataset & DataLoader
Handles batch loading, ImageNet normalization, and augmentations for training/evaluation.
"""

from pathlib import Path
from typing import Tuple, List, Optional
import cv2
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as T

# Project directory references
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = PROJECT_ROOT / "dataset"
SPLITS_DIR = DATASET_DIR / "splits"


# Standard ImageNet normalization parameters
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def get_train_transforms(img_size: int = 224) -> T.Compose:
    """Data augmentation transformations for model training."""
    return T.Compose([
        T.ToPILImage(),
        T.Resize((img_size, img_size)),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomVerticalFlip(p=0.3),
        T.RandomRotation(degrees=25),
        T.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])


def get_eval_transforms(img_size: int = 224) -> T.Compose:
    """Standard resize and normalization for validation and testing."""
    return T.Compose([
        T.ToPILImage(),
        T.Resize((img_size, img_size)),
        T.ToTensor(),
        T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])


class AgriSmartDataset(Dataset):
    """
    Custom PyTorch Dataset for loading preprocessed crop leaf images from split manifests.
    """
    def __init__(self, csv_path: Path, dataset_root: Path = DATASET_DIR, transform: Optional[T.Compose] = None):
        self.df = pd.read_csv(csv_path)
        self.dataset_root = dataset_root
        self.transform = transform

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int, str]:
        row = self.df.iloc[idx]
        img_rel_path = row["processed_path"]
        img_full_path = self.dataset_root / img_rel_path

        # Read image using OpenCV
        img_bgr = cv2.imread(str(img_full_path))
        if img_bgr is None:
            raise FileNotFoundError(f"Failed to read image at: {img_full_path}")

        # Convert OpenCV BGR to RGB
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        if self.transform:
            img_tensor = self.transform(img_rgb)
        else:
            img_tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float() / 255.0

        label = int(row["class_id"])
        class_name = str(row["class_name"])

        return img_tensor, label, class_name


def get_dataloaders(
    splits_dir: Path = SPLITS_DIR,
    batch_size: int = 16,
    img_size: int = 224,
    num_workers: int = 0
) -> Tuple[DataLoader, DataLoader, DataLoader, List[str]]:
    """
    Creates PyTorch DataLoaders for train, validation, and test splits.
    """
    train_csv = splits_dir / "train.csv"
    val_csv = splits_dir / "val.csv"
    test_csv = splits_dir / "test.csv"

    for p in [train_csv, val_csv, test_csv]:
        if not p.exists():
            raise FileNotFoundError(f"Manifest not found: {p}")

    train_dataset = AgriSmartDataset(train_csv, transform=get_train_transforms(img_size))
    val_dataset = AgriSmartDataset(val_csv, transform=get_eval_transforms(img_size))
    test_dataset = AgriSmartDataset(test_csv, transform=get_eval_transforms(img_size))

    # Get ordered class names
    unique_classes = train_dataset.df.sort_values("class_id")["class_name"].unique().tolist()

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        drop_last=False
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        drop_last=False
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        drop_last=False
    )

    return train_loader, val_loader, test_loader, unique_classes


if __name__ == "__main__":
    train_l, val_l, test_l, classes = get_dataloaders(batch_size=8)
    print(f"Loaded {len(classes)} classes: {classes[:3]}...")
    images, labels, _ = next(iter(train_l))
    print(f"Batch images shape : {images.shape}")
    print(f"Batch labels shape : {labels.shape}")
    print("[OK] DatasetLoader test passed!")
