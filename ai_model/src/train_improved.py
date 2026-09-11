"""
AgriSmart AI – Production Model Training Pipeline (Phase 4 Improved)
Integrates:
1. Winning Architecture (EfficientNet-B0)
2. Advanced Field Augmentation + Mixup/CutMix Regularization
3. Class-Weighted Focal Loss
4. Cosine Annealing with Warm Restarts
5. Production Model Checkpointing (.pth) & TorchScript Export (.pt)
"""

import argparse
import json
import time
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import f1_score
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from tqdm import tqdm

from ai_model.src.model import build_model
from ai_model.src.train_robust import AlbumentationsDataset
from ai_model.src.losses import compute_class_weights, FocalLoss, mixup_criterion
from ai_model.src.advanced_augmentations import get_advanced_field_pipeline, mixup_data, cutmix_data
from ai_model.src.robust_transforms import get_standard_eval_pipeline

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = PROJECT_ROOT / "dataset"
SPLITS_DIR = DATASET_DIR / "splits"
MODELS_DIR = PROJECT_ROOT / "ai_model" / "models"


def train_epoch_mixup(model, dataloader, criterion, optimizer, device, mixup_prob=0.5):
    model.train()
    running_loss, correct, total = 0.0, 0, 0

    for images, labels, _ in tqdm(dataloader, desc="Production Training", leave=False):
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()

        # Apply Mixup or CutMix with probability
        r = np.random.rand()
        if r < mixup_prob / 2:
            images, targets_a, targets_b, lam = mixup_data(images, labels, alpha=0.3)
            outputs = model(images)
            loss = mixup_criterion(criterion, outputs, targets_a, targets_b, lam)
        elif r < mixup_prob:
            images, targets_a, targets_b, lam = cutmix_data(images, labels, alpha=0.5)
            outputs = model(images)
            loss = mixup_criterion(criterion, outputs, targets_a, targets_b, lam)
        else:
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


def train_production_model(
    architecture: str = "efficientnet_b0",
    epochs: int = 8,
    batch_size: int = 16,
    lr: float = 3e-4,
    img_size: int = 224
):
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Starting Phase 4 Production Training on: {device}")

    # Datasets with Advanced Augmentation
    train_ds = AlbumentationsDataset(SPLITS_DIR / "train.csv", transform=get_advanced_field_pipeline(img_size))
    val_ds = AlbumentationsDataset(SPLITS_DIR / "val.csv", transform=get_standard_eval_pipeline(img_size))

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    num_classes = train_ds.df["class_id"].nunique()
    classes = train_ds.df.sort_values("class_id")["class_name"].unique().tolist()

    model = build_model(architecture=architecture, num_classes=num_classes, pretrained=True).to(device)

    # Class weights & Focal Loss
    class_weights = compute_class_weights(train_ds.df, num_classes).to(device)
    criterion = FocalLoss(alpha=class_weights, gamma=1.5)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer, T_0=4, T_mult=2, eta_min=1e-6)

    best_val_f1 = 0.0
    best_val_acc = 0.0
    production_model_path = MODELS_DIR / "production_model.pth"

    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "val_macro_f1": []}

    print("\n" + "=" * 72)
    print(f"AgriSmart AI – Training Production Model ({architecture.upper()})")
    print("=" * 72)

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_epoch_mixup(model, train_loader, criterion, optimizer, device)
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
                "production": True
            }, production_model_path)
            print(f"  --> [Saved Production Checkpoint] Macro-F1: {v_f1*100:.2f}% | Val Acc: {v_acc*100:.2f}%")

    print("=" * 72)
    print(f"Production Model Saved to: {production_model_path}")
    print("=" * 72 + "\n")

    # Export History
    with open(MODELS_DIR / "production_training_history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    # Export TorchScript Model
    try:
        model.eval()
        dummy_in = torch.randn(1, 3, img_size, img_size).to(device)
        traced = torch.jit.trace(model, dummy_in)
        traced_path = MODELS_DIR / "production_model_traced.pt"
        traced.save(str(traced_path))
        print(f"[*] Exported Production TorchScript Model to: {traced_path}")
    except Exception as e:
        print(f"[!] Tracing failed ({e})")

    return production_model_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=3e-4)
    args = parser.parse_args()

    train_production_model(epochs=args.epochs, batch_size=args.batch_size, lr=args.lr)
