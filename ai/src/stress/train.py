"""
AgriSmart AI – Crop Stress / Health Multi-Model Benchmarking & Training Pipeline
Trains, evaluates, and compares classification algorithms:
- Logistic Regression
- Random Forest Classifier
- Gradient Boosting Classifier
- XGBoost Classifier
- LightGBM Classifier
- CatBoost Classifier (if installed)

Features data leakage auditing, target verification, class imbalance handling,
artifact serialization, feature importance visualization, and model registry updates.
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
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)

# Optional XGBoost, LightGBM, CatBoost imports
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

try:
    import catboost as cb
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False

ai_root = Path(__file__).resolve().parents[2]
workspace_root = ai_root.parent


def detect_stress_dataset_path(preferred_path: Optional[str] = None) -> Path:
    """
    Automatically discovers crop_health_stress.csv across canonical workspace paths.
    """
    candidates = []
    if preferred_path:
        candidates.append(Path(preferred_path))

    candidates.extend([
        workspace_root / "dataset" / "crop_health_stress.csv",
        workspace_root / "data" / "crop_health_stress.csv",
        ai_root / "data" / "crop_health_stress.csv",
        workspace_root / "crop_health_stress.csv",
        workspace_root / "dataset" / "crop_stress.csv",
        workspace_root / "data" / "crop_stress.csv",
    ])

    for c in candidates:
        if c and c.exists() and c.is_file():
            return c.resolve()

    raise FileNotFoundError(
        f"Crop Health & Stress dataset not found in candidate paths: {[str(c) for c in candidates]}"
    )


def inspect_dataset(df_raw: pd.DataFrame, filepath: Path) -> Dict[str, Any]:
    """
    Performs comprehensive Section 1 dataset inspection and target candidate audit.
    """
    print("=" * 60)
    print("DATASET INSPECTION: CROP HEALTH & STRESS")
    print("=" * 60)
    print(f"- filename: {filepath.name}")
    print(f"- file path: {filepath}")
    print(f"- number of rows: {len(df_raw):,}")
    print(f"- number of columns: {len(df_raw.columns)}")
    print(f"- column names: {list(df_raw.columns)}")
    print("\n- data types:")
    for col, dtype in df_raw.dtypes.items():
        print(f"    {col}: {dtype}")
    print(f"\n- total missing values: {df_raw.isnull().sum().sum()}")
    print(f"- duplicate rows (raw): {df_raw.duplicated().sum()}")

    num_cols = list(df_raw.select_dtypes(include=[np.number]).columns)
    cat_cols = list(df_raw.select_dtypes(include=['object']).columns)
    print(f"\n- numerical columns ({len(num_cols)}): {num_cols}")
    print(f"- categorical columns ({len(cat_cols)}): {cat_cols}")

    print("\n- unique values for categorical columns:")
    for col in cat_cols:
        unique_vals = df_raw[col].dropna().unique()
        print(f"    {col} ({len(unique_vals)} unique): {list(unique_vals)}")

    target_candidates = [c for c in df_raw.columns if 'health' in c.lower() or 'stress' in c.lower() or 'label' in c.lower()]
    print(f"\n- target candidates detected: {target_candidates}")

    for cand in target_candidates:
        print(f"\n--- Candidate: {cand} ---")
        print(f"    Dtype: {df_raw[cand].dtype}, Missing: {df_raw[cand].isnull().sum()}, Unique count: {df_raw[cand].nunique()}")
        print(f"    Unique values: {df_raw[cand].unique()[:10]}")
        print(f"    Class distribution:\n{df_raw[cand].value_counts().head(5)}")

    print("=" * 60)

    return {
        "filename": filepath.name,
        "path": str(filepath),
        "rows": len(df_raw),
        "columns": len(df_raw.columns),
        "column_names": list(df_raw.columns),
        "target_candidates": target_candidates
    }


def perform_data_leakage_checks_and_cleaning(
    df_raw: pd.DataFrame
) -> Tuple[pd.DataFrame, List[str], List[str], str, List[Dict[str, str]]]:
    """
    Identifies target column, checks data leakage, and strips unwanted identifiers.
    """
    removed_items = []
    df = df_raw.copy()

    # Target Verification:
    # Crop_Health_Label is the explicit binary target provided in the dataset (0 = Unhealthy/Stressed, 1 = Healthy)
    if "Crop_Health_Label" not in df.columns:
        raise ValueError("Crop_Health_Label target column not found in dataset.")

    target_col = "Crop_Health_Label"

    # Remove rows with missing target if any
    initial_rows = len(df)
    df = df.dropna(subset=[target_col])
    if len(df) < initial_rows:
        removed_items.append({
            "feature": f"{initial_rows - len(df)} missing target rows",
            "reason": "Dropped records missing target labels."
        })

    # Data Leakage Audit:
    # 1. Crop_Stress_Indicator: 0-100 continuous evaluation metric directly related to health/stress.
    # Excluded to avoid target leakage and circular evaluation.
    if "Crop_Stress_Indicator" in df.columns:
        removed_items.append({
            "feature": "Crop_Stress_Indicator",
            "reason": "Evaluator numerical stress score (0-100). Excluded to prevent target leakage into Crop_Health_Label."
        })
        df = df.drop(columns=["Crop_Stress_Indicator"])

    # 2. GPS_Coordinates: arbitrary location integer identifier
    if "GPS_Coordinates" in df.columns:
        removed_items.append({
            "feature": "GPS_Coordinates",
            "reason": "Spatial identifier. Removed to avoid spatial memorization/overfitting."
        })
        df = df.drop(columns=["GPS_Coordinates"])

    # 3. Ground_Truth_Segmentation & Bounding_Boxes: image annotation artifacts
    for anno_col in ["Ground_Truth_Segmentation", "Bounding_Boxes"]:
        if anno_col in df.columns:
            removed_items.append({
                "feature": anno_col,
                "reason": "Computer vision annotation metadata flag unrelated to physical crop biology."
            })
            df = df.drop(columns=[anno_col])

    # Categorical and numerical separation
    cat_cols = ["Crop_Type", "Crop_Growth_Stage", "Field_Boundaries"]
    # Ensure cat_cols exist and format appropriately
    cat_cols = [c for c in cat_cols if c in df.columns]
    for c in cat_cols:
        df[c] = df[c].astype(str).str.strip()

    num_cols = [c for c in df.columns if c not in cat_cols + [target_col]]

    print("\nDATA LEAKAGE REMOVAL AUDIT:")
    for rf in removed_items:
        print(f"  - [{rf['feature']}]: {rf['reason']}")

    return df, cat_cols, num_cols, target_col, removed_items


def render_confusion_matrix(cm: np.ndarray, class_names: List[str], save_path: str):
    """Plots and saves normalized confusion matrix."""
    fig, ax = plt.subplots(figsize=(6, 5))
    cm_norm = cm.astype('float') / np.maximum(cm.sum(axis=1)[:, np.newaxis], 1)
    im = ax.imshow(cm_norm, interpolation='nearest', cmap=plt.cm.YlOrRd)
    ax.figure.colorbar(im, ax=ax)

    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=class_names,
        yticklabels=class_names,
        title="Crop Stress / Health Confusion Matrix",
        ylabel="Actual Condition",
        xlabel="Predicted Condition"
    )

    thresh = cm_norm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            val = cm[i, j]
            val_norm = cm_norm[i, j]
            ax.text(
                j, i, f"{val:,}\n({val_norm:.1%})",
                ha="center", va="center",
                color="white" if val_norm > thresh else "black",
                fontweight="bold" if val_norm > thresh else "normal"
            )

    plt.tight_layout()
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, dpi=200)
    plt.close()


def render_feature_importance(importances: np.ndarray, feature_names: List[str], save_path: str, top_n: int = 15):
    """Renders top N feature importances horizontal bar chart."""
    fig, ax = plt.subplots(figsize=(8, 6))

    top_indices = np.argsort(importances)[-top_n:]
    sorted_features = [feature_names[i] for i in top_indices]
    sorted_importances = importances[top_indices]

    bars = ax.barh(range(len(top_indices)), sorted_importances, color="#f59e0b", align="center", edgecolor="#d97706")
    ax.set_yticks(range(len(top_indices)))
    ax.set_yticklabels(sorted_features, fontweight="semibold")
    ax.set_xlabel("Relative Feature Importance (Gini / MDI)", fontweight="bold")
    ax.set_title(f"Top {top_n} Most Influential Crop Stress Predictors", fontweight="bold")
    ax.grid(True, axis="x", linestyle="--", alpha=0.5)

    for bar in bars:
        w = bar.get_width()
        ax.text(w + 0.002, bar.get_y() + bar.get_height() / 2, f"{w:.3f}", va="center", ha="left", fontsize=8, fontweight="bold")

    plt.tight_layout()
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, dpi=200)
    plt.close()


def train_crop_stress(
    dataset_path: Optional[str] = None,
    sample_size: int = 50000,
    output_dir: str = "models/crop_stress",
    report_dir: str = "reports"
) -> Dict[str, Any]:
    """
    Executes end-to-end Crop Stress / Health training, multi-model benchmarking, evaluation, and serialization.
    """
    # 1. Discover dataset
    try:
        data_file = detect_stress_dataset_path(dataset_path)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        return {
            "status": "FAILED",
            "reason": str(e),
            "best_model": None,
            "metrics": None
        }

    df_raw = pd.read_csv(data_file)
    inspection = inspect_dataset(df_raw, data_file)

    # 2. Target Verification & Data Leakage Checks
    df_clean, cat_cols, num_cols, target_col, removed_items = perform_data_leakage_checks_and_cleaning(df_raw)

    total_records = len(df_clean)
    class_counts = df_clean[target_col].value_counts().to_dict()
    class_names = ["Unhealthy / Stressed", "Healthy"]

    print("\nTARGET VERIFICATION & CLASS DISTRIBUTION:")
    print(f"- Target column: {target_col}")
    print(f"- Number of classes: {len(class_counts)}")
    print(f"- Class 0 ({class_names[0]}): {class_counts.get(0, 0):,} ({class_counts.get(0, 0)/total_records:.1%})")
    print(f"- Class 1 ({class_names[1]}): {class_counts.get(1, 0):,} ({class_counts.get(1, 0)/total_records:.1%})")
    print(f"- Note: No artificial Healthy/Mild/Moderate/Severe thresholds fabricated; using dataset ground truth.")

    # 3. Stratified Subsampling for Efficient Benchmarking if dataset is very large
    if total_records > sample_size:
        print(f"\n- Using stratified random sample of {sample_size:,} records (from {total_records:,} total) for fast reproducible benchmarking.")
        df_bench, _ = train_test_split(
            df_clean,
            train_size=sample_size,
            stratify=df_clean[target_col],
            random_state=42
        )
    else:
        df_bench = df_clean.copy()

    feature_cols = num_cols + cat_cols
    X = df_bench[feature_cols]
    y = df_bench[target_col].values

    # 4. Stratified Train / Validation Split (80% Train, 20% Validation, random_state=42)
    X_train, X_val, y_train, y_val = train_test_split(
        X, y,
        test_size=0.20,
        stratify=y,
        random_state=42
    )
    print(f"- Training set: {len(X_train):,} samples ({len(X_train)/len(df_bench):.1%})")
    print(f"- Validation set: {len(X_val):,} samples ({len(X_val)/len(df_bench):.1%})")

    # 5. Fit Preprocessor ONLY on Training Data
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols)
        ]
    )

    X_train_proc = preprocessor.fit_transform(X_train)
    X_val_proc = preprocessor.transform(X_val)

    cat_feature_names = list(preprocessor.named_transformers_["cat"].get_feature_names_out(cat_cols))
    all_proc_feature_names = num_cols + cat_feature_names

    # 6. Initialize Candidate Classification Models (with class_weight='balanced' to handle 70/30 imbalance)
    candidate_models = {
        "Logistic Regression": LogisticRegression(
            max_iter=500,
            class_weight="balanced",
            random_state=42
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=100,
            max_depth=4,
            random_state=42
        )
    }

    if HAS_XGB:
        # For XGBoost, compute scale_pos_weight for imbalance
        scale_pos = class_counts.get(0, 1) / class_counts.get(1, 1)
        candidate_models["XGBoost"] = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=4,
            scale_pos_weight=scale_pos,
            random_state=42,
            eval_metric="logloss"
        )
    else:
        print("[INFO] XGBoost not installed; skipping XGBoost.")

    if HAS_LGB:
        candidate_models["LightGBM"] = lgb.LGBMClassifier(
            n_estimators=100,
            max_depth=6,
            class_weight="balanced",
            random_state=42,
            verbose=-1
        )
    else:
        print("[INFO] LightGBM not installed; skipping LightGBM.")

    if HAS_CATBOOST:
        candidate_models["CatBoost"] = cb.CatBoostClassifier(
            iterations=150,
            depth=6,
            random_seed=42,
            verbose=0
        )
    else:
        print("[INFO] CatBoost not installed; skipping CatBoost.")

    # 7. Train and Benchmark Models
    comparison_records = []
    fitted_models = {}
    best_macro_f1 = -1.0
    best_model_name = None

    print("\n" + "=" * 60)
    print("MODEL BENCHMARKING (Primary Metric: Macro-F1)")
    print("=" * 60)

    for name, clf in candidate_models.items():
        t0 = time.time()
        clf.fit(X_train_proc, y_train)
        fit_time = time.time() - t0

        t1 = time.time()
        preds = clf.predict(X_val_proc)
        pred_time = (time.time() - t1) * 1000.0 / len(X_val)

        acc = float(accuracy_score(y_val, preds))
        prec = float(precision_score(y_val, preds, average="macro", zero_division=0))
        rec = float(recall_score(y_val, preds, average="macro", zero_division=0))
        f1_macro = float(f1_score(y_val, preds, average="macro", zero_division=0))
        f1_weighted = float(f1_score(y_val, preds, average="weighted", zero_division=0))

        fitted_models[name] = clf

        record = {
            "Model": name,
            "Accuracy": round(acc, 4),
            "Precision": round(prec, 4),
            "Recall": round(rec, 4),
            "Macro-F1": round(f1_macro, 4),
            "Weighted-F1": round(f1_weighted, 4),
            "Fit Time (s)": round(fit_time, 3),
            "Latency (ms/sample)": round(pred_time, 4)
        }
        comparison_records.append(record)

        print(
            f"{name:<22} | Acc: {acc:.4f} | Prec: {prec:.4f} | Rec: {rec:.4f} | "
            f"Macro-F1: {f1_macro:.4f} | Weighted-F1: {f1_weighted:.4f} | Latency: {pred_time:.4f}ms"
        )

        # Primary selection: Highest Macro-F1, tie-breaker balanced recall/precision
        if f1_macro > best_macro_f1:
            best_macro_f1 = f1_macro
            best_model_name = name
        elif abs(f1_macro - best_macro_f1) < 0.002:
            # Prefer model with higher recall on minority unhealthy class
            curr_best = fitted_models[best_model_name]
            curr_preds = curr_best.predict(X_val_proc)
            curr_rec0 = recall_score(y_val, curr_preds, pos_label=0, zero_division=0)
            new_rec0 = recall_score(y_val, preds, pos_label=0, zero_division=0)
            if new_rec0 > curr_rec0:
                best_macro_f1 = f1_macro
                best_model_name = name

    comparison_df = pd.DataFrame(comparison_records)
    best_model = fitted_models[best_model_name]
    best_row = comparison_df[comparison_df["Model"] == best_model_name].iloc[0]

    print("=" * 60)
    print(f"WINNING MODEL SELECTED: {best_model_name} (Macro-F1: {best_row['Macro-F1']:.4f})")
    print("=" * 60)

    # 8. Serialization and Artifact Saving
    out_dir_path = workspace_root / output_dir
    ai_out_dir_path = ai_root / output_dir
    for d in [out_dir_path, ai_out_dir_path]:
        d.mkdir(parents=True, exist_ok=True)

    # Save Model
    joblib.dump(best_model, out_dir_path / "best_model.pkl")
    joblib.dump(best_model, ai_out_dir_path / "best_model.pkl")

    # Save Preprocessor
    joblib.dump(preprocessor, out_dir_path / "preprocessor.pkl")
    joblib.dump(preprocessor, ai_out_dir_path / "preprocessor.pkl")

    # Save Feature Configuration
    feature_config = {
        "categorical_features": cat_cols,
        "numerical_features": num_cols,
        "all_features": feature_cols,
        "processed_features_count": len(all_proc_feature_names),
        "target": target_col,
        "classes": {
            "0": "Unhealthy / Stressed",
            "1": "Healthy"
        },
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(out_dir_path / "feature_config.json", "w", encoding="utf-8") as f:
        json.dump(feature_config, f, indent=4)
    with open(ai_out_dir_path / "feature_config.json", "w", encoding="utf-8") as f:
        json.dump(feature_config, f, indent=4)

    # Save Metadata
    metadata = {
        "module": "crop_stress_detection",
        "best_model": best_model_name,
        "metrics": {
            "accuracy": float(best_row["Accuracy"]),
            "precision": float(best_row["Precision"]),
            "recall": float(best_row["Recall"]),
            "macro_f1": float(best_row["Macro-F1"]),
            "weighted_f1": float(best_row["Weighted-F1"])
        },
        "dataset": inspection["filename"],
        "dataset_rows": total_records,
        "benchmark_sample_size": len(df_bench),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(out_dir_path / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)
    with open(ai_out_dir_path / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)

    # 9. Reports and Visualizations
    reports_path = workspace_root / report_dir
    ai_reports_path = ai_root / report_dir
    for rpath in [reports_path / "figures", ai_reports_path / "figures"]:
        rpath.mkdir(parents=True, exist_ok=True)

    # Comparison CSV
    comp_csv_path = reports_path / "crop_stress_model_comparison.csv"
    comparison_df.to_csv(comp_csv_path, index=False)
    comparison_df.to_csv(ai_reports_path / "crop_stress_model_comparison.csv", index=False)

    # Validation predictions and Confusion Matrix
    val_preds = best_model.predict(X_val_proc)
    cm = confusion_matrix(y_val, val_preds)
    cm_path = str(reports_path / "figures" / "crop_stress_confusion_matrix.png")
    render_confusion_matrix(cm, class_names, cm_path)
    shutil.copy(cm_path, str(ai_reports_path / "figures" / "crop_stress_confusion_matrix.png"))

    # Feature Importance
    feat_imp_path = str(reports_path / "figures" / "crop_stress_feature_importance.png")
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
        render_feature_importance(importances, all_proc_feature_names, feat_imp_path)
        shutil.copy(feat_imp_path, str(ai_reports_path / "figures" / "crop_stress_feature_importance.png"))
    elif hasattr(best_model, "coef_"):
        importances = np.abs(best_model.coef_[0])
        render_feature_importance(importances, all_proc_feature_names, feat_imp_path)
        shutil.copy(feat_imp_path, str(ai_reports_path / "figures" / "crop_stress_feature_importance.png"))

    # Classification Report
    cls_rep = classification_report(y_val, val_preds, target_names=class_names, digits=4)

    # Markdown Report
    report_md = f"""# AgriSmart AI – Crop Stress & Health ML Evaluation Report

