"""
AgriSmart AI – Robust Model Retraining with Real-World Field Augmentations
Incorporates:
- Albumentations outdoor farm transformations
- Label smoothing regularization
- Cosine Annealing Learning Rate
- Model checkpointing & TorchScript export
"""

import argparse
import json
import time
from pathlib import Path
import cv2
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import f1_score
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from tqdm import tqdm

from ai_model.src.model import build_model
from ai_model.src.robust_transforms import get_field_robust_pipeline, get_standard_eval_pipeline

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = PROJECT_ROOT / "dataset"
SPLITS_DIR = DATASET_DIR / "splits"
MODELS_DIR = PROJECT_ROOT / "ai_model" / "models"


class AlbumentationsDataset(Dataset):
    """PyTorch Dataset using Albumentations pipelines directly on OpenCV numpy arrays."""
    def __init__(self, csv_file: Path, transform=None):
        self.df = pd.read_csv(csv_file)
        self.dataset_dir = DATASET_DIR
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_path = self.dataset_dir / row["processed_path"]

        img_bgr = cv2.imread(str(img_path))
        if img_bgr is None:
            raise FileNotFoundError(f"Image could not be read: {img_path}")

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        if self.transform:
            augmented = self.transform(image=img_rgb)["image"]
            img_tensor = torch.from_numpy(augmented).permute(2, 0, 1).float()
        else:
            img_tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float() / 255.0

        label = int(row["class_id"])
        class_name = row["class_name"]
        return img_tensor, label, class_name


def train_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    running_loss, correct, total = 0.0, 0, 0

    for images, labels, _ in tqdm(dataloader, desc="Robust Training", leave=False):
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    return running_loss / max(1, total), correct / max(1, total)


def eval_epoch(model, dataloader, criterion, device):
    model.eval()
    running_loss, correct, total = 0.0, 0, 0
    all_preds, all_labels = [], []

    with torch.no_grad():
        for images, labels, _ in tqdm(dataloader, desc="Validation", leave=False):
            images, labels = images.to(device), labels.to(device)

            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    macro_f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    return running_loss / max(1, total), correct / max(1, total), macro_f1


def train_robust_model(
    architecture: str = "efficientnet_b0",
    epochs: int = 8,
    batch_size: int = 16,
    lr: float = 2.5e-4
):
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Starting Robust Model Retraining on: {device}")

    train_ds = AlbumentationsDataset(SPLITS_DIR / "train.csv", transform=get_field_robust_pipeline(224))
    val_ds = AlbumentationsDataset(SPLITS_DIR / "val.csv", transform=get_standard_eval_pipeline(224))

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    num_classes = train_ds.df["class_id"].nunique()
    classes = train_ds.df.sort_values("class_id")["class_name"].unique().tolist()

    # Load baseline model weights if available, or build fresh
    model = build_model(architecture=architecture, num_classes=num_classes, pretrained=True).to(device)
    baseline_checkpoint = MODELS_DIR / "best_model.pth"
    if baseline_checkpoint.exists():
        try:
            ckpt = torch.load(baseline_checkpoint, map_location=device, weights_only=False)
            model.load_state_dict(ckpt["model_state_dict"])
            print("[*] Successfully loaded Phase 2 baseline weights for fine-tuning.")
        except Exception as e:
            print(f"[!] Warning: Could not load baseline weights ({e}), continuing with pretrained backbone.")

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_f1 = 0.0
    best_val_acc = 0.0
    robust_model_path = MODELS_DIR / "robust_model.pth"

    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "val_macro_f1": []}

    print("\n" + "=" * 70)
    print(f"Training Robust Crop Disease Classifier ({architecture.upper()})")
    print("=" * 70)

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        v_loss, v_acc, v_f1 = eval_epoch(model, val_loader, criterion, device)
        scheduler.step()

        history["train_loss"].append(tr_loss)
        history["train_acc"].append(tr_acc)
        history["val_loss"].append(v_loss)
        history["val_acc"].append(v_acc)
        history["val_macro_f1"].append(v_f1)

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] ({time.time()-t0:.1f}s) | "
            f"Train Loss: {tr_loss:.4f} (Acc: {tr_acc*100:.1f}%) | "
            f"Val Loss: {v_loss:.4f} (Acc: {v_acc*100:.1f}% - Macro-F1: {v_f1*100:.1f}%)"
        )

        if v_f1 >= best_val_f1:
            best_val_f1 = v_f1
            best_val_acc = v_acc
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "architecture": architecture,
                "num_classes": num_classes,
                "classes": classes,
                "val_accuracy": v_acc,
                "val_macro_f1": v_f1,
                "robust": True
            }, robust_model_path)
            print(f"  --> [Saved Best Robust Checkpoint] Macro-F1: {v_f1*100:.2f}% | Val Acc: {v_acc*100:.2f}%")

    print("=" * 70)
    print(f"Robust Training Completed! Saved to: {robust_model_path}")
    print("=" * 70 + "\n")

    # Export history
    with open(MODELS_DIR / "robust_training_history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    # Export TorchScript
    try:
        model.eval()
        dummy_in = torch.randn(1, 3, 224, 224).to(device)
        traced = torch.jit.trace(model, dummy_in)
        traced_path = MODELS_DIR / "robust_model_traced.pt"
        traced.save(str(traced_path))
        print(f"[*] Exported Robust TorchScript to: {traced_path}")
    except Exception as e:
        print(f"[!] Warning: Tracing failed ({e})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2.5e-4)
    args = parser.parse_args()

    train_robust_model(epochs=args.epochs, batch_size=args.batch_size, lr=args.lr)
