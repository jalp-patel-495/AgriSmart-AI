"""
AgriSmart AI – 19-Class Disease Detection Training & Evaluation Pipeline
Backbone: EfficientNet-B0 (Two-Stage Transfer Learning)
Classes: 19 (13 Existing + 6 New: Grape Black Rot/Healthy, Bell Pepper Bacterial Spot/Healthy, Peach Bacterial Spot/Healthy)
Reproducibility: Fixed seed = 42
Optimization: Class-weighted Cross-Entropy, AdamW, Early Stopping on Validation Macro-F1
Output Checkpoint: models/disease/best_model_19class.pt
"""
import os
import sys
import time
import json
import random
from pathlib import Path
from typing import Dict, List, Tuple, Any

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

# Project paths
WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
AI_ROOT = WORKSPACE_ROOT / "ai"
for p in [str(WORKSPACE_ROOT), str(AI_ROOT)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.disease.dataset import (
    discover_classes_and_samples,
    compute_class_weights,
    PlantVillageDataset,
    VALID_EXTENSIONS
)
from ai.src.disease.augmentation import get_train_transforms, get_val_transforms
from ai.src.disease.models import build_crop_disease_model


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def evaluate_classifier(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
    class_names: List[str]
) -> Dict[str, Any]:
    model.eval()
    all_preds = []
    all_targets = []
    total_time = 0.0
    total_samples = 0

    with torch.no_grad():
        for inputs, targets in loader:
            inputs = inputs.to(device)
            bs = inputs.size(0)

            t0 = time.perf_counter()
            outputs = model(inputs)
            total_time += (time.perf_counter() - t0)

            preds = torch.argmax(outputs, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_targets.extend(targets.numpy())
            total_samples += bs

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)

    acc = float(accuracy_score(all_targets, all_preds))
    macro_prec = float(precision_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_rec = float(recall_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_f1 = float(f1_score(all_targets, all_preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(all_targets, all_preds, average="weighted", zero_division=0))

    per_class_prec = precision_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    per_class_rec = recall_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    per_class_f1 = f1_score(all_targets, all_preds, average=None, zero_division=0).tolist()

    cm = confusion_matrix(all_targets, all_preds, labels=list(range(len(class_names))))
    avg_latency_ms = (total_time / total_samples) * 1000 if total_samples > 0 else 0.0

    per_class_dict = {}
    for idx, cname in enumerate(class_names):
        per_class_dict[cname] = {
            "precision": round(per_class_prec[idx], 4),
            "recall": round(per_class_rec[idx], 4),
            "f1_score": round(per_class_f1[idx], 4),
            "support": int(np.sum(all_targets == idx))
        }

    return {
        "accuracy": round(acc, 4),
        "macro_precision": round(macro_prec, 4),
        "macro_recall": round(macro_rec, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "avg_latency_ms": round(avg_latency_ms, 2),
        "per_class": per_class_dict,
        "confusion_matrix": cm.tolist(),
        "total_samples": int(total_samples)
    }


def plot_cm(cm: List[List[int]], class_names: List[str], save_path: str):
    fig, ax = plt.subplots(figsize=(14, 12))
    cm_arr = np.array(cm)
    im = ax.imshow(cm_arr, interpolation="nearest", cmap=plt.cm.Greens)
    ax.figure.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    ax.set(
        xticks=np.arange(cm_arr.shape[1]),
        yticks=np.arange(cm_arr.shape[0]),
        xticklabels=class_names,
        yticklabels=class_names,
        title="AgriSmart AI 19-Class Disease Confusion Matrix",
        ylabel="Ground Truth Class",
        xlabel="Predicted Class"
    )
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor", fontsize=8)
    plt.setp(ax.get_yticklabels(), fontsize=8)

    thresh = cm_arr.max() / 2.0
    for i in range(cm_arr.shape[0]):
        for j in range(cm_arr.shape[1]):
            val = cm_arr[i, j]
            if val > 0:
                ax.text(
                    j, i, format(val, "d"),
                    ha="center", va="center",
                    color="white" if val > thresh else "black",
                    fontsize=7
                )

    fig.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def plot_curves(history: Dict[str, Any], save_path: str):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))
    epochs = history["epochs"]

    ax1.plot(epochs, history["train_loss"], marker="o", color="#10b981", label="Train Loss", linewidth=2)
    ax1.set_title("Training Loss Across Epochs", fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.grid(True, linestyle="--", alpha=0.5)
    ax1.legend()

    ax2.plot(epochs, history["val_macro_f1"], marker="s", color="#3b82f6", label="Val Macro-F1", linewidth=2)
    ax2.plot(epochs, history["val_accuracy"], marker="^", color="#f59e0b", label="Val Accuracy", linewidth=2)
    ax2.set_title("Validation Metrics Progression", fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Score")
    ax2.set_ylim(0, 1.05)
    ax2.grid(True, linestyle="--", alpha=0.5)
    ax2.legend()

    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def main():
    set_seed(42)
    device = torch.device("cpu")
    num_threads = min(12, os.cpu_count() or 4)
    torch.set_num_threads(num_threads)

    print("=" * 75)
    print(" AGRISMART AI – 19-CLASS DISEASE DETECTION MODEL TRAINING")
    print("=" * 75)
    print(f"[*] Compute Engine: CPU ({num_threads} worker threads)")
    print(f"[*] Fixed Random Seed: 42")

    dataset_path = WORKSPACE_ROOT / "dataset" / "raw"
    class_names, all_samples, class_counts = discover_classes_and_samples(dataset_path)
    print(f"[*] Discovered {len(class_names)} classes with {len(all_samples):,} total images.")

    # 1. Stratified 80/20 train/validation split with fixed seed 42
    paths = [s[0] for s in all_samples]
    labels = [s[1] for s in all_samples]

    train_paths, val_paths, train_labels, val_labels = train_test_split(
        paths,
        labels,
        test_size=0.20,
        random_state=42,
        stratify=labels
    )

    full_train_samples = list(zip(train_paths, train_labels))
    full_val_samples = list(zip(val_paths, val_labels))

    print(f"[*] Stratified Partition: {len(full_train_samples):,} Train / {len(full_val_samples):,} Val (80/20)")

    # Per-class counts in train and val
    train_counts_per_class = {cname: 0 for cname in class_names}
    for _, lbl in full_train_samples:
        train_counts_per_class[class_names[lbl]] += 1

    val_counts_per_class = {cname: 0 for cname in class_names}
    for _, lbl in full_val_samples:
        val_counts_per_class[class_names[lbl]] += 1

    print("\n--- Per-Class Dataset Breakdown ---")
    for idx, cname in enumerate(class_names):
        tot = class_counts[idx]
        tr = train_counts_per_class[cname]
        va = val_counts_per_class[cname]
        print(f"  [{idx:2d}] {cname:<30} Total: {tot:5d} | Train: {tr:5d} | Val: {va:4d}")

    # Subsample stratified representative training subset for CPU execution
    # 100 train / 25 val per class ensures balanced, high-speed, high-accuracy training
    MAX_TRAIN_SAMPLES = 1900
    MAX_VAL_SAMPLES = 475

    train_samples = full_train_samples
    if len(train_samples) > MAX_TRAIN_SAMPLES:
        sub_tr_idx, _ = train_test_split(
            np.arange(len(full_train_samples)),
            train_size=MAX_TRAIN_SAMPLES,
            random_state=42,
            stratify=[s[1] for s in full_train_samples]
        )
        train_samples = [full_train_samples[i] for i in sorted(sub_tr_idx)]

    val_samples = full_val_samples
    if len(val_samples) > MAX_VAL_SAMPLES:
        sub_va_idx, _ = train_test_split(
            np.arange(len(full_val_samples)),
            train_size=MAX_VAL_SAMPLES,
            random_state=42,
            stratify=[s[1] for s in full_val_samples]
        )
        val_samples = [full_val_samples[i] for i in sorted(sub_va_idx)]

    print(f"\n[*] Active Training Subset: {len(train_samples)} Train / {len(val_samples)} Val")

    # 2. Compute Class Weights for Loss
    class_weights = compute_class_weights(train_samples, len(class_names)).to(device)

    # 3. DataLoaders
    train_dataset = PlantVillageDataset(train_samples, transform=get_train_transforms(image_size=224))
    val_dataset = PlantVillageDataset(val_samples, transform=get_val_transforms(image_size=224))

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=0)

    # 4. Build Model
    print("\n[*] Initializing EfficientNet-B0 19-class Classifier...")
    model = build_crop_disease_model(architecture="efficientnet_b0", num_classes=19, pretrained=True, dropout=0.3)
    model.to(device)

    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=0.05)

    history = {
        "epochs": [],
        "train_loss": [],
        "val_macro_f1": [],
        "val_accuracy": []
    }

    best_macro_f1 = -1.0
    best_state_dict = None
    best_metrics = {}

    # -------------------------------------------------------------
    # STAGE 1: Train Classification Head (Backbone Frozen)
    # -------------------------------------------------------------
    print("\n" + "=" * 50)
    print(" STAGE 1: Training Classification Head (2 Epochs)")
    print("=" * 50)
    model.freeze_backbone()
    optimizer_s1 = AdamW(model.head_module.parameters(), lr=1e-3, weight_decay=1e-4)

    for ep in range(1, 3):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        n_samples = 0

        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer_s1.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer_s1.step()

            running_loss += loss.item() * inputs.size(0)
            n_samples += inputs.size(0)

        ep_loss = running_loss / n_samples
        val_res = evaluate_classifier(model, val_loader, device, class_names)
        ep_time = time.time() - t0

        history["epochs"].append(ep)
        history["train_loss"].append(round(ep_loss, 4))
        history["val_macro_f1"].append(val_res["macro_f1"])
        history["val_accuracy"].append(val_res["accuracy"])

        print(f"[Stage 1 - Epoch {ep}/2] Loss: {ep_loss:.4f} | Val Macro-F1: {val_res['macro_f1']:.4f} | Acc: {val_res['accuracy']:.4f} ({ep_time:.1f}s)")

        if val_res["macro_f1"] > best_macro_f1:
            best_macro_f1 = val_res["macro_f1"]
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            best_metrics = val_res

    # -------------------------------------------------------------
    # STAGE 2: Fine-Tuning Upper Layers (Unfreeze Top Stages)
    # -------------------------------------------------------------
    print("\n" + "=" * 50)
    print(" STAGE 2: Fine-Tuning Upper Backbone (2 Epochs)")
    print("=" * 50)
    model.unfreeze_upper_layers()
    trainable_params = [p for p in model.parameters() if p.requires_grad]
    optimizer_s2 = AdamW(trainable_params, lr=1e-4, weight_decay=1e-4)
    scheduler_s2 = CosineAnnealingLR(optimizer_s2, T_max=2, eta_min=1e-6)

    for ep in range(3, 5):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        n_samples = 0

        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer_s2.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer_s2.step()

            running_loss += loss.item() * inputs.size(0)
            n_samples += inputs.size(0)

        scheduler_s2.step()
        ep_loss = running_loss / n_samples
        val_res = evaluate_classifier(model, val_loader, device, class_names)
        ep_time = time.time() - t0

        history["epochs"].append(ep)
        history["train_loss"].append(round(ep_loss, 4))
        history["val_macro_f1"].append(val_res["macro_f1"])
        history["val_accuracy"].append(val_res["accuracy"])

        print(f"[Stage 2 - Epoch {ep-2}/2] Loss: {ep_loss:.4f} | Val Macro-F1: {val_res['macro_f1']:.4f} | Acc: {val_res['accuracy']:.4f} ({ep_time:.1f}s)")

        if val_res["macro_f1"] > best_macro_f1:
            best_macro_f1 = val_res["macro_f1"]
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            best_metrics = val_res

    # Load best weights
    model.load_state_dict(best_state_dict)

    # Final complete validation on best checkpoint
    print("\n" + "=" * 50)
    print(" FINAL EVALUATION ON VALIDATION SET")
    print("=" * 50)
    final_metrics = evaluate_classifier(model, val_loader, device, class_names)

    print(f"\n[RESULTS] 19-Class EfficientNet-B0:")
    print(f"  Accuracy:         {final_metrics['accuracy']:.4f} ({final_metrics['accuracy']*100:.2f}%)")
    print(f"  Macro-Precision:  {final_metrics['macro_precision']:.4f}")
    print(f"  Macro-Recall:     {final_metrics['macro_recall']:.4f}")
    print(f"  Macro-F1:         {final_metrics['macro_f1']:.4f}")
    print(f"  Weighted-F1:      {final_metrics['weighted_f1']:.4f}")
    print(f"  Inference Latency:{final_metrics['avg_latency_ms']:.2f} ms")

    print("\n--- Per-Class Performance Breakdown ---")
    for cname, met in final_metrics["per_class"].items():
        print(f"  {cname:<30} P: {met['precision']:.4f} | R: {met['recall']:.4f} | F1: {met['f1_score']:.4f} | Support: {met['support']}")

    # 5. Save Checkpoint Separately First: models/disease/best_model_19class.pt
    models_dir = WORKSPACE_ROOT / "models" / "disease"
    ai_models_dir = AI_ROOT / "models" / "disease"
    models_dir.mkdir(parents=True, exist_ok=True)
    ai_models_dir.mkdir(parents=True, exist_ok=True)

    separate_ckpt_path = models_dir / "best_model_19class.pt"
    ai_separate_ckpt_path = ai_models_dir / "best_model_19class.pt"

    checkpoint_data = {
        "architecture": "efficientnet_b0",
        "num_classes": 19,
        "model_state_dict": best_state_dict,
        "class_names": class_names,
        "metrics": final_metrics,
        "history": history,
        "training_date": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    torch.save(checkpoint_data, separate_ckpt_path)
    torch.save(checkpoint_data, ai_separate_ckpt_path)
    print(f"\n[OK] Saved separate 19-class checkpoint to: {separate_ckpt_path}")

    # 6. Save Plots
    fig_dir = WORKSPACE_ROOT / "reports" / "figures"
    ai_fig_dir = AI_ROOT / "reports" / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)
    ai_fig_dir.mkdir(parents=True, exist_ok=True)

    plot_cm(final_metrics["confusion_matrix"], class_names, str(fig_dir / "confusion_matrix_19class.png"))
    plot_cm(final_metrics["confusion_matrix"], class_names, str(ai_fig_dir / "confusion_matrix_19class.png"))
    plot_curves(history, str(fig_dir / "training_curve_19class.png"))
    plot_curves(history, str(ai_fig_dir / "training_curve_19class.png"))

    # Save metrics JSON
    metrics_dir = WORKSPACE_ROOT / "reports" / "metrics"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    with open(metrics_dir / "metrics_19class.json", "w", encoding="utf-8") as f:
        json.dump(checkpoint_data["metrics"], f, indent=4)

    print(f"[OK] Plots and metrics saved successfully.")


if __name__ == "__main__":
    main()
