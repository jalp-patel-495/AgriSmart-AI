"""
AgriSmart AI – Comparative Generalization & Robustness Benchmark
Compares Baseline vs Robust Model on:
1. Standard Clean Test Set
2. Field-Perturbed Stress Test (Sun Glare, Motion Blur, Shadow Occlusion, ISO Noise)

Metrics:
- Accuracy
- Macro-Precision
- Macro-Recall
- Macro-F1 Score
"""

import json
from pathlib import Path
import cv2
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import torch
from torch.utils.data import Dataset, DataLoader

from ai_model.src.model import build_model
from ai_model.src.robust_transforms import get_field_stress_test_pipeline, get_standard_eval_pipeline

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = PROJECT_ROOT / "dataset"
SPLITS_DIR = DATASET_DIR / "splits"
MODELS_DIR = PROJECT_ROOT / "ai_model" / "models"


class EvalDataset(Dataset):
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
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        if self.transform:
            augmented = self.transform(image=img_rgb)["image"]
            img_tensor = torch.from_numpy(augmented).permute(2, 0, 1).float()
        else:
            img_tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float() / 255.0

        return img_tensor, int(row["class_id"]), row["class_name"]


def evaluate_model_on_loader(model, dataloader, device):
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
    prec = precision_score(y_true, y_pred, average="macro", zero_division=0)
    rec = recall_score(y_true, y_pred, average="macro", zero_division=0)
    f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)

    return {
        "accuracy": round(float(acc) * 100, 2),
        "macro_precision": round(float(prec) * 100, 2),
        "macro_recall": round(float(rec) * 100, 2),
        "macro_f1": round(float(f1) * 100, 2),
    }


def run_robustness_benchmark():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Running robustness benchmark on device: {device}")

    test_csv = SPLITS_DIR / "test.csv"
    clean_loader = DataLoader(EvalDataset(test_csv, transform=get_standard_eval_pipeline(224)), batch_size=16, shuffle=False)
    perturbed_loader = DataLoader(EvalDataset(test_csv, transform=get_field_stress_test_pipeline(224)), batch_size=16, shuffle=False)

    baseline_ckpt_path = MODELS_DIR / "best_model.pth"
    robust_ckpt_path = MODELS_DIR / "robust_model.pth"

    if not baseline_ckpt_path.exists():
        raise FileNotFoundError(f"Baseline checkpoint not found: {baseline_ckpt_path}")
    if not robust_ckpt_path.exists():
        raise FileNotFoundError(f"Robust checkpoint not found: {robust_ckpt_path}")

    # Load Baseline Model
    ckpt_base = torch.load(baseline_ckpt_path, map_location=device, weights_only=False)
    m_base = build_model(ckpt_base.get("architecture", "efficientnet_b0"), num_classes=ckpt_base.get("num_classes", 13), pretrained=False).to(device)
    m_base.load_state_dict(ckpt_base["model_state_dict"])

    # Load Robust Model
    ckpt_rob = torch.load(robust_ckpt_path, map_location=device, weights_only=False)
    m_rob = build_model(ckpt_rob.get("architecture", "efficientnet_b0"), num_classes=ckpt_rob.get("num_classes", 13), pretrained=False).to(device)
    m_rob.load_state_dict(ckpt_rob["model_state_dict"])

    print("\nEvaluating Baseline Model...")
    base_clean = evaluate_model_on_loader(m_base, clean_loader, device)
    base_perturbed = evaluate_model_on_loader(m_base, perturbed_loader, device)

    print("Evaluating Robust Model...")
    rob_clean = evaluate_model_on_loader(m_rob, clean_loader, device)
    rob_perturbed = evaluate_model_on_loader(m_rob, perturbed_loader, device)

    print("\n" + "=" * 72)
    print("AGRISmart AI – Real-World Field Robustness Benchmark")
    print("=" * 72)
    print(f"{'Condition / Model':<30} | {'Accuracy':<10} | {'Macro-F1':<10} | {'Precision':<10} | {'Recall':<10}")
    print("-" * 72)
    print(f"{'Baseline (Clean Test)':<30} | {base_clean['accuracy']:<9}% | {base_clean['macro_f1']:<9}% | {base_clean['macro_precision']:<9}% | {base_clean['macro_recall']:<9}%")
    print(f"{'Baseline (Field Perturbed)':<30} | {base_perturbed['accuracy']:<9}% | {base_perturbed['macro_f1']:<9}% | {base_perturbed['macro_precision']:<9}% | {base_perturbed['macro_recall']:<9}%")
    print("-" * 72)
    print(f"{'Robust (Clean Test)':<30} | {rob_clean['accuracy']:<9}% | {rob_clean['macro_f1']:<9}% | {rob_clean['macro_precision']:<9}% | {rob_clean['macro_recall']:<9}%")
    print(f"{'Robust (Field Perturbed)':<30} | {rob_perturbed['accuracy']:<9}% | {rob_perturbed['macro_f1']:<9}% | {rob_perturbed['macro_precision']:<9}% | {rob_perturbed['macro_recall']:<9}%")
    print("=" * 72)

    # Plot Comparison Chart
    metrics = ["Accuracy", "Macro-F1", "Precision", "Recall"]
    base_scores = [base_perturbed["accuracy"], base_perturbed["macro_f1"], base_perturbed["macro_precision"], base_perturbed["macro_recall"]]
    rob_scores = [rob_perturbed["accuracy"], rob_perturbed["macro_f1"], rob_perturbed["macro_precision"], rob_perturbed["macro_recall"]]

    x = np.arange(len(metrics))
    width = 0.35

    fig, ax = plt.subplots(figsize=(10, 6))
    rects1 = ax.bar(x - width/2, base_scores, width, label="Baseline Model (Phase 2)", color="#ef4444", alpha=0.85)
    rects2 = ax.bar(x + width/2, rob_scores, width, label="Robust Model (Phase 3)", color="#10b981", alpha=0.9)

    ax.set_ylabel("Score (%)", fontsize=11, fontweight="bold")
    ax.set_title("Performance Under Harsh Real-World Field Conditions\n(Glare, Motion Blur, Shadows, Camera Noise)", fontsize=13, fontweight="bold", pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=10, fontweight="bold")
    ax.legend(frameon=True, facecolor="#f8fafc")
    ax.grid(axis="y", linestyle="--", alpha=0.6)
    ax.set_ylim(0, 105)

    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f"{height:.1f}%",
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 3),
                        textcoords="offset points",
                        ha="center", va="bottom", fontsize=9, fontweight="bold")

    autolabel(rects1)
    autolabel(rects2)

    plt.tight_layout()
    chart_path = MODELS_DIR / "robustness_comparison.png"
    plt.savefig(chart_path, dpi=150)
    plt.close()
    print(f"\n[*] Robustness comparison chart saved to: {chart_path}")

    # Export report
    report = {
        "baseline_clean": base_clean,
        "baseline_field_perturbed": base_perturbed,
        "robust_clean": rob_clean,
        "robust_field_perturbed": rob_perturbed,
        "field_f1_delta": round(rob_perturbed["macro_f1"] - base_perturbed["macro_f1"], 2)
    }
    report_file = MODELS_DIR / "robustness_benchmark_report.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"[*] Benchmark report saved to: {report_file}\n")
    return report


if __name__ == "__main__":
    run_robustness_benchmark()
