"""
AgriSmart AI – Comprehensive Evaluation & Metrics Engine
Computes Macro-F1 (Primary Metric), Macro-Precision, Macro-Recall, Accuracy, Weighted-F1,
Per-class Breakdown, Confusion Matrix, and Inference Latency Benchmarks.
"""
import time
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)
import matplotlib.pyplot as plt


def evaluate_model(
    model: nn.Module,
    val_loader: DataLoader,
    device: torch.device,
    class_names: List[str]
) -> Dict[str, Any]:
    """
    Executes a complete evaluation pass over validation data.
    Returns dictionary with all primary and per-class metrics.
    """
    model.eval()
    all_preds = []
    all_targets = []
    total_time = 0.0
    total_samples = 0

    with torch.no_grad():
        for inputs, targets in val_loader:
            inputs = inputs.to(device)
            batch_size = inputs.size(0)

            t0 = time.perf_counter()
            outputs = model(inputs)
            total_time += (time.perf_counter() - t0)

            preds = torch.argmax(outputs, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_targets.extend(targets.numpy())
            total_samples += batch_size

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)

    # Core metrics
    acc = float(accuracy_score(all_targets, all_preds))
    macro_prec = float(precision_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_rec = float(recall_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_f1 = float(f1_score(all_targets, all_preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(all_targets, all_preds, average="weighted", zero_division=0))

    # Per-class metrics
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


def plot_confusion_matrix(
    cm: List[List[int]],
    class_names: List[str],
    save_path: str,
    title: str = "Disease Classification Confusion Matrix"
) -> None:
    """
    Renders and saves a high-resolution confusion matrix heatmap.
    """
    cm_arr = np.array(cm)
    fig, ax = plt.subplots(figsize=(10, 8))
    cax = ax.matshow(cm_arr, cmap=plt.cm.Greens)
    fig.colorbar(cax)

    ax.set_xticks(range(len(class_names)))
    ax.set_yticks(range(len(class_names)))
    ax.set_xticklabels(class_names, rotation=90, fontsize=8)
    ax.set_yticklabels(class_names, fontsize=8)
    ax.set_xlabel("Predicted Label", fontweight="bold")
    ax.set_ylabel("True Label", fontweight="bold")
    ax.set_title(title, pad=20, fontweight="bold")

    # Annotate cell counts
    for i in range(len(class_names)):
        for j in range(len(class_names)):
            val = cm_arr[i, j]
            color = "white" if val > cm_arr.max() / 2 else "black"
            ax.text(j, i, str(val), va='center', ha='center', color=color, fontsize=7)

    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()
