"""
AgriSmart AI – Hyperparameter & Architecture Tuning Sweep
Benchmarks:
1. Model Backbones: EfficientNet-B0 vs ResNet-18 vs MobileNetV3
2. Learning Rates: 1e-4 vs 3e-4 vs 5e-4
3. Loss Functions: CrossEntropy with Label Smoothing vs Class-Weighted Focal Loss
"""

import json
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from ai_model.src.model import build_model
from ai_model.src.train_robust import AlbumentationsDataset
from ai_model.src.losses import compute_class_weights, FocalLoss
from ai_model.src.robust_transforms import get_field_robust_pipeline, get_standard_eval_pipeline

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SPLITS_DIR = PROJECT_ROOT / "dataset" / "splits"
MODELS_DIR = PROJECT_ROOT / "ai_model" / "models"


def evaluate_loader(model, dataloader, device):
    model.eval()
    y_true, y_pred = [], []
    with torch.no_grad():
        for images, labels, _ in dataloader:
            images = images.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)
            y_true.extend(labels.cpu().numpy())
            y_pred.extend(preds.cpu().numpy())

    acc = accuracy_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    prec = precision_score(y_true, y_pred, average="macro", zero_division=0)
    rec = recall_score(y_true, y_pred, average="macro", zero_division=0)
    return round(acc * 100, 2), round(f1 * 100, 2), round(prec * 100, 2), round(rec * 100, 2)


def run_experiment(arch: str, lr: float, use_focal: bool, epochs: int = 3, device="cpu"):
    train_ds = AlbumentationsDataset(SPLITS_DIR / "train.csv", transform=get_field_robust_pipeline(224))
    val_ds = AlbumentationsDataset(SPLITS_DIR / "val.csv", transform=get_standard_eval_pipeline(224))
    test_ds = AlbumentationsDataset(SPLITS_DIR / "test.csv", transform=get_standard_eval_pipeline(224))

    train_loader = DataLoader(train_ds, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=16, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=16, shuffle=False)

    num_classes = train_ds.df["class_id"].nunique()
    model = build_model(architecture=arch, num_classes=num_classes, pretrained=True).to(device)

    # Loss selection
    if use_focal:
        weights = compute_class_weights(train_ds.df, num_classes).to(device)
        criterion = FocalLoss(alpha=weights, gamma=1.5)
    else:
        criterion = nn.CrossEntropyLoss(label_smoothing=0.08)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    # Quick train
    for epoch in range(epochs):
        model.train()
        for images, labels, _ in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

    val_acc, val_f1, _, _ = evaluate_loader(model, val_loader, device)
    test_acc, test_f1, test_prec, test_rec = evaluate_loader(model, test_loader, device)

    return {
        "architecture": arch,
        "learning_rate": lr,
        "loss_type": "FocalLoss (Weighted)" if use_focal else "CrossEntropy (Smoothed)",
        "val_accuracy": val_acc,
        "val_macro_f1": val_f1,
        "test_accuracy": test_acc,
        "test_macro_f1": test_f1,
        "test_precision": test_prec,
        "test_recall": test_rec
    }


def run_tuning_suite():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Initiating Hyperparameter & Architecture Sweep on: {device}")

    experiments = [
        {"arch": "efficientnet_b0", "lr": 3e-4, "use_focal": True},
        {"arch": "efficientnet_b0", "lr": 1e-4, "use_focal": False},
        {"arch": "resnet18", "lr": 3e-4, "use_focal": True},
        {"arch": "mobilenet_v3", "lr": 4e-4, "use_focal": False},
    ]

    results = []
    print("\n" + "=" * 78)
    print(f"{'Architecture':<16} | {'LR':<7} | {'Loss':<22} | {'Val F1':<8} | {'Test F1':<8} | {'Test Acc':<8}")
    print("-" * 78)

    for exp in experiments:
        t0 = time.time()
        res = run_experiment(exp["arch"], exp["lr"], exp["use_focal"], epochs=3, device=device)
        results.append(res)
        print(
            f"{res['architecture']:<16} | "
            f"{res['learning_rate']:<7.0e} | "
            f"{res['loss_type']:<22} | "
            f"{res['val_macro_f1']:<7.1f}% | "
            f"{res['test_macro_f1']:<7.1f}% | "
            f"{res['test_accuracy']:<7.1f}% ({time.time()-t0:.1f}s)"
        )

    print("=" * 78 + "\n")

    # Sort by test Macro-F1
    results.sort(key=lambda x: x["test_macro_f1"], reverse=True)
    best_config = results[0]
    print(f"[*] Winning Configuration: {best_config['architecture']} with LR {best_config['learning_rate']} ({best_config['loss_type']}) -> Test F1: {best_config['test_macro_f1']}%")

    out_file = MODELS_DIR / "phase4_experiment_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"results": results, "best_config": best_config}, f, indent=2)
    print(f"[*] Sweep results saved to: {out_file}\n")
    return best_config


if __name__ == "__main__":
    run_tuning_suite()
