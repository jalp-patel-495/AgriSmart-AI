"""
AgriSmart AI – Smart Irrigation Multi-Model Benchmarking & Training Pipeline
Trains, evaluates, and compares multiple supervised learning algorithms:
- Logistic Regression
- Random Forest Classifier
- Gradient Boosting Classifier
- XGBoost Classifier
- LightGBM Classifier
- CatBoost Classifier (if installed)

Selects the best model via Validation Macro-F1, serializes preprocessing objects and models,
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
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

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


def detect_irrigation_dataset_path(preferred_path: Optional[str] = None) -> Path:
    """
    Automatically discovers irrigation dataset across canonical workspace paths.
    """
    candidates = []
    if preferred_path:
        candidates.append(Path(preferred_path))

    candidates.extend([
        workspace_root / "dataset" / "irrigation_data.csv",
        workspace_root / "data" / "irrigation_data.csv",
        ai_root / "data" / "irrigation_data.csv",
        workspace_root / "dataset" / "motor.csv",
        workspace_root / "data" / "motor.csv",
        workspace_root / "irrigation_data.csv",
    ])

    for c in candidates:
        if c and c.exists() and c.is_file():
            return c.resolve()

    raise FileNotFoundError(
        f"Irrigation dataset not found in candidate paths: {[str(c) for c in candidates]}"
    )


def inspect_dataset(df_raw: pd.DataFrame, filepath: Path) -> Dict[str, Any]:
    """
    Prints comprehensive Section 1 dataset inspection and returns inspection metadata.
    """
    print("=" * 60)
    print("DATASET INSPECTION")
    print("=" * 60)
    print(f"- filename: {filepath.name}")
    print(f"- file path: {filepath}")
    print(f"- number of rows: {len(df_raw)}")
    print(f"- number of columns: {len(df_raw.columns)}")
    print(f"- all column names: {list(df_raw.columns)}")
    print("\n- data types:")
    for col, dtype in df_raw.dtypes.items():
        print(f"    {col}: {dtype}")
    print("\n- missing values:")
    for col, null_count in df_raw.isnull().sum().items():
        print(f"    {col}: {null_count}")
    print(f"- duplicate rows (raw): {df_raw.duplicated().sum()}")

    # Determine target column candidate
    target_col = None
    for cand in ["Motor", "status", "irrigation", "irrigation_required", "label"]:
        if cand in df_raw.columns:
            target_col = cand
            break

    if target_col is None:
        raise ValueError("Suitable irrigation classification target not found.")

    unique_vals = df_raw[target_col].dropna().unique().tolist()
    class_dist = df_raw[target_col].value_counts(dropna=False).to_dict()

    print(f"- target column: {target_col}")
    print(f"- unique target values: {unique_vals}")
    print(f"- class distribution (raw):\n    {class_dist}")
    print("=" * 60)

    return {
        "filename": filepath.name,
        "rows": len(df_raw),
        "columns": len(df_raw.columns),
        "column_names": list(df_raw.columns),
        "target_col": target_col,
        "unique_vals": unique_vals,
        "class_dist": class_dist
    }


def perform_data_leakage_checks_and_cleaning(
    df_raw: pd.DataFrame,
    target_col: str
) -> Tuple[pd.DataFrame, List[str], List[Dict[str, str]]]:
    """
    Identifies and removes data leakage, irrelevant features, and duplicate rows.
    """
    removed_features = []
    
    # 1. Drop all-null rows (e.g. trailing CSV padding lines)
    null_rows_count = df_raw.isnull().all(axis=1).sum()
    df_clean = df_raw.dropna(how="all").copy()
    if null_rows_count > 0:
        removed_features.append({
            "feature": f"{null_rows_count} empty trailing rows",
            "reason": "Dropped unpopulated trailing lines from raw CSV export."
        })

    # 2. Check non-agronomic / leakage features
    feature_candidates = [c for c in df_clean.columns if c != target_col]
    features_to_keep = []

    for col in feature_candidates:
        col_lower = col.lower()
        if col_lower in ["time", "timestamp", "date", "id", "index"]:
            removed_features.append({
                "feature": col,
                "reason": "Temporal index / non-agronomic observation timestamp. Keeping it risks spurious temporal overfitting."
            })
        elif col_lower in ["object", "detected_object", "note"]:
            removed_features.append({
                "feature": col,
                "reason": "Irrelevant hardware sensor / camera detection flag unrelated to soil hydrology or crop water demand."
            })
        elif df_clean[col].nunique() <= 1:
            removed_features.append({
                "feature": col,
                "reason": f"Zero variance feature (all values are '{df_clean[col].dropna().iloc[0]}'). Carries zero predictive information."
            })
        else:
            features_to_keep.append(col)

    # 3. Standardize column names
    col_mapping = {}
    for col in features_to_keep:
        col_clean = col.lower()
        if "moisture" in col_clean:
            col_mapping[col] = "soil_moisture"
        elif "temp" in col_clean:
            col_mapping[col] = "temperature"
        elif "humid" in col_clean:
            col_mapping[col] = "humidity"
        elif "rain" in col_clean:
            col_mapping[col] = "rainfall"
        else:
            col_mapping[col] = col_clean.replace(" ", "_").replace("(", "").replace(")", "").replace("%", "")

    df_clean = df_clean[features_to_keep + [target_col]].rename(columns=col_mapping)
    final_features = [col_mapping[col] for col in features_to_keep]

    # 4. Map target to binary integer (1 = Irrigation Required / YES, 0 = Irrigation Not Required / NO)
    # In IoT telemetry: Motor ON = 1 (Irrigation Required), Motor OFF = 0 (Irrigation Not Required)
    if df_clean[target_col].dtype == object or isinstance(df_clean[target_col].iloc[0], str):
        target_map = {"ON": 1, "OFF": 0, "YES": 1, "NO": 0, "1": 1, "0": 0}
        df_clean["irrigation_required"] = df_clean[target_col].astype(str).str.strip().str.upper().map(target_map)
    else:
        df_clean["irrigation_required"] = df_clean[target_col].astype(int)

    # 5. Deduplicate sensor readings to prevent train/validation data leakage
    initial_sensor_rows = len(df_clean)
    # Resolve any conflicting target labels on identical feature readings via majority voting
    df_dedup = df_clean.groupby(final_features)["irrigation_required"].agg(lambda x: int(x.mode()[0])).reset_index()
    duplicate_rows_removed = initial_sensor_rows - len(df_dedup)
    
    removed_features.append({
        "feature": f"{duplicate_rows_removed} duplicate sensor reading rows",
        "reason": "Eliminated identical sensor condition repetitions across seconds to prevent cross-split data leakage between train and validation."
    })

    print("\nDATA LEAKAGE REMOVAL AUDIT:")
    for rf in removed_features:
        print(f"  - [{rf['feature']}]: {rf['reason']}")

    return df_dedup, final_features, removed_features


def render_irrigation_confusion_matrix(cm: np.ndarray, class_names: List[str], save_path: str):
    """Plots and saves normalized confusion matrix for irrigation prediction."""
    fig, ax = plt.subplots(figsize=(6, 5))
    cm_norm = cm.astype('float') / np.maximum(cm.sum(axis=1)[:, np.newaxis], 1)
    im = ax.imshow(cm_norm, interpolation='nearest', cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)

    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=class_names,
        yticklabels=class_names,
        title="Smart Irrigation Confusion Matrix",
        ylabel="Actual State",
        xlabel="Predicted State"
    )

    thresh = cm_norm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            val = cm[i, j]
            val_norm = cm_norm[i, j]
            ax.text(
                j, i, f"{val}\n({val_norm:.1%})",
                ha="center", va="center",
                color="white" if val_norm > thresh else "black",
                fontweight="bold" if val_norm > thresh else "normal"
            )

    plt.tight_layout()
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, dpi=200)
    plt.close()


def render_feature_importance(importances: np.ndarray, feature_names: List[str], save_path: str):
    """Renders feature importance horizontal bar chart."""
    fig, ax = plt.subplots(figsize=(8, 4.5))
    indices = np.argsort(importances)

    sorted_features = [feature_names[i] for i in indices]
    sorted_importances = importances[indices]

    bars = ax.barh(range(len(indices)), sorted_importances, color="#0ea5e9", align="center", edgecolor="#0284c7")
    ax.set_yticks(range(len(indices)))
    ax.set_yticklabels(sorted_features, fontweight="semibold")
    ax.set_xlabel("Relative Feature Importance (MDI / Gini)", fontweight="bold")
    ax.set_title("Smart Irrigation – Feature Importance Analysis", fontweight="bold")
    ax.grid(True, axis="x", linestyle="--", alpha=0.5)

    for bar in bars:
        w = bar.get_width()
        ax.text(w + 0.01, bar.get_y() + bar.get_height() / 2, f"{w:.3f}", va="center", ha="left", fontsize=9, fontweight="bold")

    plt.tight_layout()
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, dpi=200)
    plt.close()


def train_irrigation(
    dataset_path: Optional[str] = None,
    output_dir: str = "models/irrigation",
    report_dir: str = "reports"
) -> Dict[str, Any]:
    """
    Executes end-to-end Smart Irrigation training, multi-model benchmarking, evaluation, and serialization.
    """
    # 1. Discover dataset
    try:
        data_file = detect_irrigation_dataset_path(dataset_path)
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

    # 2. Data Leakage Checks & Cleaning
    df_clean, feature_cols, removed_features = perform_data_leakage_checks_and_cleaning(
        df_raw, inspection["target_col"]
    )

    X = df_clean[feature_cols].copy()
    y = df_clean["irrigation_required"].copy()

    # Class distribution analysis
    class_counts = y.value_counts().to_dict()
    total_samples = len(y)
    class_names = ["NO (Off)", "YES (Irrigate)"]

    print("\nCLEANED DATASET FOR TRAINING:")
    print(f"- Total valid unique samples: {total_samples}")
    print(f"- Features ({len(feature_cols)}): {feature_cols}")
    print(f"- Target: irrigation_required (0 = NO / Off: {class_counts.get(0, 0)}, 1 = YES / Irrigate: {class_counts.get(1, 0)})")

    # 3. Train / Validation Split (80% Train, 20% Validation, Stratified, Seed=42)
    X_train, X_val, y_train, y_val = train_test_split(
        X, y,
        test_size=0.20,
        random_state=42,
        stratify=y
    )
    print(f"- Training set: {len(X_train)} samples ({len(X_train)/total_samples:.1%})")
    print(f"- Validation set: {len(X_val)} samples ({len(X_val)/total_samples:.1%})")

    # 4. Numerical Preprocessing: Fit StandardScaler ONLY on Training Data
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    # 5. Initialize Candidate Models
    candidate_models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000,
            random_state=42
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            random_state=42,
            n_jobs=-1
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=4,
            random_state=42
        )
    }

    if HAS_XGB:
        candidate_models["XGBoost"] = xgb.XGBClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=4,
            random_state=42,
            eval_metric="logloss"
        )
    else:
        print("[INFO] XGBoost not installed; skipping XGBoost.")

    if HAS_LGB:
        candidate_models["LightGBM"] = lgb.LGBMClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=4,
            random_state=42,
            verbose=-1
        )
    else:
        print("[INFO] LightGBM not installed; skipping LightGBM.")

    if HAS_CATBOOST:
        candidate_models["CatBoost"] = cb.CatBoostClassifier(
            iterations=150,
            learning_rate=0.1,
            depth=4,
            random_seed=42,
            verbose=0
        )
    else:
        print("[INFO] CatBoost not installed; skipping CatBoost.")

    # 6. Train and Evaluate Each Model
    comparison_records = []
    fitted_models = {}
    best_macro_f1 = -1.0
    best_model_name = None

    print("\n" + "=" * 60)
    print("MODEL BENCHMARKING & EVALUATION (Primary: Macro-F1)")
    print("=" * 60)

    for name, clf in candidate_models.items():
        t0 = time.time()
        # Scale for all models for consistency
        clf.fit(X_train_scaled, y_train)
        fit_time = time.time() - t0

        t1 = time.time()
        preds = clf.predict(X_val_scaled)
        eval_time = (time.time() - t1) * 1000.0 / len(X_val)  # per-sample latency ms

        acc = float(accuracy_score(y_val, preds))
        prec = float(precision_score(y_val, preds, zero_division=0))
        rec = float(recall_score(y_val, preds, zero_division=0))
        f1 = float(f1_score(y_val, preds, zero_division=0))
        macro_f1 = float(f1_score(y_val, preds, average="macro", zero_division=0))
        weighted_f1 = float(f1_score(y_val, preds, average="weighted", zero_division=0))

        fitted_models[name] = clf

        record = {
            "Model": name,
            "Accuracy": round(acc, 4),
            "Precision": round(prec, 4),
            "Recall": round(rec, 4),
            "F1": round(f1, 4),
            "Macro F1": round(macro_f1, 4),
            "Weighted F1": round(weighted_f1, 4),
            "Fit Time (s)": round(fit_time, 3),
            "Latency (ms/sample)": round(eval_time, 3)
        }
        comparison_records.append(record)

        print(
            f"{name:<22} | Acc: {acc:.4f} | Prec: {prec:.4f} | Rec: {rec:.4f} | "
            f"F1: {f1:.4f} | Macro-F1: {macro_f1:.4f} | Weighted-F1: {weighted_f1:.4f}"
        )

        if macro_f1 > best_macro_f1:
            best_macro_f1 = macro_f1
            best_model_name = name
        elif abs(macro_f1 - best_macro_f1) < 0.001:
            # Model selection tie-breaker: prefer simpler / faster model
            current_best_fit = [r["Fit Time (s)"] for r in comparison_records if r["Model"] == best_model_name][0]
            if fit_time < current_best_fit:
                best_macro_f1 = macro_f1
                best_model_name = name

    comparison_df = pd.DataFrame(comparison_records)
    best_model = fitted_models[best_model_name]
    best_row = comparison_df[comparison_df["Model"] == best_model_name].iloc[0]

    print("=" * 60)
    print(f"WINNING MODEL SELECTED: {best_model_name} (Macro-F1: {best_row['Macro F1']:.4f})")
    print("=" * 60)

    # 7. Serialization and Artifact Saving
    out_dir_path = workspace_root / output_dir
    ai_out_dir_path = ai_root / "models" / "irrigation"
    for d in [out_dir_path, ai_out_dir_path]:
        d.mkdir(parents=True, exist_ok=True)

    # Save Best Model
    model_pkl_path = out_dir_path / "best_model.pkl"
    joblib.dump(best_model, model_pkl_path)
    joblib.dump(best_model, ai_out_dir_path / "best_model.pkl")

    # Save Preprocessor (Scaler)
    scaler_pkl_path = out_dir_path / "preprocessor.pkl"
    joblib.dump(scaler, scaler_pkl_path)
    joblib.dump(scaler, ai_out_dir_path / "preprocessor.pkl")

    # Save Feature Configuration
    feature_config = {
        "features": feature_cols,
        "input_types": {col: "float" for col in feature_cols},
        "target": "irrigation_required",
        "class_mapping": {
            "0": "NO",
            "1": "YES"
        },
        "scaler_means": {col: float(scaler.mean_[i]) for i, col in enumerate(feature_cols)},
        "scaler_scales": {col: float(scaler.scale_[i]) for i, col in enumerate(feature_cols)},
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(out_dir_path / "feature_config.json", "w", encoding="utf-8") as f:
        json.dump(feature_config, f, indent=4)
    with open(ai_out_dir_path / "feature_config.json", "w", encoding="utf-8") as f:
        json.dump(feature_config, f, indent=4)

    # Save Class Names
    class_names_dict = {
        "classes": ["NO", "YES"],
        "descriptions": {
            "NO": "Irrigation Not Required (Soil moisture adequate / pump OFF)",
            "YES": "Irrigation Required (Soil moisture depleted / pump ON)"
        }
    }
    with open(out_dir_path / "class_names.json", "w", encoding="utf-8") as f:
        json.dump(class_names_dict, f, indent=4)
    with open(ai_out_dir_path / "class_names.json", "w", encoding="utf-8") as f:
        json.dump(class_names_dict, f, indent=4)

    # 8. Generate Reports and Visualizations
    reports_path = workspace_root / report_dir
    ai_reports_path = ai_root / "reports"
    for rpath in [reports_path / "figures", ai_reports_path / "figures"]:
        rpath.mkdir(parents=True, exist_ok=True)

    # Save Model Comparison CSV
    comp_csv_path = reports_path / "irrigation_model_comparison.csv"
    comparison_df.to_csv(comp_csv_path, index=False)
    comparison_df.to_csv(ai_reports_path / "irrigation_model_comparison.csv", index=False)

    # Plot Confusion Matrix for Best Model
    val_preds = best_model.predict(X_val_scaled)
    cm = confusion_matrix(y_val, val_preds)
    cm_img_path = str(reports_path / "figures" / "irrigation_confusion_matrix.png")
    render_irrigation_confusion_matrix(cm, ["NO (0)", "YES (1)"], cm_img_path)
    shutil.copy(cm_img_path, str(ai_reports_path / "figures" / "irrigation_confusion_matrix.png"))

    # Plot Feature Importance
    feat_imp_path = str(reports_path / "figures" / "irrigation_feature_importance.png")
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
        render_feature_importance(importances, feature_cols, feat_imp_path)
        shutil.copy(feat_imp_path, str(ai_reports_path / "figures" / "irrigation_feature_importance.png"))
    elif hasattr(best_model, "coef_"):
        importances = np.abs(best_model.coef_[0])
        render_feature_importance(importances, feature_cols, feat_imp_path)
        shutil.copy(feat_imp_path, str(ai_reports_path / "figures" / "irrigation_feature_importance.png"))

    # Generate Markdown Report
    cls_report = classification_report(y_val, val_preds, target_names=["NO (0)", "YES (1)"], digits=4)
    report_md = f"""# AgriSmart AI – Smart Irrigation ML Evaluation Report

