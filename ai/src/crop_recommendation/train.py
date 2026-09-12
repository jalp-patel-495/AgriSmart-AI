"""
AgriSmart AI – Crop Recommendation Multi-Model Benchmarking & Training Pipeline
Trains, evaluates, and compares multiple supervised learning algorithms:
- Random Forest Classifier
- Gradient Boosting Classifier
- XGBoost Classifier
- LightGBM Classifier

Selects best model via Validation Macro-F1, serializes preprocessing objects and models,
generates comparison figures and reports, and registers the winning model.
"""
import os
import sys
import json
import time
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

# Optional XGBoost & LightGBM imports
try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    import lightgbm as lgb
    HAS_LGB = True
except ImportError:
    HAS_LGB = False


ai_root = Path(__file__).resolve().parents[2]
workspace_root = ai_root.parent


def detect_crop_dataset_path(preferred_path: Optional[str] = None) -> Path:
    """
    Automatically discovers Crop_recommendation.csv across canonical workspace paths.
    """
    candidates = []
    if preferred_path:
        candidates.append(Path(preferred_path))

    candidates.extend([
        workspace_root / "dataset" / "Crop_recommendation.csv",
        workspace_root / "dataset" / "crop_recommendation.csv",
        workspace_root / "data" / "Crop_recommendation.csv",
        workspace_root / "data" / "crop_recommendation.csv",
        ai_root / "data" / "Crop_recommendation.csv",
        ai_root / "data" / "crop_recommendation.csv",
        workspace_root / "Crop_recommendation.csv",
        workspace_root / "crop_recommendation.csv",
    ])

    for c in candidates:
        if c and c.exists() and c.is_file():
            return c.resolve()

    raise FileNotFoundError(
        f"Crop_recommendation.csv not found in candidate paths: {[str(c) for c in candidates]}"
    )


