"""
AgriSmart AI – Dataset Ingestion, Dynamic Class Discovery & Stratified Splitting
"""
import os
import glob
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from PIL import Image
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from sklearn.model_selection import train_test_split

from ai.src.disease.augmentation import get_train_transforms, get_val_transforms

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def detect_dataset_path(preferred_path: Optional[str] = None) -> Path:
    """
    Automatically detects the PlantVillage dataset path on local disk without assuming.
    Checks preferred_path first, then canonical candidate locations.
    """
    candidates = []
    if preferred_path:
        candidates.append(Path(preferred_path))
        candidates.append(Path.cwd() / preferred_path)
        candidates.append(Path(__file__).resolve().parents[3] / preferred_path)

    # Standard workspace locations
    root = Path(__file__).resolve().parents[3]
    candidates.extend([
        root / "dataset" / "raw",
        root / "dataset" / "processed" / "train",
        root / "dataset",
        root / "ai" / "data" / "PlantVillage",
        root / "data" / "PlantVillage",
        Path("dataset/raw"),
        Path("../dataset/raw"),
        Path("dataset"),
    ])

    for cand in candidates:
        if cand.exists() and cand.is_dir():
            # Verify if candidate contains class subdirectories with image files
            subdirs = [d for d in cand.iterdir() if d.is_dir() and not d.name.startswith(".")]
            if len(subdirs) >= 2:
                # Check for images inside
                first_dir = subdirs[0]
                has_imgs = any(f.suffix.lower() in VALID_EXTENSIONS for f in first_dir.glob("*.*"))
                if has_imgs:
                    return cand.resolve()

    raise FileNotFoundError(
        f"PlantVillage dataset not found. Checked candidate paths: {[str(c) for c in candidates]}"
    )


def discover_classes_and_samples(dataset_dir: Path) -> Tuple[List[str], List[Tuple[str, int]], Dict[int, int]]:
    """
    Discovers all classes dynamically from the directory structure without hardcoding.
    Returns:
    - class_names: List of discovered class strings sorted alphabetically
    - samples: List of (file_path, class_id)
    - class_counts: Dict mapping class_id -> count of images
    """
    class_subdirs = sorted([d for d in dataset_dir.iterdir() if d.is_dir() and not d.name.startswith(".")])
    if not class_subdirs:
        raise ValueError(f"No class subdirectories found in dataset path: {dataset_dir}")

    class_names = [d.name for d in class_subdirs]
    class_to_idx = {name: idx for idx, name in enumerate(class_names)}

    samples = []
    class_counts = {idx: 0 for idx in range(len(class_names))}

    for subdir in class_subdirs:
        cls_idx = class_to_idx[subdir.name]
        for img_path in subdir.iterdir():
            if img_path.is_file() and img_path.suffix.lower() in VALID_EXTENSIONS:
                samples.append((str(img_path.resolve()), cls_idx))
                class_counts[cls_idx] += 1

    return class_names, samples, class_counts


class PlantVillageDataset(Dataset):
    """
    PyTorch Dataset with robust error handling for corrupted images.
    """
    def __init__(self, samples: List[Tuple[str, int]], transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        path, label = self.samples[idx]
        try:
            image = Image.open(path).convert("RGB")
        except Exception as e:
            # Fallback for damaged image
            image = Image.new("RGB", (224, 224), color=(0, 0, 0))

        if self.transform is not None:
            image = self.transform(image)

        return image, label


def compute_class_weights(train_samples: List[Tuple[str, int]], num_classes: int) -> torch.Tensor:
    """
    Calculates class weights using TRAINING DATA ONLY:
    w_c = total_train_samples / (num_classes * count_c)
    """
    counts = np.zeros(num_classes, dtype=np.float32)
    for _, lbl in train_samples:
        counts[lbl] += 1.0

    total = len(train_samples)
    weights = np.zeros(num_classes, dtype=np.float32)
    for c in range(num_classes):
        if counts[c] > 0:
            weights[c] = total / (num_classes * counts[c])
        else:
            weights[c] = 1.0

    return torch.tensor(weights, dtype=torch.float32)


def get_stratified_split(
    samples: List[Tuple[str, int]],
    val_split: float = 0.2,
    random_seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]]]:
    """
    Creates a stratified, reproducible train/validation split ensuring no data leakage.
    """
    paths = [s[0] for s in samples]
    labels = [s[1] for s in samples]

    train_paths, val_paths, train_labels, val_labels = train_test_split(
        paths,
        labels,
        test_size=val_split,
        random_state=random_seed,
        stratify=labels
    )

    train_samples = list(zip(train_paths, train_labels))
    val_samples = list(zip(val_paths, val_labels))
    return train_samples, val_samples


def build_dataloaders(
    dataset_path: Optional[str] = None,
    image_size: int = 224,
    batch_size: int = 32,
    val_split: float = 0.2,
    random_seed: int = 42,
    num_workers: int = 0,
    use_weighted_sampler: bool = False,
    max_train_samples: Optional[int] = None,
    max_val_samples: Optional[int] = None
) -> Tuple[DataLoader, DataLoader, List[str], torch.Tensor]:
    """
    Builds and returns (train_loader, val_loader, class_names, class_weights).
    Supports optional representative subsampling for fast CPU training.
    """
    actual_path = detect_dataset_path(dataset_path)
    class_names, all_samples, class_counts = discover_classes_and_samples(actual_path)

    train_samples, val_samples = get_stratified_split(
        all_samples, val_split=val_split, random_seed=random_seed
    )

    # Optional fast representative subsampling if running on restricted CPU
    if max_train_samples and len(train_samples) > max_train_samples:
        rng = np.random.RandomState(random_seed)
        train_labels = [s[1] for s in train_samples]
        sub_train_idx, _ = train_test_split(
            np.arange(len(train_samples)),
            train_size=max_train_samples,
            random_state=random_seed,
            stratify=train_labels
        )
        train_samples = [train_samples[i] for i in sorted(sub_train_idx)]

    if max_val_samples and len(val_samples) > max_val_samples:
        val_labels = [s[1] for s in val_samples]
        sub_val_idx, _ = train_test_split(
            np.arange(len(val_samples)),
            train_size=max_val_samples,
            random_state=random_seed,
            stratify=val_labels
        )
        val_samples = [val_samples[i] for i in sorted(sub_val_idx)]

    class_weights = compute_class_weights(train_samples, len(class_names))

    train_dataset = PlantVillageDataset(train_samples, transform=get_train_transforms(image_size))
    val_dataset = PlantVillageDataset(val_samples, transform=get_val_transforms(image_size))

    sampler = None
    shuffle = True
    if use_weighted_sampler:
        # Sample weights based on class inverse frequency
        sample_weights = [float(class_weights[lbl]) for _, lbl in train_samples]
        sampler = WeightedRandomSampler(weights=sample_weights, num_samples=len(sample_weights), replacement=True)
        shuffle = False

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        sampler=sampler,
        num_workers=num_workers,
        pin_memory=False
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=False
    )

    return train_loader, val_loader, class_names, class_weights