**Date**: {time.strftime('%Y-%m-%d %H:%M:%S')}  
**Dataset**: `{inspection['filename']}` ({total_samples} unique environmental conditions, {len(feature_cols)} agronomic features)  
**Primary Optimization Metric**: **Validation Macro-F1** (Selected to balance positive irrigation activations and negative idle states)

---

## 1. Dataset & Problem Formulation

- **Origin**: IoT Automated Precision Irrigation Telemetry System
- **Total Valid Sensor Records**: {inspection['rows']:,} raw samples ({total_samples:,} unique conditions post-leakage deduplication)
- **Features Used**: {', '.join([f'`{f}`' for f in feature_cols])}
- **Target**: `irrigation_required`
  - `1 / YES`: Soil water deficit reached; irrigation pump activation required
  - `0 / NO`: Soil moisture adequate; irrigation pump remains off
- **Class Distribution**:
  - `0 (NO)`: {class_counts.get(0, 0)} ({class_counts.get(0, 0)/total_samples:.1%})
  - `1 (YES)`: {class_counts.get(1, 0)} ({class_counts.get(1, 0)/total_samples:.1%})
- **Train / Validation Split**: 80% Train ({len(X_train)} samples) / 20% Validation ({len(X_val)} samples), Stratified (`random_state=42`)

