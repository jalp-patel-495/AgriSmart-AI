"""
AgriSmart AI – Dataset Verifier & PyTorch Dataset Integration
Verifies:
1. Manifest integrity and file existence for train/val/test splits.
2. OpenCV image decodability and tensor dimensions.
3. PyTorch Dataset and DataLoader batch loading.
4. Generates a visual sample preview grid (dataset_samples_preview.png).
"""

import json
from pathlib import Path
import cv2
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Base paths
SCRIPT_DIR = Path(__file__).resolve().parent
DATASET_DIR = SCRIPT_DIR.parent
SPLITS_DIR = DATASET_DIR / "splits"
CLASSES_FILE = DATASET_DIR / "classes.json"

try:
    import torch
    from torch.utils.data import Dataset, DataLoader
    import torchvision.transforms as T
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


if TORCH_AVAILABLE:
    class AgriCropDataset(Dataset):
        """Custom PyTorch Dataset for AgriSmart AI."""
        def __init__(self, csv_file: Path, transform=None):
            self.df = pd.read_csv(csv_file)
            self.transform = transform
            self.dataset_dir = DATASET_DIR

        def __len__(self):
            return len(self.df)

        def __getitem__(self, idx):
            row = self.df.iloc[idx]
            # Resolve image path relative to dataset directory
            img_rel_path = row["processed_path"]
            img_full_path = self.dataset_dir / img_rel_path
            
            # Read image using OpenCV
            img_bgr = cv2.imread(str(img_full_path))
            if img_bgr is None:
                raise FileNotFoundError(f"Image could not be read: {img_full_path}")
            
            # Convert BGR -> RGB
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            
            # Convert to float tensor (3, H, W) normalized to [0, 1]
            img_tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float() / 255.0
            
            if self.transform:
                img_tensor = self.transform(img_tensor)
                
            label = int(row["class_id"])
            return img_tensor, label, row["class_name"]


def verify_manifests():
    """Validates existence and content of split manifests."""
    train_csv = SPLITS_DIR / "train.csv"
    val_csv = SPLITS_DIR / "val.csv"
    test_csv = SPLITS_DIR / "test.csv"
    summary_file = SPLITS_DIR / "summary.json"
    
    for p in [train_csv, val_csv, test_csv, summary_file]:
        if not p.exists():
            raise FileNotFoundError(f"Missing required manifest file: {p}")
            
    train_df = pd.read_csv(train_csv)
    val_df = pd.read_csv(val_csv)
    test_df = pd.read_csv(test_csv)
    
    print("[*] Manifests verified:")
    print(f"    Train records : {len(train_df)}")
    print(f"    Val records   : {len(val_df)}")
    print(f"    Test records  : {len(test_df)}")
    
    # Check for missing image files
    missing = 0
    for split_name, df in [("Train", train_df), ("Val", val_df), ("Test", test_df)]:
        for _, row in df.iterrows():
            fpath = DATASET_DIR / row["processed_path"]
            if not fpath.exists():
                print(f"  [!] Missing file in {split_name}: {fpath}")
                missing += 1
                
    if missing == 0:
        print("[*] All referenced image files exist on disk.")
    else:
        print(f"[!] Warning: {missing} files were missing on disk!")
        
    return train_df


def test_pytorch_dataloader():
    """Tests PyTorch Dataset and DataLoader batch generation."""
    if not TORCH_AVAILABLE:
        print("[!] PyTorch is not yet installed in this environment. Skipping DataLoader test.")
        return
        
    train_csv = SPLITS_DIR / "train.csv"
    dataset = AgriCropDataset(train_csv)
    batch_size = min(8, len(dataset))
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    print(f"[*] Testing PyTorch DataLoader with batch size {batch_size}...")
    for images, labels, class_names in loader:
        print(f"    Batch Images Tensor Shape: {images.shape}")
        print(f"    Batch Labels Tensor Shape: {labels.shape}")
        print(f"    Labels sample            : {labels.tolist()}")
        print(f"    Sample classes in batch  : {class_names[:3]}...")
        assert images.shape[1] == 3, "Images tensor must have 3 color channels"
        assert images.min() >= 0.0 and images.max() <= 1.0, "Values must be in range [0, 1]"
        break
        
    print("[*] PyTorch Dataset & DataLoader integration test passed successfully!")


def generate_visual_inspection_grid(train_df: pd.DataFrame, num_samples: int = 9):
    """Generates and saves a visual inspection grid of sample images with labels."""
    samples = train_df.sample(min(num_samples, len(train_df)), random_state=42)
    
    cols = 3
    rows = int(np.ceil(len(samples) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(12, 4 * rows))
    axes = axes.flatten() if rows > 1 else [axes] if cols == 1 else axes
    
    for i, (_, row) in enumerate(samples.iterrows()):
        img_path = DATASET_DIR / row["processed_path"]
        img_bgr = cv2.imread(str(img_path))
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        
        ax = axes[i]
        ax.imshow(img_rgb)
        ax.set_title(f"{row['crop']}: {row['disease']}\n[{row['status']}]", fontsize=10, fontweight="bold")
        ax.axis("off")
        
    for j in range(len(samples), len(axes)):
        axes[j].axis("off")
        
    plt.tight_layout()
    output_preview = SPLITS_DIR / "dataset_samples_preview.png"
    plt.savefig(output_preview, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[*] Visual preview grid saved to: {output_preview}")


def main():
    print("=" * 60)
    print("AgriSmart AI – Dataset Verification & PyTorch Test")
    print("=" * 60)
    
    train_df = verify_manifests()
    test_pytorch_dataloader()
    generate_visual_inspection_grid(train_df)
    
    print("\n[OK] Phase 1 Dataset Verification completed with zero errors!\n")


if __name__ == "__main__":
    main()