def render_crop_confusion_matrix(cm: np.ndarray, class_names: List[str], save_path: str):
    """Plots and saves normalized confusion matrix for crop recommendation."""
    fig, ax = plt.subplots(figsize=(14, 12))
    cm_norm = cm.astype('float') / np.maximum(cm.sum(axis=1)[:, np.newaxis], 1)
    im = ax.imshow(cm_norm, interpolation='nearest', cmap=plt.cm.YlGn)
    ax.figure.colorbar(im, ax=ax)

    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=class_names,
        yticklabels=class_names,
        title="Crop Recommendation Confusion Matrix",
        ylabel="Actual Crop",
        xlabel="Recommended Crop"
    )
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

    thresh = cm_norm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            val = cm[i, j]
            if val > 0:
                ax.text(j, i, f"{val}", ha="center", va="center",
                        color="white" if cm_norm[i, j] > thresh else "black", fontsize=8)

    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def render_feature_importance(model: Any, feature_names: List[str], save_path: str, model_name: str):
    """Plots feature importance for tree-based models."""
    if not hasattr(model, "feature_importances_"):
        return

    importances = model.feature_importances_
    indices = np.argsort(importances)

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh(range(len(indices)), importances[indices], color="#10b981", edgecolor="#059669")
    ax.set_yticks(range(len(indices)))
    ax.set_yticklabels([feature_names[i] for i in indices], fontweight="semibold")
    ax.set_xlabel("Relative Importance Score", fontweight="bold")
    ax.set_title(f"Feature Importance – {model_name}", fontweight="bold")
    ax.grid(True, axis="x", linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def train_crop_recommendation(
    dataset_path: Optional[str] = None,
    output_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes full crop recommendation training, benchmarking, and artifact serialization.
    """
    print("=" * 70)
    print(" AGRISMART AI – CROP RECOMMENDATION TRAINING & BENCHMARK")
    print("=" * 70)

    # 1. Dataset Detection
    try:
        data_file = detect_crop_dataset_path(dataset_path)
    except FileNotFoundError as e:
        print(f"[SKIPPED] {e}")
        return {
            "status": "SKIPPED",
            "reason": str(e),
            "best_model": None,
            "metrics": None
        }

    print(f"[*] Detected Dataset: {data_file}")
    df = pd.read_csv(data_file)
    print(f"[*] Raw Dataset Shape: {df.shape[0]} rows, {df.shape[1]} columns")

    # 2. Inspect Columns and Target
    print(f"[*] Columns: {list(df.columns)}")
    target_col = [c for c in df.columns if c.lower() == "label"][0]
    feature_cols = [c for c in df.columns if c != target_col]
    print(f"[*] Features ({len(feature_cols)}): {feature_cols}")
    print(f"[*] Target column: '{target_col}' ({df[target_col].nunique()} distinct crops)")

    # 3. Validate Missing Values & Duplicates
    null_counts = df.isnull().sum()
    total_nulls = null_counts.sum()
    duplicate_count = df.duplicated().sum()

    print(f"[*] Data Validation:")
    print(f"    - Missing Values: {total_nulls}")
    print(f"    - Duplicate Rows: {duplicate_count}")

    if duplicate_count > 0:
        df = df.drop_duplicates().reset_index(drop=True)
        print(f"    - Deduplicated Shape: {df.shape}")

    if total_nulls > 0:
        df = df.dropna().reset_index(drop=True)
        print(f"    - Imputed/Cleaned Shape: {df.shape}")

    # 4. Preprocess Features and Labels
    X = df[feature_cols].copy()
    y_raw = df[target_col].copy()

    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(y_raw)
    class_names = list(label_encoder.classes_)

    # 5. Reproducible Stratified Split (80% Train / 20% Val)
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"[*] Partition: {len(X_train)} Train specimens vs {len(X_val)} Validation specimens (Seed=42)")

    # Feature Scaling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    # 6. Define Candidate Models
    candidate_models: Dict[str, Any] = {
        "Random Forest": RandomForestClassifier(
            n_estimators=150,
            max_depth=16,
            min_samples_split=2,
            random_state=42,
            n_jobs=-1
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=120,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
    }

    if HAS_XGB:
        candidate_models["XGBoost"] = xgb.XGBClassifier(
            n_estimators=150,
            max_depth=6,
            learning_rate=0.1,
            random_state=42,
            eval_metric="mlogloss",
            n_jobs=-1
        )
    else:
        print("[!] XGBoost not available, skipping XGBoost benchmark.")

    if HAS_LGB:
        candidate_models["LightGBM"] = lgb.LGBMClassifier(
            n_estimators=150,
            max_depth=6,
            learning_rate=0.1,
            random_state=42,
            verbose=-1,
            n_jobs=-1
        )
    else:
        print("[!] LightGBM not available, skipping LightGBM benchmark.")

    # 7. Train and Evaluate
    print("\n" + "-" * 70)
    print(" BENCHMARKING CANDIDATE CROP RECOMMENDATION ALGORITHMS")
    print("-" * 70)

    benchmark_records = []
    trained_estimators = {}
    evaluation_details = {}

    for name, clf in candidate_models.items():
        t0 = time.time()
        # Scale for all estimators for consistency
        clf.fit(X_train_scaled, y_train)
        train_sec = round(time.time() - t0, 3)

        t_inf0 = time.time()
        y_pred = clf.predict(X_val_scaled)
        inf_sec = round((time.time() - t_inf0) * 1000 / len(y_val), 2)  # ms per sample

        acc = accuracy_score(y_val, y_pred)
        macro_prec = precision_score(y_val, y_pred, average="macro", zero_division=0)
        macro_rec = recall_score(y_val, y_pred, average="macro", zero_division=0)
        macro_f1 = f1_score(y_val, y_pred, average="macro", zero_division=0)
        weighted_f1 = f1_score(y_val, y_pred, average="weighted", zero_division=0)
        cm = confusion_matrix(y_val, y_pred)

        print(f"---> {name:<20} | Macro-F1: {macro_f1:.4f} | Acc: {acc:.4f} | Prec: {macro_prec:.4f} | Rec: {macro_rec:.4f} | Train: {train_sec}s")

        benchmark_records.append({
            "Model": name,
            "Macro F1": round(macro_f1, 4),
            "Accuracy": round(acc, 4),
            "Macro Precision": round(macro_prec, 4),
            "Macro Recall": round(macro_rec, 4),
            "Weighted F1": round(weighted_f1, 4),
            "Inference Latency (ms)": inf_sec,
            "Training Time (s)": train_sec
        })

        trained_estimators[name] = clf
        evaluation_details[name] = {
            "confusion_matrix": cm,
            "classification_report": classification_report(y_val, y_pred, target_names=class_names, output_dict=True)
        }

    # 8. Select Best Model via Macro-F1
    results_df = pd.DataFrame(benchmark_records)
    results_df = results_df.sort_values(by=["Macro F1", "Accuracy"], ascending=False).reset_index(drop=True)

    best_entry = results_df.iloc[0]
    best_model_name = best_entry["Model"]
    best_clf = trained_estimators[best_model_name]
    best_cm = evaluation_details[best_model_name]["confusion_matrix"]

    print("\n" + "=" * 70)
    print(f"[*] WINNING CROP MODEL: {best_model_name.upper()} (Validation Macro-F1: {best_entry['Macro F1']:.4f})")
    print("=" * 70)

    # 9. Save Artifacts to models/crop_recommendation/
    out_dir = Path(output_dir) if output_dir else ai_root / "models" / "crop_recommendation"
    root_out_dir = workspace_root / "models" / "crop_recommendation"
    reports_dir = ai_root / "reports"
    reports_fig_dir = ai_root / "reports" / "figures"
    root_reports_dir = workspace_root / "reports"
    root_reports_fig_dir = workspace_root / "reports" / "figures"

    for d in [out_dir, root_out_dir, reports_dir, reports_fig_dir, root_reports_dir, root_reports_fig_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Save model, scaler, label_encoder, metadata
    joblib.dump(best_clf, out_dir / "best_model.pkl")
    joblib.dump(scaler, out_dir / "scaler.pkl")
    joblib.dump(label_encoder, out_dir / "label_encoder.pkl")

    with open(out_dir / "features.json", "w", encoding="utf-8") as f:
        json.dump(feature_cols, f, indent=4)

    with open(out_dir / "classes.json", "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=4)

    model_config_payload = {
        "best_model": best_model_name,
        "primary_metric": "macro_f1",
        "macro_f1": best_entry["Macro F1"],
        "accuracy": best_entry["Accuracy"],
        "precision": best_entry["Macro Precision"],
        "recall": best_entry["Macro Recall"],
        "weighted_f1": best_entry["Weighted F1"],
        "feature_names": feature_cols,
        "classes_count": len(class_names),
        "classes": class_names,
        "training_date": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(out_dir / "model_config.json", "w", encoding="utf-8") as f:
        json.dump(model_config_payload, f, indent=4)

    # 10. Generate Reports and Visualizations
    # CSV Comparison
    results_df.to_csv(reports_dir / "crop_recommendation_comparison.csv", index=False)
    results_df.to_csv(root_reports_dir / "crop_recommendation_comparison.csv", index=False)

    # Markdown Table
    md_lines = [
        "# AgriSmart AI – Crop Recommendation Benchmark Report\n",
        f"**Date**: {time.strftime('%Y-%m-%d %H:%M:%S')}  ",
        f"**Dataset**: `Crop_recommendation.csv` ({len(df)} specimens across {len(class_names)} crops)  ",
        f"**Validation Split**: 20% Stratified (Seed=42)  ",
        f"**Selection Metric**: **Macro-F1**\n",
        "| " + " | ".join(results_df.columns) + " |",
        "| " + " | ".join(["---"] * len(results_df.columns)) + " |"
    ]
    for _, r in results_df.iterrows():
        md_lines.append("| " + " | ".join(str(r[c]) for c in results_df.columns) + " |")

    md_lines.append(f"\n### Selected Champion: **{best_model_name}**")
    md_lines.append(f"- **Validation Macro-F1**: `{best_entry['Macro F1']:.4f}`")
    md_lines.append(f"- **Validation Accuracy**: `{best_entry['Accuracy']:.4f}`")
    md_lines.append(f"- **Validation Precision**: `{best_entry['Macro Precision']:.4f}`")
    md_lines.append(f"- **Validation Recall**: `{best_entry['Macro Recall']:.4f}`")
    md_lines.append(f"- **Saved Model**: `models/crop_recommendation/best_model.pkl`\n")

    with open(reports_dir / "crop_recommendation_report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    with open(root_reports_dir / "crop_recommendation_report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    # Confusion matrix & feature importance figures
    render_crop_confusion_matrix(best_cm, class_names, str(reports_fig_dir / "crop_rec_confusion_matrix.png"))
    render_feature_importance(best_clf, feature_cols, str(reports_fig_dir / "crop_rec_feature_importance.png"), best_model_name)

    # 11. Update model_registry.json
    registry_path = ai_root / "models" / "model_registry.json"
    root_registry_path = workspace_root / "models" / "model_registry.json"

    reg_data = {}
    if registry_path.exists():
        with open(registry_path, "r", encoding="utf-8") as f:
            reg_data = json.load(f)

    reg_data["crop_recommendation"] = {
        "status": "OK",
        "best_model": best_model_name,
        "primary_metric": "macro_f1",
        "score": best_entry["Macro F1"],
        "accuracy": best_entry["Accuracy"],
        "precision": best_entry["Macro Precision"],
        "recall": best_entry["Macro Recall"],
        "path": "models/crop_recommendation/best_model.pkl",
        "num_classes": len(class_names),
        "training_date": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(reg_data, f, indent=4)
    with open(root_registry_path, "w", encoding="utf-8") as f:
        json.dump(reg_data, f, indent=4)

    # Sync entire models/ and reports/ to root
    for folder in ["models", "reports"]:
        src_f = ai_root / folder
        dst_f = workspace_root / folder
        if src_f.exists():
            shutil.copytree(src_f, dst_f, dirs_exist_ok=True)

    # Return summary dict
    return {
        "status": "OK",
        "best_model": best_model_name,
        "metrics": {
            "accuracy": best_entry["Accuracy"],
            "macro_f1": best_entry["Macro F1"],
            "precision": best_entry["Macro Precision"],
            "recall": best_entry["Macro Recall"]
        },
        "saved_path": str(out_dir / "best_model.pkl")
    }


if __name__ == "__main__":
    train_crop_recommendation()