---

## 2. Data Leakage Checks & Mitigations

| Removed Feature / Item | Type | Agronomic Rationale & Leakage Mitigation |
|---|---|---|
"""
    for rf in removed_features:
        report_md += f"| `{rf['feature']}` | Leakage / Non-Agronomic | {rf['reason']} |\n"

    report_md += f"""
---

## 3. Multi-Model Benchmark & Comparison

| Model | Accuracy | Precision | Recall | F1 | Macro-F1 | Weighted-F1 | Fit Time (s) | Latency (ms) |
|---|---|---|---|---|---|---|---|---|
"""
    for _, r in comparison_df.iterrows():
        is_best = "**" if r["Model"] == best_model_name else ""
        report_md += f"| {is_best}{r['Model']}{is_best} | {r['Accuracy']:.4f} | {r['Precision']:.4f} | {r['Recall']:.4f} | {r['F1']:.4f} | {is_best}{r['Macro F1']:.4f}{is_best} | {r['Weighted F1']:.4f} | {r['Fit Time (s)']}s | {r['Latency (ms/sample)']}ms |\n"

    report_md += f"""
---

## 4. Best Model Performance: **{best_model_name}**

- **Accuracy**: {best_row['Accuracy']:.4f} ({best_row['Accuracy']*100:.2f}%)
- **Precision**: {best_row['Precision']:.4f}
- **Recall**: {best_row['Recall']:.4f}
- **F1 Score**: {best_row['F1']:.4f}
- **Macro-F1**: {best_row['Macro F1']:.4f}
- **Weighted-F1**: {best_row['Weighted F1']:.4f}

