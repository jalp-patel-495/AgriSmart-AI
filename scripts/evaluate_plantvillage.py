"""
AgriSmart AI – PlantVillage 38-Class Evaluation & Benchmarking Suite
Computes:
- Accuracy
- Precision (Macro & Weighted)
- Recall (Macro & Weighted)
- F1-score (Macro & Weighted)
- Per-class Breakdown
- Confusion Matrix (Saved as JSON and high-resolution PNG plot)
- Inference Latency (ms/sample)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Any

import torch
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)
import matplotlib
matplotlib.use("Agg")  # Headless backend
import matplotlib.pyplot as plt

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ai.src.disease.models import build_crop_disease_model
from ai.src.disease.predict import load_disease_model_artifacts
from scripts.train_plantvillage import load_dataset_from_splits_or_raw


def evaluate_checkpoint(
    checkpoint_path: Path,
    reports_dir: Path,
    batch_size: int = 32,
    device_name: str = "auto"
) -> Dict[str, Any]:
    """Runs complete evaluation pass on test partition."""
    if device_name == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(device_name)

    print("=" * 70)
    print(f"[*] AgriSmart AI – Model Evaluation & Benchmark")
    print(f"[*] Checkpoint : {checkpoint_path}")
    print(f"[*] Device     : {device}")
    print("=" * 70)

    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    class_names = ckpt.get("class_names", [])
    architecture = ckpt.get("architecture", "mobilenet_v3_large")
    num_classes = len(class_names)

    print(f"[*] Model Architecture: {architecture}")
    print(f"[*] Number of Classes : {num_classes}")

    model = build_crop_disease_model(architecture=architecture, num_classes=num_classes, pretrained=False)
    state_dict = ckpt.get("model_state_dict", ckpt)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    # Load test loader
    _, _, test_loader, _, _ = load_dataset_from_splits_or_raw(
        root_dir=PROJECT_ROOT,
        batch_size=batch_size,
        img_size=224,
        num_workers=0
    )

    all_preds = []
    all_targets = []
    total_time = 0.0
    total_samples = 0

    print("[*] Running inference on test samples...")
    with torch.no_grad():
        for inputs, targets in test_loader:
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

    # Calculate metrics
    acc = float(accuracy_score(all_targets, all_preds))
    macro_prec = float(precision_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_rec = float(recall_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_f1 = float(f1_score(all_targets, all_preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(all_targets, all_preds, average="weighted", zero_division=0))

    per_class_prec = precision_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    per_class_rec = recall_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    per_class_f1 = f1_score(all_targets, all_preds, average=None, zero_division=0).tolist()

    cm = confusion_matrix(all_targets, all_preds, labels=list(range(num_classes)))
    avg_latency_ms = (total_time / total_samples) * 1000 if total_samples > 0 else 0.0

    print("\n" + "=" * 55)
    print("        EVALUATION BENCHMARK RESULTS")
    print("=" * 55)
    print(f"Overall Accuracy      : {acc:.4f} ({acc*100:.2f}%)")
    print(f"Macro-Precision       : {macro_prec:.4f}")
    print(f"Macro-Recall          : {macro_rec:.4f}")
    print(f"Macro-F1 Score        : {macro_f1:.4f}")
    print(f"Weighted-F1 Score     : {weighted_f1:.4f}")
    print(f"Average Latency       : {avg_latency_ms:.2f} ms/image")
    print(f"Total Test Samples    : {total_samples}")
    print("=" * 55)

    reports_dir.mkdir(parents=True, exist_ok=True)

    # Save Confusion Matrix Plot
    cm_plot_path = reports_dir / "plantvillage_confusion_matrix.png"
    plt.figure(figsize=(14, 12))
    plt.imshow(cm, interpolation="nearest", cmap=plt.cm.Greens)
    plt.title(f"PlantVillage 38-Class Confusion Matrix ({architecture})", fontsize=14, fontweight="bold", pad=15)
    plt.colorbar()
    tick_marks = np.arange(num_classes)
    plt.xticks(tick_marks, class_names, rotation=90, fontsize=7)
    plt.yticks(tick_marks, class_names, fontsize=7)
    plt.xlabel("Predicted Class", fontweight="bold", fontsize=10)
    plt.ylabel("True Class", fontweight="bold", fontsize=10)
    plt.tight_layout()
    plt.savefig(cm_plot_path, dpi=200)
    plt.close()
    print(f"[OK] Confusion matrix saved to: {cm_plot_path}")

    # Build per-class dictionary
    per_class_summary = {}
    for idx, cname in enumerate(class_names):
        per_class_summary[cname] = {
            "precision": round(per_class_prec[idx], 4),
            "recall": round(per_class_rec[idx], 4),
            "f1_score": round(per_class_f1[idx], 4),
            "support": int(np.sum(all_targets == idx))
        }

    report_payload = {
        "model_architecture": architecture,
        "checkpoint_file": str(checkpoint_path.name),
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_test_samples": total_samples,
        "metrics": {
            "accuracy": round(acc, 4),
            "macro_precision": round(macro_prec, 4),
            "macro_recall": round(macro_rec, 4),
            "macro_f1": round(macro_f1, 4),
            "weighted_f1": round(weighted_f1, 4),
            "avg_latency_ms": round(avg_latency_ms, 2)
        },
        "per_class": per_class_summary,
        "confusion_matrix": cm.tolist()
    }

    report_json_path = reports_dir / "plantvillage_evaluation_report.json"
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)
    print(f"[OK] Evaluation report saved to: {report_json_path}")

    # Generate readable classification report text
    clf_report_text = classification_report(all_targets, all_preds, target_names=class_names, zero_division=0)
    report_txt_path = reports_dir / "plantvillage_classification_report.txt"
    with open(report_txt_path, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write(f"AgriSmart AI – PlantVillage 38-Class Classification Report ({architecture})\n")
        f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')} | Total Test Samples: {total_samples}\n")
        f.write(f"Accuracy : {acc:.4f} ({acc*100:.2f}%) | Macro-F1: {macro_f1:.4f} | Weighted-F1: {weighted_f1:.4f}\n")
        f.write("=" * 80 + "\n\n")
        f.write(clf_report_text)
        f.write("\n" + "=" * 80 + "\n")
    print(f"[OK] Readable classification report saved to: {report_txt_path}")

    return report_payload


def main():
    parser = argparse.ArgumentParser(description="Evaluate PlantVillage Crop Disease Model")
    parser.add_argument("--checkpoint", type=Path, default=PROJECT_ROOT / "models" / "disease" / "best_model.pt",
                        help="Path to trained model checkpoint (.pt)")
    parser.add_argument("--reports-dir", type=Path, default=PROJECT_ROOT / "reports",
                        help="Output directory for reports and plots")
    parser.add_argument("--batch-size", type=int, default=32, help="Mini-batch size")
    parser.add_argument("--device", type=str, default="auto", help="Compute device ('cpu', 'cuda', 'auto')")

    args = parser.parse_args()
    evaluate_checkpoint(
        checkpoint_path=args.checkpoint,
        reports_dir=args.reports_dir,
        batch_size=args.batch_size,
        device_name=args.device
    )


if __name__ == "__main__":
    main()
