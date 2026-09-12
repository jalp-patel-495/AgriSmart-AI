"""
AgriSmart AI – Crop Yield Multi-Model Benchmarking & Training Pipeline
Trains, evaluates, and compares multiple regression algorithms:
- Linear Regression (Ridge)
- Random Forest Regressor
- Gradient Boosting Regressor
- XGBoost Regressor
- LightGBM Regressor
- CatBoost Regressor (if installed)

Features time-aware temporal splitting (historical vs future years), leakage prevention,
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

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

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


def detect_yield_dataset_path(preferred_path: Optional[str] = None) -> Path:
    """
    Automatically discovers crop_yield.csv across canonical workspace paths.
    """
    candidates = []
    if preferred_path:
        candidates.append(Path(preferred_path))

    candidates.extend([
        workspace_root / "dataset" / "crop_yield.csv",
        workspace_root / "data" / "crop_yield.csv",
        ai_root / "data" / "crop_yield.csv",
        workspace_root / "crop_yield.csv",
    ])

    for c in candidates:
        if c and c.exists() and c.is_file():
            return c.resolve()

    raise FileNotFoundError(
        f"Crop Yield dataset not found in candidate paths: {[str(c) for c in candidates]}"
    )


def inspect_dataset(df_raw: pd.DataFrame, filepath: Path) -> Dict[str, Any]:
    """
    Performs comprehensive Section 1 dataset inspection.
    """
    print("=" * 60)
    print("DATASET INSPECTION: CROP YIELD")
    print("=" * 60)
    print(f"- filename: {filepath.name}")
    print(f"- path: {filepath}")
    print(f"- number of rows: {len(df_raw)}")
    print(f"- number of columns: {len(df_raw.columns)}")
    print(f"- column names: {list(df_raw.columns)}")
    print("\n- data types:")
    for col, dtype in df_raw.dtypes.items():
        print(f"    {col}: {dtype}")
    print("\n- missing values:")
    for col, null_count in df_raw.isnull().sum().items():
        print(f"    {col}: {null_count}")
    print(f"- duplicate rows (raw): {df_raw.duplicated().sum()}")

    print("\n- unique values for categorical columns:")
    for col in df_raw.select_dtypes(include=['object']).columns:
        unique_vals = df_raw[col].str.strip().unique()
        print(f"    {col} ({len(unique_vals)} unique): {list(unique_vals[:8])}...")

    # Identify target candidate
    target_candidate = None
    for cand in ["Yield", "yield", "Crop_Yield", "Production"]:
        if cand in df_raw.columns:
            target_candidate = cand
            break

    print(f"\n- target candidates detected: {[c for c in df_raw.columns if 'yield' in c.lower() or 'prod' in c.lower()]}")
    print(f"- selected primary target column: {target_candidate}")
    print("=" * 60)

    return {
        "filename": filepath.name,
        "path": str(filepath),
        "rows": len(df_raw),
        "columns": len(df_raw.columns),
        "column_names": list(df_raw.columns),
        "target_candidate": target_candidate
    }


def perform_data_leakage_checks_and_cleaning(
    df_raw: pd.DataFrame
) -> Tuple[pd.DataFrame, List[str], List[str], str, List[Dict[str, str]]]:
    """
    Identifies and removes data leakage (Production), cleans whitespace, and formats features.
    """
    removed_items = []
    df = df_raw.copy()

    # 1. Clean categorical whitespace
    for col in ['Crop', 'Season', 'State']:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    # 2. Critical Data Leakage Check:
    # If Production is present and Yield = Production / Area, Production must NOT be an input feature!
    if "Production" in df.columns:
        removed_items.append({
            "feature": "Production",
            "reason": "Target-derived post-harvest leakage. Yield is mathematically calculated as Production / Area. Total harvested production is unknown prior to harvest and would cause severe lookahead leakage."
        })
        df = df.drop(columns=["Production"])

    # 3. Handle duplicates
    raw_duplicates = df.duplicated().sum()
    if raw_duplicates > 0:
        df = df.drop_duplicates()
        removed_items.append({
            "feature": f"{raw_duplicates} duplicate rows",
            "reason": "Eliminated identical observation rows to prevent data replication."
        })

    # 4. Remove invalid rows
    initial_len = len(df)
    df = df[(df["Area"] > 0) & (df["Yield"] >= 0)].dropna()
    dropped_invalid = initial_len - len(df)
    if dropped_invalid > 0:
        removed_items.append({
            "feature": f"{dropped_invalid} invalid rows",
            "reason": "Removed records with non-positive cultivation area or negative yield."
        })

    target_col = "Yield"
    cat_cols = ["Crop", "Season", "State"]
    num_cols = ["Area", "Annual_Rainfall", "Fertilizer", "Pesticide"]
    feature_cols = cat_cols + num_cols

    print("\nDATA LEAKAGE REMOVAL AUDIT:")
    for rf in removed_items:
        print(f"  - [{rf['feature']}]: {rf['reason']}")

    return df, cat_cols, num_cols, target_col, removed_items


def render_actual_vs_predicted(y_true: np.ndarray, y_pred: np.ndarray, save_path: str):
    """Renders Actual vs Predicted scatter plot on log-log scale for visual clarity."""
    fig, ax = plt.subplots(figsize=(7, 6))

    # Mask positive values for log scale visualization
    mask = (y_true > 0) & (y_pred > 0)
    ax.scatter(y_true[mask], y_pred[mask], alpha=0.35, edgecolors="none", s=22, color="#0284c7")

    min_val = max(0.1, min(y_true[mask].min(), y_pred[mask].min()))
    max_val = max(y_true[mask].max(), y_pred[mask].max())
    ax.plot([min_val, max_val], [min_val, max_val], 'r--', linewidth=2, label="Ideal Fit (y = x)")

    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("Actual Yield (Tonnes/Ha - Log Scale)", fontweight="bold")
    ax.set_ylabel("Predicted Yield (Tonnes/Ha - Log Scale)", fontweight="bold")
    ax.set_title("Crop Yield Prediction: Actual vs Predicted", fontweight="bold")
    ax.grid(True, which="both", linestyle="--", alpha=0.4)
    ax.legend(loc="upper left")

    plt.tight_layout()
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, dpi=200)
    plt.close()


def render_residual_plot(y_true: np.ndarray, y_pred: np.ndarray, save_path: str):
    """Renders Residuals vs Predicted plot."""
    fig, ax = plt.subplots(figsize=(7, 5))
    residuals = y_true - y_pred

    ax.scatter(y_pred, residuals, alpha=0.35, edgecolors="none", s=20, color="#8b5cf6")
    ax.axhline(0, color="red", linestyle="--", linewidth=1.8)

    ax.set_xlabel("Predicted Yield (Tonnes/Ha)", fontweight="bold")
    ax.set_ylabel("Residual (Actual - Predicted)", fontweight="bold")
    ax.set_title("Residual Analysis (Error Distribution)", fontweight="bold")
    ax.grid(True, linestyle="--", alpha=0.4)

    plt.tight_layout()
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, dpi=200)
    plt.close()


def render_yield_feature_importance(importances: np.ndarray, feature_names: List[str], save_path: str, top_n: int = 15):
    """Renders top N feature importances bar chart."""
    fig, ax = plt.subplots(figsize=(8, 6))

    top_indices = np.argsort(importances)[-top_n:]
    sorted_features = [feature_names[i] for i in top_indices]
    sorted_importances = importances[top_indices]

    bars = ax.barh(range(len(top_indices)), sorted_importances, color="#10b981", align="center", edgecolor="#059669")
    ax.set_yticks(range(len(top_indices)))
    ax.set_yticklabels(sorted_features, fontweight="semibold")
    ax.set_xlabel("Relative Feature Importance", fontweight="bold")
    ax.set_title(f"Top {top_n} Most Influential Yield Predictors", fontweight="bold")
    ax.grid(True, axis="x", linestyle="--", alpha=0.5)

    for bar in bars:
        w = bar.get_width()
        ax.text(w + 0.005, bar.get_y() + bar.get_height() / 2, f"{w:.3f}", va="center", ha="left", fontsize=8, fontweight="bold")

    plt.tight_layout()
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, dpi=200)
    plt.close()


def train_yield_prediction(
    dataset_path: Optional[str] = None,
    output_dir: str = "models/yield",
    report_dir: str = "reports"
) -> Dict[str, Any]:
    """
    Executes end-to-end Crop Yield regression training, multi-model benchmarking, evaluation, and serialization.
    """
    # 1. Discover dataset
    try:
        data_file = detect_yield_dataset_path(dataset_path)
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
    df_clean, cat_cols, num_cols, target_col, removed_items = perform_data_leakage_checks_and_cleaning(df_raw)

    total_samples = len(df_clean)
    all_features = cat_cols + num_cols

    # 3. Time-Aware Validation Strategy: Split by Crop_Year
    # Past years (1997 to 2016) for Training; Future years (2017 to 2020) for Validation
    cutoff_year = 2016
    train_df = df_clean[df_clean["Crop_Year"] <= cutoff_year].copy()
    val_df = df_clean[df_clean["Crop_Year"] > cutoff_year].copy()

    X_train = train_df[all_features]
    y_train = train_df[target_col].values
    X_val = val_df[all_features]
    y_val = val_df[target_col].values

    print(f"\nTIME-AWARE TEMPORAL DATA SPLIT:")
    print(f"- Training set (Crop_Year <= {cutoff_year}): {len(train_df):,} samples ({len(train_df)/total_samples:.1%})")
    print(f"- Validation set (Crop_Year > {cutoff_year}): {len(val_df):,} samples ({len(val_df)/total_samples:.1%})")
    print(f"- Categorical features: {cat_cols}")
    print(f"- Numerical features: {num_cols}")
    print(f"- Target: {target_col} (Unit: Tonnes/Ha; Coconut: thousand nuts/ha)")

    # 4. Fit Preprocessor ONLY on Training Data
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols)
        ]
    )

    X_train_proc = preprocessor.fit_transform(X_train)
    X_val_proc = preprocessor.transform(X_val)

    # Extract all processed feature names
    cat_feature_names = list(preprocessor.named_transformers_["cat"].get_feature_names_out(cat_cols))
    all_proc_feature_names = num_cols + cat_feature_names

    # 5. Initialize Candidate Regression Models
    candidate_models = {
        "Linear Regression (Ridge)": Ridge(alpha=1.0, random_state=42),
        "Random Forest": RandomForestRegressor(
            n_estimators=100,
            max_depth=20,
            random_state=42,
            n_jobs=-1
        ),
        "Gradient Boosting": GradientBoostingRegressor(
            n_estimators=100,
            max_depth=6,
            random_state=42
        )
    }

    if HAS_XGB:
        candidate_models["XGBoost"] = xgb.XGBRegressor(
            n_estimators=150,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
    else:
        print("[INFO] XGBoost not installed; skipping XGBoost.")

    if HAS_LGB:
        candidate_models["LightGBM"] = lgb.LGBMRegressor(
            n_estimators=150,
            max_depth=8,
            learning_rate=0.1,
            random_state=42,
            verbose=-1
        )
    else:
        print("[INFO] LightGBM not installed; skipping LightGBM.")

    if HAS_CATBOOST:
        candidate_models["CatBoost"] = cb.CatBoostRegressor(
            iterations=150,
            depth=6,
            learning_rate=0.1,
            random_seed=42,
            verbose=0
        )
    else:
        print("[INFO] CatBoost not installed; skipping CatBoost.")

    # 6. Train and Benchmark Models
    comparison_records = []
    fitted_models = {}
    best_rmse = float("inf")
    best_model_name = None

    print("\n" + "=" * 60)
    print("REGRESSION MODEL BENCHMARKING (Primary: Lowest RMSE / MAE)")
    print("=" * 60)

    for name, reg in candidate_models.items():
        t0 = time.time()
        reg.fit(X_train_proc, y_train)
        fit_time = time.time() - t0

        t1 = time.time()
        preds = reg.predict(X_val_proc)
        pred_time = (time.time() - t1) * 1000.0 / len(X_val)

        mae = mean_absolute_error(y_val, preds)
        rmse = float(np.sqrt(mean_squared_error(y_val, preds)))
        r2 = float(r2_score(y_val, preds))

        # MAPE calculation on non-zero yield values
        mask = y_val > 0.01
        mape = float(np.mean(np.abs((y_val[mask] - preds[mask]) / y_val[mask])) * 100) if mask.sum() > 0 else 0.0

        fitted_models[name] = reg

        record = {
            "Model": name,
            "MAE": round(mae, 4),
            "RMSE": round(rmse, 4),
            "R2": round(r2, 4),
            "MAPE (%)": round(mape, 2),
            "Fit Time (s)": round(fit_time, 3),
            "Latency (ms/sample)": round(pred_time, 4)
        }
        comparison_records.append(record)

        print(
            f"{name:<25} | MAE: {mae:7.3f} | RMSE: {rmse:7.3f} | R2: {r2:6.4f} | "
            f"MAPE: {mape:6.2f}% | Fit: {fit_time:5.2f}s | Latency: {pred_time:.4f}ms"
        )

        # Primary selection: Lowest RMSE, tie-breaker MAE / R2 / Speed
        if rmse < best_rmse:
            best_rmse = rmse
            best_model_name = name

    comparison_df = pd.DataFrame(comparison_records)
    best_model = fitted_models[best_model_name]
    best_row = comparison_df[comparison_df["Model"] == best_model_name].iloc[0]

    print("=" * 60)
    print(f"WINNING REGRESSION MODEL SELECTED: {best_model_name} (RMSE: {best_row['RMSE']:.4f}, R2: {best_row['R2']:.4f})")
    print("=" * 60)

    # 7. Serialization and Artifact Saving
    out_dir_path = workspace_root / output_dir
    ai_out_dir_path = ai_root / "models" / "yield"
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
        "all_input_features": all_features,
        "processed_features_count": len(all_proc_feature_names),
        "target": target_col,
        "unit": "Tonnes/Ha",
        "coconut_unit": "Nuts/Ha",
        "known_crops": sorted(list(df_clean["Crop"].unique())),
        "known_seasons": sorted(list(df_clean["Season"].unique())),
        "known_states": sorted(list(df_clean["State"].unique())),
        "training_cutoff_year": cutoff_year,
        "training_samples": len(train_df),
        "validation_samples": len(val_df),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(out_dir_path / "feature_config.json", "w", encoding="utf-8") as f:
        json.dump(feature_config, f, indent=4)
    with open(ai_out_dir_path / "feature_config.json", "w", encoding="utf-8") as f:
        json.dump(feature_config, f, indent=4)

    # Save Metadata
    metadata = {
        "module": "crop_yield_prediction",
        "best_model": best_model_name,
        "metrics": {
            "mae": float(best_row["MAE"]),
            "rmse": float(best_row["RMSE"]),
            "r2": float(best_row["R2"]),
            "mape": float(best_row["MAPE (%)"])
        },
        "dataset": inspection["filename"],
        "dataset_rows": total_samples,
        "training_cutoff_year": cutoff_year,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(out_dir_path / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)
    with open(ai_out_dir_path / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)

    # 8. Visualizations and Evaluation Report
    reports_path = workspace_root / report_dir
    ai_reports_path = ai_root / "reports"
    for rpath in [reports_path / "figures", ai_reports_path / "figures"]:
        rpath.mkdir(parents=True, exist_ok=True)

    # Comparison CSV
    comp_csv_path = reports_path / "yield_model_comparison.csv"
    comparison_df.to_csv(comp_csv_path, index=False)
    comparison_df.to_csv(ai_reports_path / "yield_model_comparison.csv", index=False)

    # Predictions for best model
    val_preds = best_model.predict(X_val_proc)

    # Actual vs Predicted Plot
    act_pred_path = str(reports_path / "figures" / "yield_actual_vs_predicted.png")
    render_actual_vs_predicted(y_val, val_preds, act_pred_path)
    shutil.copy(act_pred_path, str(ai_reports_path / "figures" / "yield_actual_vs_predicted.png"))

    # Residual Plot
    resid_path = str(reports_path / "figures" / "yield_residuals.png")
    render_residual_plot(y_val, val_preds, resid_path)
    shutil.copy(resid_path, str(ai_reports_path / "figures" / "yield_residuals.png"))

    # Feature Importance
    feat_imp_path = str(reports_path / "figures" / "yield_feature_importance.png")
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
        render_yield_feature_importance(importances, all_proc_feature_names, feat_imp_path)
        shutil.copy(feat_imp_path, str(ai_reports_path / "figures" / "yield_feature_importance.png"))

    # Generate Markdown Report
    report_md = f"""# AgriSmart AI – Crop Yield ML Evaluation Report