### Detailed Classification Report
```text
{cls_report}
```

### Confusion Matrix
![Smart Irrigation Confusion Matrix](figures/irrigation_confusion_matrix.png)

### Feature Importance
![Smart Irrigation Feature Importance](figures/irrigation_feature_importance.png)

---

## 5. Decision Rules & Priority Formulation

The prediction pipeline computes calibrated prediction probabilities via `predict_proba()` and maps irrigation decisions into transparent operational priority tiers:

- **High Confidence YES (`P(Irrigation) >= 0.85`)** → **HIGH Priority** (Critical moisture depletion; immediate drip cycle recommended).
- **Moderate Confidence YES (`0.65 <= P(Irrigation) < 0.85`)** → **MEDIUM Priority** (Soil approaching stress threshold; schedule irrigation cycle).
- **Low Confidence YES (`0.50 <= P(Irrigation) < 0.65`)** → **LOW Priority** (Marginal depletion; monitor weather and re-check in 4 hours).
- **NO (`P(Irrigation) < 0.50`)** → **NONE Priority** (Soil water level optimal; preserve water resources).

---

## 6. Serialization & Registry

- **Trained Model Checkpoint**: `{model_pkl_path}`
- **StandardScaler Preprocessor**: `{scaler_pkl_path}`
- **Feature Configuration**: `{out_dir_path / 'feature_config.json'}`
- **Class Labels**: `{out_dir_path / 'class_names.json'}`
"""
    with open(reports_path / "irrigation_report.md", "w", encoding="utf-8") as f:
        f.write(report_md)
    with open(ai_reports_path / "irrigation_report.md", "w", encoding="utf-8") as f:
        f.write(report_md)

    # 9. Update model_registry.json SAFELY without touching disease or crop_recommendation entries
    for reg_path in [workspace_root / "models" / "model_registry.json", ai_root / "models" / "model_registry.json"]:
        if reg_path.exists():
            with open(reg_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
        else:
            registry = {}

        registry["irrigation"] = {
            "status": "OK",
            "best_model": best_model_name,
            "primary_metric": "macro_f1",
            "score": float(best_row["Macro F1"]),
            "accuracy": float(best_row["Accuracy"]),
            "precision": float(best_row["Precision"]),
            "recall": float(best_row["Recall"]),
            "f1": float(best_row["F1"]),
            "path": "models/irrigation/best_model.pkl",
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
            "f1": float(best_row["F1"]),
            "macro_f1": float(best_row["Macro F1"]),
            "weighted_f1": float(best_row["Weighted F1"])
        },
        "dataset_name": inspection["filename"],
        "samples": total_samples,
        "target": "irrigation_required",
        "saved_model": str(model_pkl_path),
        "preprocessor": str(scaler_pkl_path),
        "report": str(reports_path / "irrigation_report.md")
    }


if __name__ == "__main__":
    train_irrigation()