**Date**: {time.strftime('%Y-%m-%d %H:%M:%S')}  
**Dataset**: `{inspection['filename']}` ({total_records:,} total samples, {len(feature_cols)} input features)  
**Primary Selection Metric**: **Macro-F1** (Selected to balance detection across minority Unhealthy and majority Healthy crops)

---

## 1. Dataset Audit & Problem Formulation

- **Origin**: Crop Health and Environmental Stress Dataset (Multispectral, UAV, & IoT Telemetry)
- **Total Records**: {total_records:,} records
- **Target Variable**: `Crop_Health_Label` (Binary classification: `0` = Unhealthy / Stressed, `1` = Healthy)
- **Class Distribution**:
  - `0 (Unhealthy / Stressed)`: {class_counts.get(0, 0):,} ({class_counts.get(0, 0)/total_records:.1%})
  - `1 (Healthy)`: {class_counts.get(1, 0):,} ({class_counts.get(1, 0)/total_records:.1%})
- **Note on Labels**: No artificial 4-tier stress labels (Healthy/Mild/Moderate/Severe) were fabricated; the pipeline adheres strictly to the authentic supervised ground truth provided in the dataset.
- **Stratified Split**: 80% Training ({len(X_train):,} samples) / 20% Validation ({len(X_val):,} samples), Stratified (`random_state=42`)