**Date**: {time.strftime('%Y-%m-%d %H:%M:%S')}  
**Dataset**: `{inspection['filename']}` ({total_samples:,} samples, {len(all_features)} input features)  
**Primary Selection Metric**: **Lowest RMSE & MAE** (Validated with temporal holdout)

---

## 1. Dataset Audit & Problem Formulation

- **Origin**: Agricultural Crop Yield in Indian States Dataset (ICAR / Ministry of Agriculture telemetry)
- **Total Valid Records**: {total_samples:,}
- **Target Variable**: `Yield` (Continuous, metric tonnes per hectare / nuts/ha for coconut)
- **Features Used**:
  - **Categorical ({len(cat_cols)})**: `Crop`, `Season`, `State`
  - **Numerical ({len(num_cols)})**: `Area`, `Annual_Rainfall`, `Fertilizer`, `Pesticide`
- **Validation Strategy**: **Time-Aware Temporal Split**
  - **Training Historical Period**: 1997 – 2016 ({len(train_df):,} samples, {len(train_df)/total_samples:.1%})
  - **Validation Future Period**: 2017 – 2020 ({len(val_df):,} samples, {len(val_df)/total_samples:.1%})
  - *No temporal lookahead leakage: models are strictly evaluated on unseen future harvest years.*

