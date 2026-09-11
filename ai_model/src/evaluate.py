"""
AgriSmart AI – Crop Disease Model Evaluation & Metrics Analysis
Computes:
1. Overall Accuracy
2. Macro-Precision
3. Macro-Recall
4. Macro-F1 Score
5. Per-class Classification Report
6. Confusion Matrix Heatmap (Seaborn + Matplotlib)
"""

import argparse
import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)
import torch

from ai_model.src.model import build_model
from ai_model.src.dataset_loader import get_dataloaders

# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "ai_model" / "models"


def evaluate_model(model_checkpoint_path: Path = MODELS_DIR / "best_model.pth"):
    if not model_checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint file not found: {model_checkpoint_path}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Loading checkpoint from: {model_checkpoint_path}")

    checkpoint = torch.load(model_checkpoint_path, map_location=device, weights_only=False)
    architecture = checkpoint.get("architecture", "efficientnet_b0")
    num_classes = checkpoint.get("num_classes", 13)
    classes = checkpoint.get("classes", [])

    # Reconstruct model and load weights
    model = build_model(architecture=architecture, num_classes=num_classes, pretrained=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()

    # Load test split
    _, _, test_loader, test_classes = get_dataloaders(batch_size=16)
    if not classes:
        classes = test_classes

    print(f"[*] Evaluating on {len(test_loader.dataset)} held-out test samples across {len(classes)} classes...")

    y_true = []
    y_pred = []

    with torch.no_grad():
        for images, labels, _ in test_loader:
            images = images.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)

            y_true.extend(labels.cpu().numpy())
            y_pred.extend(preds.cpu().numpy())

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)

    # Compute Global Metrics
    acc = accuracy_score(y_true, y_pred)
    macro_precision = precision_score(y_true, y_pred, average="macro", zero_division=0)
    macro_recall = recall_score(y_true, y_pred, average="macro", zero_division=0)
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)

    print("\n" + "=" * 65)
    print("AGRISmart AI – Model Evaluation Results (Test Split)")
    print("=" * 65)
    print(f"Accuracy         : {acc * 100:.2f}%")
    print(f"Macro-Precision  : {macro_precision * 100:.2f}%")
    print(f"Macro-Recall     : {macro_recall * 100:.2f}%")
    print(f"Macro-F1 Score   : {macro_f1 * 100:.2f}%")
    print("=" * 65 + "\n")

    # Classification Report
    labels_present = np.unique(np.concatenate((y_true, y_pred)))
    target_names = [classes[i] for i in labels_present]
    report_text = classification_report(y_true, y_pred, labels=labels_present, target_names=target_names, zero_division=0)
    print("Detailed Classification Report:\n")
    print(report_text)

    # Generate Confusion Matrix
    cm = confusion_matrix(y_true, y_pred, labels=labels_present)
    
    # Save Confusion Matrix Heatmap
    plt.figure(figsize=(12, 10))
    # Clean display labels for neat axis readability
    short_labels = [name.replace("___", "\n").replace("_", " ") for name in target_names]
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="YlGnBu",
        xticklabels=short_labels,
        yticklabels=short_labels,
        cbar=True,
        linewidths=0.5,
        linecolor="lightgray"
    )
    plt.title(f"Crop Disease Detection Confusion Matrix ({architecture.upper()})\nAccuracy: {acc*100:.1f}% | Macro-F1: {macro_f1*100:.1f}%", fontsize=14, fontweight="bold", pad=15)
    plt.xlabel("Predicted Class", fontsize=11, fontweight="bold")
    plt.ylabel("Ground Truth Class", fontsize=11, fontweight="bold")
    plt.xticks(rotation=45, ha="right", fontsize=8)
    plt.yticks(rotation=0, fontsize=8)
    plt.tight_layout()

    cm_output_path = MODELS_DIR / "confusion_matrix.png"
    plt.savefig(cm_output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[*] Confusion matrix heatmap saved to: {cm_output_path}")

    # Export JSON metrics
    metrics_summary = {
        "architecture": architecture,
        "checkpoint_epoch": checkpoint.get("epoch", 0),
        "test_samples": int(len(y_true)),
        "accuracy": round(float(acc), 4),
        "macro_precision": round(float(macro_precision), 4),
        "macro_recall": round(float(macro_recall), 4),
        "macro_f1": round(float(macro_f1), 4),
        "classes": classes
    }
    metrics_json_path = MODELS_DIR / "test_metrics.json"
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)

    print(f"[*] Test metrics summary exported to: {metrics_json_path}\n")
    return metrics_summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate AgriSmart AI Crop Disease Model")
    parser.add_argument("--model-path", type=str, default=str(MODELS_DIR / "best_model.pth"), help="Path to checkpoint")
    args = parser.parse_args()

    evaluate_model(Path(args.model_path))