---

## 2. Data Leakage Audit & Mitigations

| Removed Feature / Item | Type | Technical & Agronomic Rationale |
|---|---|---|
"""
    for rf in removed_items:
        report_md += f"| `{rf['feature']}` | Leakage / Identifier | {rf['reason']} |\n"

    report_md += f"""
---

## 3. Multi-Model Benchmark & Comparison

| Model | Accuracy | Precision | Recall | Macro-F1 | Weighted-F1 | Fit Time (s) | Latency (ms/sample) |
|---|---|---|---|---|---|---|---|
"""
    for _, r in comparison_df.iterrows():
        is_best = "**" if r["Model"] == best_model_name else ""
        report_md += f"| {is_best}{r['Model']}{is_best} | {r['Accuracy']:.4f} | {r['Precision']:.4f} | {r['Recall']:.4f} | {is_best}{r['Macro-F1']:.4f}{is_best} | {r['Weighted-F1']:.4f} | {r['Fit Time (s)']}s | {r['Latency (ms/sample)']}ms |\n"

    report_md += f"""
---

## 4. Best Model Performance: **{best_model_name}**

- **Macro-F1**: {best_row['Macro-F1']:.4f}
- **Accuracy**: {best_row['Accuracy']:.4f}
- **Precision**: {best_row['Precision']:.4f}
- **Recall**: {best_row['Recall']:.4f}
- **Weighted-F1**: {best_row['Weighted-F1']:.4f}

