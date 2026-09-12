"""
AgriSmart AI – Targeted Retraining & Optimization Pipeline for EfficientNet-B0
Addresses identified root causes:
1. Leaf-lesion targeted augmentation (omitting RandomErasing, gentler crop scale 0.88-1.0)
2. Label smoothing (0.08) to reduce inter-blight overconfidence (Early vs Late Blight, Bacterial Spot)
3. Smoothed class-weighted Cross-Entropy to boost minority classes (Apple Scab, Potato Late Blight)
4. Deeper unfreezing of top 4 MBConv stages (blocks 5, 6, 7, 8)
5. Controlled 2+2 epoch schedule with CosineAnnealingLR for proper convergence
Strict rule: Does NOT replace best_model.pt unless new Macro-F1 > old Macro-F1.
"""
import os
import sys
import json
import time
import shutil
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

# Path setup
ai_root = Path(__file__).resolve().parent.parent
workspace_root = ai_root.parent
for p in [str(ai_root), str(workspace_root)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.disease.dataset import (
    detect_dataset_path, discover_classes_and_samples, get_stratified_split,
    PlantVillageDataset
)
from ai.src.disease.augmentation import get_targeted_train_transforms, get_val_transforms
from ai.src.disease.models import build_crop_disease_model
from ai.src.disease.losses import build_criterion
from ai.src.disease.evaluate import evaluate_model, plot_confusion_matrix


def main():
    print("=" * 70)
    print(" AGRISMART AI – TARGETED EFFICIENTNET-B0 RETRAINING & BENCHMARK")
    print("=" * 70)

    old_macro_f1 = 0.8175
    old_accuracy = 0.8115
    old_precision = 0.8319
    old_recall = 0.8257

    print(f"[*] Baseline EfficientNet-B0 Metrics:")
    print(f"    Macro-F1 : {old_macro_f1:.4f}")
    print(f"    Accuracy : {old_accuracy:.4f}")
    print(f"    Precision: {old_precision:.4f}")
    print(f"    Recall   : {old_recall:.4f}")

    # Set compute resources
    cuda_available = torch.cuda.is_available()
    device = torch.device("cuda" if cuda_available else "cpu")
    if not cuda_available:
        torch.set_num_threads(min(12, os.cpu_count() or 4))
    print(f"[*] Compute Device: {device} (Threads: {torch.get_num_threads()})")

    # 1. Dataset & Stratified Split
    dataset_path = detect_dataset_path()
    class_names, all_samples, class_counts = discover_classes_and_samples(dataset_path)

    # Use reproducible seed 42 to preserve identical validation distribution
    train_samples, val_samples = get_stratified_split(
        all_samples,
        val_split=0.2,
        random_seed=42
    )

    # Use 900 stratified train samples & 260 val samples for fast, thorough CPU convergence
    np.random.seed(42)
    # Stratified selection for train
    by_class_train = {}
    for path, label in train_samples:
        by_class_train.setdefault(label, []).append((path, label))
    
    selected_train = []
    target_per_class = max(55, 900 // len(class_names))
    for label, items in by_class_train.items():
        take = min(len(items), target_per_class)
        chosen_indices = np.random.choice(len(items), size=take, replace=False)
        selected_train.extend([items[i] for i in chosen_indices])

    selected_val = val_samples[:260]
    print(f"[*] Stratified Training Samples: {len(selected_train)} across {len(class_names)} classes.")
    print(f"[*] Validation Samples: {len(selected_val)} (Apples-to-apples validation set).")

    # Calculate smoothed class weights from training samples
    train_cls_counts = np.zeros(len(class_names), dtype=np.float32)
    for _, l in selected_train:
        train_cls_counts[l] += 1
    
    max_c = np.max(train_cls_counts)
    smoothed_weights = (max_c / np.maximum(train_cls_counts, 1)) ** 0.5
    smoothed_weights = smoothed_weights / np.mean(smoothed_weights)
    weights_tensor = torch.tensor(smoothed_weights, dtype=torch.float32).to(device)

    # Build DataLoaders with TARGETED transforms
    train_dataset = PlantVillageDataset(selected_train, transform=get_targeted_train_transforms(image_size=224))
    val_dataset = PlantVillageDataset(selected_val, transform=get_val_transforms(image_size=224))

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=0)

    # 2. Build Model
    model = build_crop_disease_model(architecture="efficientnet_b0", num_classes=len(class_names), pretrained=True, dropout=0.25)
    model.to(device)

    # 3. Loss Criterion: Weighted Cross Entropy with Label Smoothing (0.08)
    criterion = nn.CrossEntropyLoss(weight=weights_tensor, label_smoothing=0.08)

    # 4. Stage 1: Freeze backbone, train head (2 epochs)
    print("\n" + "-" * 70)
    print("[*] STAGE 1: Training Classification Head with Label Smoothing (2 epochs)...")
    print("-" * 70)
    model.freeze_backbone()
    optimizer_s1 = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=1.2e-3, weight_decay=1e-4)

    for ep in range(1, 3):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer_s1.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer_s1.step()
            running_loss += loss.item() * len(y)
        train_loss = running_loss / len(train_dataset)
        val_m = evaluate_model(model, val_loader, device=device, class_names=class_names)
        print(f"    Epoch {ep}/2 [S1] ({time.time()-t0:.1f}s) - Train Loss: {train_loss:.4f} | Val Acc: {val_m['accuracy']:.4f} | Val Macro-F1: {val_m['macro_f1']:.4f}")

    # 5. Stage 2: Unfreeze upper 4 stages, fine-tune with Cosine Annealing (2 epochs)
    print("\n" + "-" * 70)
    print("[*] STAGE 2: Deep Fine-Tuning (Top 4 Stages) with Cosine Annealing (2 epochs)...")
    print("-" * 70)
    model.unfreeze_upper_layers()
    optimizer_s2 = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=1.8e-4, weight_decay=1e-4)
    scheduler_s2 = CosineAnnealingLR(optimizer_s2, T_max=2, eta_min=1e-5)

    best_state_dict = None
    best_val_metrics = None
    best_f1 = -1.0

    for ep in range(1, 3):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer_s2.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer_s2.step()
            running_loss += loss.item() * len(y)
        scheduler_s2.step()

        train_loss = running_loss / len(train_dataset)
        val_m = evaluate_model(model, val_loader, device=device, class_names=class_names)
        print(f"    Epoch {ep}/2 [S2] ({time.time()-t0:.1f}s) - Train Loss: {train_loss:.4f} | Val Acc: {val_m['accuracy']:.4f} | Val Macro-F1: {val_m['macro_f1']:.4f}")

        if val_m["macro_f1"] > best_f1:
            best_f1 = val_m["macro_f1"]
            best_val_metrics = val_m
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # 6. Evaluation Comparison
    new_macro_f1 = best_val_metrics["macro_f1"]
    new_accuracy = best_val_metrics["accuracy"]
    new_precision = best_val_metrics["macro_precision"]
    new_recall = best_val_metrics["macro_recall"]
    diff_f1 = new_macro_f1 - old_macro_f1

    print("\n" + "=" * 70)
    print(" VERIFICATION & COMPARISON AGAINST BASELINE")
    print("=" * 70)
    print(f"Old Macro-F1 : {old_macro_f1:.4f}")
    print(f"New Macro-F1 : {new_macro_f1:.4f}")
    print(f"Improvement  : {diff_f1:+.4f} ({diff_f1*100:+.2f}%)")

    # 7. Model Replacement Check
    if new_macro_f1 > old_macro_f1:
        print("\n[SUCCESS] New model strictly outperformed baseline! Updating model registry & checkpoints...")
        
        # Save updated checkpoints
        model_payload = {
            "architecture": "efficientnet_b0",
            "model_state_dict": best_state_dict,
            "class_names": class_names,
            "metrics": best_val_metrics
        }
        
        models_disease_dir = ai_root / "models" / "disease"
        torch.save(model_payload, models_disease_dir / "best_model.pt")
        torch.save(model_payload, models_disease_dir / "efficientnet_b0.pt")

        # Save config
        with open(models_disease_dir / "model_config.json", "w", encoding="utf-8") as f:
            json.dump({
                "best_architecture": "efficientnet_b0",
                "num_classes": len(class_names),
                "image_size": 224,
                "confidence_threshold": 0.60,
                "normalization": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
                "primary_metric": "macro_f1",
                "score": new_macro_f1,
                "improvements": ["targeted_leaf_augmentation", "label_smoothing_0.08", "smoothed_class_weights", "deep_unfreeze_top4"]
            }, f, indent=4)

        # Update per-class metrics
        reports_metrics_dir = ai_root / "reports" / "metrics"
        with open(reports_metrics_dir / "disease_per_class_metrics.json", "w", encoding="utf-8") as f:
            json.dump(best_val_metrics["per_class"], f, indent=4)

        # Update confusion matrix figure
        reports_fig_dir = ai_root / "reports" / "figures"
        plot_confusion_matrix(
            best_val_metrics["confusion_matrix"],
            class_names,
            str(reports_fig_dir / "confusion_matrix.png"),
            title=f"Confusion Matrix – Optimized EfficientNet-B0 (Macro-F1: {new_macro_f1:.4f})"
        )

        # Update model registry
        registry_path = ai_root / "models" / "model_registry.json"
        if registry_path.exists():
            with open(registry_path, "r", encoding="utf-8") as f:
                reg = json.load(f)
            reg["disease"]["score"] = new_macro_f1
            reg["disease"]["accuracy"] = new_accuracy
            reg["disease"]["training_date"] = time.strftime("%Y-%m-%d %H:%M:%S")
            with open(registry_path, "w", encoding="utf-8") as f:
                json.dump(reg, f, indent=4)

        # Sync to workspace root
        for folder in ["models", "reports"]:
            src_f = ai_root / folder
            dst_f = workspace_root / folder
            if src_f.exists():
                shutil.copytree(src_f, dst_f, dirs_exist_ok=True)

        print("[OK] Checkpoints, figures, and registry successfully updated!")
    else:
        print("\n[NOTE] New model did not exceed baseline Macro-F1. Preserving existing baseline checkpoint as required.")

    # 8. Print Final Required Output
    print("\n" + "=" * 50)
    print(f"Old Macro-F1: {old_macro_f1:.4f}")
    print(f"New Macro-F1: {new_macro_f1:.4f}")
    print(f"Improvement: {diff_f1:+.4f}")
    print("=" * 50)


if __name__ == "__main__":
    main()
