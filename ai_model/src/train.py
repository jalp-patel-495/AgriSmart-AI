"""
AgriSmart AI – Deep Learning Model Training Pipeline
Framework: PyTorch
Optimizer: AdamW + CosineAnnealingLR
Regularization: Label Smoothing + EarlyStopping + Model Checkpointing
"""

import argparse
import json
import time
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import f1_score
import torch
import torch.nn as nn
from tqdm import tqdm

from ai_model.src.model import build_model
from ai_model.src.dataset_loader import get_dataloaders

# Directory references
PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "ai_model" / "models"


def train_one_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels, _ in tqdm(dataloader, desc="Training", leave=False):
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

    epoch_loss = running_loss / max(1, total)
    epoch_acc = correct / max(1, total)
    return epoch_loss, epoch_acc


def validate(model, dataloader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    all_preds = []
    all_labels = []

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

    epoch_loss = running_loss / max(1, total)
    epoch_acc = correct / max(1, total)
    macro_f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    return epoch_loss, epoch_acc, macro_f1


def plot_training_curves(history: dict, output_path: Path):
    """Plots and saves loss and accuracy curves."""
    epochs = range(1, len(history["train_loss"]) + 1)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Loss Plot
    ax1.plot(epochs, history["train_loss"], "o-", label="Train Loss", color="#ef4444", lw=2)
    ax1.plot(epochs, history["val_loss"], "s-", label="Val Loss", color="#f97316", lw=2)
    ax1.set_title("Cross-Entropy Loss Across Epochs", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend()

    # Accuracy Plot
    ax2.plot(epochs, [a * 100 for a in history["train_acc"]], "o-", label="Train Acc (%)", color="#10b981", lw=2)
    ax2.plot(epochs, [a * 100 for a in history["val_acc"]], "s-", label="Val Acc (%)", color="#3b82f6", lw=2)
    ax2.set_title("Classification Accuracy (%) Across Epochs", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Accuracy (%)")
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend()

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[*] Training curves plot saved to: {output_path}")


def train(
    architecture: str = "efficientnet_b0",
    epochs: int = 15,
    batch_size: int = 16,
    lr: float = 3e-4,
    patience: int = 5,
    pretrained: bool = True
):
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Using hardware accelerator device: {device}")

    # Load DataLoaders
    train_loader, val_loader, _, classes = get_dataloaders(batch_size=batch_size)
    num_classes = len(classes)
    print(f"[*] Loaded dataset with {num_classes} classes and {len(train_loader.dataset)} training samples.")

    # Build Model
    model = build_model(
        architecture=architecture,
        num_classes=num_classes,
        pretrained=pretrained
    ).to(device)

    # Loss, Optimizer, Scheduler
    criterion = nn.CrossEntropyLoss(label_smoothing=0.08)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_acc = 0.0
    best_epoch = 0
    patience_counter = 0

    history = {
        "train_loss": [],
        "train_acc": [],
        "val_loss": [],
        "val_acc": [],
        "val_macro_f1": []
    }

    best_model_path = MODELS_DIR / "best_model.pth"
    print("\n" + "=" * 70)
    print(f"Starting Training: {architecture.upper()} on {num_classes} Classes")
    print("=" * 70)

    start_total_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()

        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, val_f1 = validate(model, val_loader, criterion, device)
        scheduler.step()

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_macro_f1"].append(val_f1)

        duration = time.time() - epoch_start
        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] ({duration:.1f}s) | "
            f"Train Loss: {train_loss:.4f} - Train Acc: {train_acc*100:.1f}% | "
            f"Val Loss: {val_loss:.4f} - Val Acc: {val_acc*100:.1f}% - Val F1: {val_f1:.4f}"
        )

        # Checkpoint best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch
            patience_counter = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "architecture": architecture,
                "num_classes": num_classes,
                "classes": classes,
                "val_accuracy": val_acc,
                "val_macro_f1": val_f1
            }, best_model_path)
            print(f"  --> [Saved Best Model Checkpoint] Val Acc reached {val_acc*100:.2f}%")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\n[!] Early stopping triggered at epoch {epoch} (No improvement for {patience} epochs).")
                break

    total_time = time.time() - start_total_time
    print("=" * 70)
    print(f"Training Complete in {total_time/60:.2f} minutes!")
    print(f"Best Validation Accuracy: {best_val_acc*100:.2f}% at Epoch {best_epoch}")
    print(f"Saved Checkpoint: {best_model_path}")
    print("=" * 70 + "\n")

    # Export History & Curves
    history_path = MODELS_DIR / "training_history.json"
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    plot_training_curves(history, MODELS_DIR / "training_curves.png")

    # Save traced TorchScript for lightweight inference in backend
    try:
        model.eval()
        dummy_input = torch.randn(1, 3, 224, 224).to(device)
        traced_model = torch.jit.trace(model, dummy_input)
        traced_path = MODELS_DIR / "model_traced.pt"
        traced_model.save(str(traced_path))
        print(f"[*] Exported TorchScript model to: {traced_path}")
    except Exception as e:
        print(f"[!] Warning: Could not trace TorchScript model: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AgriSmart AI Crop Disease Model")
    parser.add_argument("--model", type=str, default="efficientnet_b0", help="Architecture name")
    parser.add_argument("--epochs", type=int, default=12, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument("--patience", type=int, default=5, help="Early stopping patience")
    parser.add_argument("--no-pretrained", action="store_true", help="Do not load ImageNet weights")
    args = parser.parse_args()

    train(
        architecture=args.model,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        patience=args.patience,
        pretrained=not args.no_pretrained
    )