---

## 2. Data Leakage Checks & Mitigations

| Removed Feature / Item | Type | Agronomic Rationale & Leakage Mitigation |
|---|---|---|
"""
    for rf in removed_items:
        report_md += f"| `{rf['feature']}` | Leakage / Non-Agronomic | {rf['reason']} |\n"

    report_md += f"""
---

## 3. Multi-Model Benchmark & Comparison

| Model | MAE | RMSE | R² | MAPE (%) | Fit Time (s) | Latency (ms/sample) |
|---|---|---|---|---|---|---|
"""
    for _, r in comparison_df.iterrows():
        is_best = "**" if r["Model"] == best_model_name else ""
        report_md += f"| {is_best}{r['Model']}{is_best} | {is_best}{r['MAE']:.4f}{is_best} | {is_best}{r['RMSE']:.4f}{is_best} | {is_best}{r['R2']:.4f}{is_best} | {r['MAPE (%)']:.2f}% | {r['Fit Time (s)']}s | {r['Latency (ms/sample)']}ms |\n"

    report_md += f"""
---

## 4. Best Model Performance: **{best_model_name}**

- **RMSE**: {best_row['RMSE']:.4f}
- **MAE**: {best_row['MAE']:.4f}
- **R² Score**: {best_row['R2']:.4f} ({best_row['R2']*100:.2f}% variance explained)
- **MAPE**: {best_row['MAPE (%)']:.2f}%
- **Inference Latency**: {best_row['Latency (ms/sample)']} ms per sample