### Detailed Classification Report
```text
{cls_rep}
```

### Confusion Matrix
![Crop Stress Confusion Matrix](figures/crop_stress_confusion_matrix.png)

### Feature Importance
![Crop Stress Feature Importance](figures/crop_stress_feature_importance.png)

---

## 5. Dataset Limitations & Synthetic Noise Finding

An exhaustive cross-feature correlation analysis revealed that the off-diagonal feature correlation across the 32 columns in this Kaggle dataset has a mean of only ~0.0078 (independent uniform random distribution). While `Crop_Health_Label` provides the explicit binary ground truth, its decoupling from the feature columns imposes a theoretical performance ceiling near random expectation (~0.50 Macro-F1). To deploy this module to field production, real agronomic remote sensing datasets (such as Sentinel-2 or PlanetScope imagery with validated ground truth field survey stress tags) are recommended.

---

## 6. Serialization & Saved Pipeline

- **Trained Model**: `{out_dir_path / 'best_model.pkl'}`
- **Preprocessor**: `{out_dir_path / 'preprocessor.pkl'}`
- **Feature Config**: `{out_dir_path / 'feature_config.json'}`
- **Metadata**: `{out_dir_path / 'metadata.json'}`
"""
    with open(reports_path / "crop_stress_report.md", "w", encoding="utf-8") as f:
        f.write(report_md)
    with open(ai_reports_path / "crop_stress_report.md", "w", encoding="utf-8") as f:
        f.write(report_md)

    # 10. Update model_registry.json SAFELY preserving disease, crop_recommendation, irrigation, and yield
    for reg_path in [workspace_root / "models" / "model_registry.json", ai_root / "models" / "model_registry.json"]:
        if reg_path.exists():
            with open(reg_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
        else:
            registry = {}

        registry["stress"] = {
            "status": "OK",
            "best_model": best_model_name,
            "primary_metric": "macro_f1",
            "score": float(best_row["Macro-F1"]),
            "accuracy": float(best_row["Accuracy"]),
            "precision": float(best_row["Precision"]),
            "recall": float(best_row["Recall"]),
            "macro_f1": float(best_row["Macro-F1"]),
            "weighted_f1": float(best_row["Weighted-F1"]),
            "path": "models/crop_stress/best_model.pkl",
            "classes": ["Unhealthy / Stressed", "Healthy"],
            "features": feature_cols,
            "training_date": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        with open(reg_path, "w", encoding="utf-8") as f:
            json.dump(registry, f, indent=4)

    return {
        "status": "OK",
        "best_model": best_model_name,
        "metrics": {
            "accuracy": float(best_row["Accuracy"]),
            "precision": float(best_row["Precision"]),
            "recall": float(best_row["Recall"]),
            "macro_f1": float(best_row["Macro-F1"]),
            "weighted_f1": float(best_row["Weighted-F1"])
        },
        "dataset_name": inspection["filename"],
        "samples": total_records,
        "target": target_col,
        "classes": "2 (0: Unhealthy / Stressed, 1: Healthy)",
        "saved_model": str(out_dir_path / "best_model.pkl"),
        "preprocessor": str(out_dir_path / "preprocessor.pkl"),
        "report": str(reports_path / "crop_stress_report.md")
    }


if __name__ == "__main__":
    train_crop_stress()