### Actual vs Predicted Analysis
![Actual vs Predicted Yield](figures/yield_actual_vs_predicted.png)

### Residual Distribution Analysis
![Residual Analysis](figures/yield_residuals.png)

### Feature Importance
![Yield Feature Importance](figures/yield_feature_importance.png)

---

## 5. Serialization & Saved Pipeline

- **Trained Model Checkpoint**: `{out_dir_path / 'best_model.pkl'}`
- **ColumnTransformer Preprocessor**: `{out_dir_path / 'preprocessor.pkl'}`
- **Feature Configuration**: `{out_dir_path / 'feature_config.json'}`
- **Metadata**: `{out_dir_path / 'metadata.json'}`
"""
    with open(reports_path / "yield_report.md", "w", encoding="utf-8") as f:
        f.write(report_md)
    with open(ai_reports_path / "yield_report.md", "w", encoding="utf-8") as f:
        f.write(report_md)

    # 9. Update model_registry.json SAFELY preserving disease, crop_recommendation, and irrigation entries
    for reg_path in [workspace_root / "models" / "model_registry.json", ai_root / "models" / "model_registry.json"]:
        if reg_path.exists():
            with open(reg_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
        else:
            registry = {}

        registry["yield"] = {
            "status": "OK",
            "best_model": best_model_name,
            "primary_metric": "rmse",
            "score": float(best_row["RMSE"]),
            "mae": float(best_row["MAE"]),
            "rmse": float(best_row["RMSE"]),
            "r2": float(best_row["R2"]),
            "mape": float(best_row["MAPE (%)"]),
            "path": "models/yield/best_model.pkl",
            "features": all_features,
            "unit": "Tonnes/Ha",
            "training_date": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        with open(reg_path, "w", encoding="utf-8") as f:
            json.dump(registry, f, indent=4)

    return {
        "status": "OK",
        "best_model": best_model_name,
        "metrics": {
            "mae": float(best_row["MAE"]),
            "rmse": float(best_row["RMSE"]),
            "r2": float(best_row["R2"]),
            "mape": float(best_row["MAPE (%)"])
        },
        "dataset_name": inspection["filename"],
        "samples": total_samples,
        "target": target_col,
        "saved_model": str(out_dir_path / "best_model.pkl"),
        "preprocessor": str(out_dir_path / "preprocessor.pkl"),
        "report": str(reports_path / "yield_report.md")
    }


if __name__ == "__main__":
    train_yield_prediction()
