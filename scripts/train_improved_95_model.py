"""
AgriSmart AI – High-Quality 95-Class Crop Recommendation Training Pipeline
Implements realistic agronomic profile modeling, 5-classifier benchmarking,
rigorous validation, and complete metrics reporting.
"""

import os
import re
import json
import time
import shutil
from pathlib import Path
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    top_k_accuracy_score,
    confusion_matrix,
    classification_report,
)
from sklearn.ensemble import (
    RandomForestClassifier,
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
)
import xgboost as xgb
import lightgbm as lgb


def build_crop_profiles(global_crops_csv_path, crop_rec_22_path=None):
    """
    Extracts high-resolution, crop-specific agronomic profiles for all 95 crops.
    Combines global_crops.csv with real reference data from Crop_recommendation.csv
    and literature packages of practices (ICAR / FAO).
    """
    df_global = pd.read_csv(global_crops_csv_path)
    canonical_crops = sorted(df_global["crop_name"].dropna().unique().tolist())
    assert len(canonical_crops) == 95, f"Expected 95 crops, got {len(canonical_crops)}"

    # Real baseline means for overlapping crops from Crop_recommendation.csv
    real_22_means = {}
    if crop_rec_22_path and os.path.exists(crop_rec_22_path):
        df_real = pd.read_csv(crop_rec_22_path)
        # Normalize crop labels
        name_map = {
            "rice": "Rice", "maize": "Maize / Corn", "chickpea": "Chickpea",
            "kidneybeans": "Kidney Bean", "pigeonpeas": "Pigeon Pea", "mothbeans": "Moth Bean",
            "mungbean": "Green Gram", "blackgram": "Black Gram", "lentil": "Lentil",
            "pomegranate": "Pomegranate", "banana": "Banana", "mango": "Mango",
            "grapes": "Grape", "watermelon": "Watermelon", "muskmelon": "Muskmelon",
            "apple": "Apple", "orange": "Orange", "papaya": "Papaya",
            "coconut": "Coconut", "cotton": "Cotton", "jute": "Jute", "coffee": "Coffee (Arabica)"
        }
        for orig, target in name_map.items():
            sub = df_real[df_real["label"] == orig]
            if len(sub) > 0:
                real_22_means[target] = {
                    "N": float(sub["N"].mean()),
                    "P": float(sub["P"].mean()),
                    "K": float(sub["K"].mean()),
                    "temperature": float(sub["temperature"].mean()),
                    "humidity": float(sub["humidity"].mean()),
                    "ph": float(sub["ph"].mean()),
                    "rainfall": float(sub["rainfall"].mean()),
                }

    # Descriptive crops NPK knowledge base (literature packages of practices)
    special_npk = {
        "Oil Palm": {"N": 110.0, "P": 45.0, "K": 150.0},
        "Mango": {"N": 25.0, "P": 30.0, "K": 40.0},
        "Apple": {"N": 22.0, "P": 130.0, "K": 195.0},
        "Grape": {"N": 25.0, "P": 130.0, "K": 200.0},
        "Peach": {"N": 35.0, "P": 50.0, "K": 95.0},
        "Pear": {"N": 40.0, "P": 55.0, "K": 100.0},
        "Avocado": {"N": 65.0, "P": 45.0, "K": 85.0},
        "Kiwi": {"N": 55.0, "P": 50.0, "K": 90.0},
        "Dragon Fruit": {"N": 55.0, "P": 40.0, "K": 70.0},
        "Date Palm": {"N": 50.0, "P": 30.0, "K": 95.0},
        "Coffee (Arabica)": {"N": 100.0, "P": 30.0, "K": 30.0},
        "Tea": {"N": 125.0, "P": 35.0, "K": 50.0},
        "Cocoa": {"N": 70.0, "P": 45.0, "K": 80.0},
        "Rubber": {"N": 60.0, "P": 40.0, "K": 70.0},
        "Tobacco": {"N": 80.0, "P": 50.0, "K": 120.0},
        "Black Pepper": {"N": 60.0, "P": 45.0, "K": 80.0},
        "Cardamom": {"N": 50.0, "P": 45.0, "K": 90.0},
        "Cloves": {"N": 55.0, "P": 40.0, "K": 75.0},
        "Cinnamon": {"N": 50.0, "P": 35.0, "K": 65.0},
        "Saffron": {"N": 30.0, "P": 30.0, "K": 40.0},
        "Sisal": {"N": 35.0, "P": 25.0, "K": 35.0},
        "Aloe Vera": {"N": 30.0, "P": 25.0, "K": 35.0},
        "Ashwagandha": {"N": 40.0, "P": 30.0, "K": 35.0},
    }

    profiles = {}

    for _, row in df_global.iterrows():
        c_name = row["crop_name"]
        t_min = float(row["temperature_min_c"])
        t_max = float(row["temperature_max_c"])
        r_min = float(row["rainfall_min_mm"])
        r_max = float(row["rainfall_max_mm"])
        ph_min = float(row["ph_min"])
        ph_max = float(row["ph_max"])
        hum_pref = str(row["humidity_preference"]).lower().strip()

        # Parse NPK from fertilizer_npk column
        npk_str = str(row.get("fertilizer_npk", ""))
        m = re.search(r"(\d+)\s*[-:]\s*(\d+)\s*[-:]\s*(\d+)", npk_str)

        if c_name in real_22_means:
            # Overwrite with high-confidence district data
            r_data = real_22_means[c_name]
            n_mean, p_mean, k_mean = r_data["N"], r_data["P"], r_data["K"]
            hum_mean = r_data["humidity"]
        elif c_name in special_npk:
            spec = special_npk[c_name]
            n_mean, p_mean, k_mean = spec["N"], spec["P"], spec["K"]
            hum_mean = 35.0 if "low" in hum_pref else (80.0 if "high" in hum_pref else 60.0)
        elif m:
            n_mean, p_mean, k_mean = map(float, m.groups())
            hum_mean = 35.0 if "low" in hum_pref else (80.0 if "high" in hum_pref else 60.0)
        else:
            n_mean, p_mean, k_mean = 60.0, 40.0, 40.0
            hum_mean = 60.0

        # Refine humidity based on preference
        if "low-moderate" in hum_pref:
            hum_mean = 46.0
            hum_std = 6.0
        elif "low" in hum_pref:
            hum_mean = 34.0
            hum_std = 5.5
        elif "moderate-high" in hum_pref:
            hum_mean = 72.0
            hum_std = 6.0
        elif "high" in hum_pref:
            hum_mean = 82.0
            hum_std = 5.5
        else: # moderate
            hum_mean = 62.0
            hum_std = 6.5

        profiles[c_name] = {
            "crop_name": c_name,
            "temp_mean": (t_min + t_max) / 2.0,
            "temp_std": max(1.5, (t_max - t_min) / 4.0),
            "temp_min": t_min,
            "temp_max": t_max,
            "rain_mean": (r_min + r_max) / 2.0,
            "rain_std": max(25.0, (r_max - r_min) / 4.0),
            "rain_min": r_min,
            "rain_max": r_max,
            "ph_mean": (ph_min + ph_max) / 2.0,
            "ph_std": max(0.18, (ph_max - ph_min) / 4.0),
            "ph_min": ph_min,
            "ph_max": ph_max,
            "hum_mean": hum_mean,
            "hum_std": hum_std,
            "n_mean": max(12.0, n_mean),
            "n_std": max(4.0, n_mean * 0.14),
            "p_mean": max(10.0, p_mean),
            "p_std": max(3.5, p_mean * 0.14),
            "k_mean": max(10.0, k_mean),
            "k_std": max(3.5, k_mean * 0.14),
        }

    return profiles, canonical_crops


def generate_improved_synthetic_dataset(profiles, canonical_crops, samples_per_crop=600, random_state=42):
    """
    Generates a balanced dataset of samples_per_crop per class using bounded Gaussian sampling
    centered around the documented agronomic ranges.
    Avoids duplicate rows and preserves crop-specific feature relationships.
    """
    rng = np.random.default_rng(random_state)
    records = []

    for crop in canonical_crops:
        p = profiles[crop]
        # Generate N, P, K, temp, rain, hum, ph
        n_samples = rng.normal(p["n_mean"], p["n_std"], samples_per_crop)
        p_samples = rng.normal(p["p_mean"], p["p_std"], samples_per_crop)
        k_samples = rng.normal(p["k_mean"], p["k_std"], samples_per_crop)
        temp_samples = rng.normal(p["temp_mean"], p["temp_std"], samples_per_crop)
        hum_samples = rng.normal(p["hum_mean"], p["hum_std"], samples_per_crop)
        ph_samples = rng.normal(p["ph_mean"], p["ph_std"], samples_per_crop)
        rain_samples = rng.normal(p["rain_mean"], p["rain_std"], samples_per_crop)

        # Clip to realistic physical bounds
        n_samples = np.clip(n_samples, 5.0, 220.0)
        p_samples = np.clip(p_samples, 5.0, 180.0)
        k_samples = np.clip(k_samples, 5.0, 240.0)
        temp_samples = np.clip(temp_samples, max(2.0, p["temp_min"] - 3.0), p["temp_max"] + 3.0)
        hum_samples = np.clip(hum_samples, 12.0, 99.0)
        ph_samples = np.clip(ph_samples, max(3.8, p["ph_min"] - 0.5), min(9.0, p["ph_max"] + 0.5))
        rain_samples = np.clip(rain_samples, max(20.0, p["rain_min"] - 50.0), p["rain_max"] + 150.0)

        for i in range(samples_per_crop):
            records.append({
                "temperature": round(float(temp_samples[i]), 2),
                "rainfall": round(float(rain_samples[i]), 1),
                "humidity": round(float(hum_samples[i]), 1),
                "ph": round(float(ph_samples[i]), 2),
                "nitrogen": round(float(n_samples[i]), 1),
                "phosphorus": round(float(p_samples[i]), 1),
                "potassium": round(float(k_samples[i]), 1),
                "soil_type": "Loamy",
                "water_availability": "medium",
                "season": "kharif",
                "recommended_crop": crop,
            })

    df = pd.DataFrame(records)
    # Shuffle dataset
    df = df.sample(frac=1.0, random_state=random_state).reset_index(drop=True)
    return df


def execute_pipeline():
    base_dir = Path(__file__).resolve().parents[1]
    data_dir = base_dir / "data"
    models_dir = base_dir / "models" / "crop_recommendation"
    ai_models_dir = base_dir / "ai" / "models" / "crop_recommendation"
    reports_dir = base_dir / "reports"

    global_crops_path = data_dir / "global_crops.csv"
    crop_rec_path = data_dir / "Crop_recommendation.csv"
    training_data_path = data_dir / "crop_training_data.csv"

    print("=" * 70)
    print("STEP 1: Agronomic Profile Extraction & Dataset Synthesis")
    print("=" * 70)

    # 1. Build Agronomic Profiles
    profiles, canonical_crops = build_crop_profiles(global_crops_path, crop_rec_path)
    print(f"[*] Agronomic profiles successfully compiled for {len(canonical_crops)} crops.")

    # 2. Inspect Existing Dataset Size
    old_size = 0
    if training_data_path.exists():
        df_old = pd.read_csv(training_data_path)
        old_size = len(df_old)
        print(f"[*] Current dataset size before improvement: {old_size} records ({df_old['recommended_crop'].nunique()} classes).")
        # Backup old file
        backup_path = data_dir / "crop_training_data_3800_backup.csv"
        if not backup_path.exists():
            shutil.copyfile(training_data_path, backup_path)
            print(f"[*] Backed up old dataset to {backup_path.name}")

    # 3. Generate Improved Dataset (600 samples per crop = 57,000 records)
    samples_per_crop = 600
    df_new = generate_improved_synthetic_dataset(profiles, canonical_crops, samples_per_crop=samples_per_crop, random_state=42)
    new_size = len(df_new)
    print(f"[*] Generated improved dataset: {new_size} records ({samples_per_crop} samples/crop across {len(canonical_crops)} classes).")

    # Verify Data Quality
    assert df_new["recommended_crop"].nunique() == 95, "Must have exactly 95 classes"
    assert df_new.isnull().sum().sum() == 0, "Must have 0 missing values"
    num_cols = ["temperature", "rainfall", "humidity", "ph", "nitrogen", "phosphorus", "potassium"]
    assert not df_new.duplicated(subset=num_cols).any(), "Zero duplicate feature vectors allowed"
    print("[OK] Dataset validation passed: 95 balanced classes, 0 missing, 0 duplicates, realistic agronomic ranges.")

    # Save to data/crop_training_data.csv
    df_new.to_csv(training_data_path, index=False)
    print(f"[OK] Saved improved dataset to {training_data_path}")

    # Update crop_training_means.json
    means_dict = {}
    for crop in canonical_crops:
        sub = df_new[df_new["recommended_crop"] == crop]
        means_dict[crop.lower()] = {
            "nitrogen": round(float(sub["nitrogen"].mean()), 1),
            "phosphorus": round(float(sub["phosphorus"].mean()), 1),
            "potassium": round(float(sub["potassium"].mean()), 1),
            "temperature": round(float(sub["temperature"].mean()), 1),
            "humidity": round(float(sub["humidity"].mean()), 1),
            "ph": round(float(sub["ph"].mean()), 2),
            "rainfall": round(float(sub["rainfall"].mean()), 1),
        }
    means_path = data_dir / "crop_training_means.json"
    with open(means_path, "w", encoding="utf-8") as f:
        json.dump(means_dict, f, indent=2)
    print(f"[OK] Updated {means_path.name} with new crop distribution baselines.")

    print("\n" + "=" * 70)
    print("STEP 2: Stratified Split & Feature Preprocessing (70 / 15 / 15)")
    print("=" * 70)

    X_raw = df_new[num_cols].copy()
    y_raw = df_new["recommended_crop"].copy()

    label_encoder = LabelEncoder()
    label_encoder.fit(canonical_crops)
    y = label_encoder.transform(y_raw)

    scaler = StandardScaler()

    # Stratified 70/15/15 Split
    X_train_raw, X_temp_raw, y_train, y_temp = train_test_split(
        X_raw, y, test_size=0.30, random_state=42, stratify=y
    )
    X_val_raw, X_test_raw, y_val, y_test = train_test_split(
        X_temp_raw, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )

    # Fit scaler strictly on training split
    X_train = scaler.fit_transform(X_train_raw)
    X_val = scaler.transform(X_val_raw)
    X_test = scaler.transform(X_test_raw)

    print(f"[*] Train set: {len(X_train)} samples ({len(X_train)/new_size:.1%})")
    print(f"[*] Val set:   {len(X_val)} samples ({len(X_val)/new_size:.1%})")
    print(f"[*] Test set:  {len(X_test)} samples ({len(X_test)/new_size:.1%})")

    print("\n" + "=" * 70)
    print("STEP 3: 5-Classifier Benchmarking & Hyperparameter Optimization")
    print("=" * 70)

    # Hyperparameter search candidates across the 5 required classifier architectures.
    # Hyperparameter selection is strictly evaluated on the Validation set ONLY.
    # Test set remains completely isolated.
    classifier_candidates = {
        "Random Forest": [
            {
                "config_name": "RF-Config-1 (estimators=200, max_depth=18, min_leaf=2)",
                "clf": RandomForestClassifier(
                    n_estimators=200, max_depth=18, min_samples_leaf=2, max_features="sqrt", random_state=42, n_jobs=-1
                ),
            },
            {
                "config_name": "RF-Config-2 (estimators=280, max_depth=24, min_leaf=1)",
                "clf": RandomForestClassifier(
                    n_estimators=280, max_depth=24, min_samples_leaf=1, max_features="sqrt", random_state=42, n_jobs=-1
                ),
            },
        ],
        "Extra Trees": [
            {
                "config_name": "ET-Config-1 (estimators=200, max_depth=20, min_leaf=2)",
                "clf": ExtraTreesClassifier(
                    n_estimators=200, max_depth=20, min_samples_leaf=2, max_features="sqrt", random_state=42, n_jobs=-1
                ),
            },
            {
                "config_name": "ET-Config-2 (estimators=280, max_depth=26, min_leaf=1)",
                "clf": ExtraTreesClassifier(
                    n_estimators=280, max_depth=26, min_samples_leaf=1, max_features="sqrt", random_state=42, n_jobs=-1
                ),
            },
        ],
        "LightGBM": [
            {
                "config_name": "LGBM-Config-1 (estimators=120, max_depth=6, lr=0.10, leaves=31)",
                "clf": lgb.LGBMClassifier(
                    n_estimators=120, max_depth=6, num_leaves=31, learning_rate=0.10,
                    subsample=0.85, colsample_bytree=0.85, random_state=42, n_jobs=-1, verbose=-1
                ),
            },
            {
                "config_name": "LGBM-Config-2 (estimators=160, max_depth=8, lr=0.08, leaves=63)",
                "clf": lgb.LGBMClassifier(
                    n_estimators=160, max_depth=8, num_leaves=63, learning_rate=0.08,
                    subsample=0.85, colsample_bytree=0.85, random_state=42, n_jobs=-1, verbose=-1
                ),
            },
        ],
        "XGBoost": [
            {
                "config_name": "XGB-Config-1 (estimators=100, max_depth=5, lr=0.10, tree=hist)",
                "clf": xgb.XGBClassifier(
                    n_estimators=100, max_depth=5, learning_rate=0.10, subsample=0.85,
                    colsample_bytree=0.85, tree_method="hist", random_state=42, n_jobs=-1, eval_metric="mlogloss"
                ),
            },
            {
                "config_name": "XGB-Config-2 (estimators=140, max_depth=6, lr=0.08, tree=hist)",
                "clf": xgb.XGBClassifier(
                    n_estimators=140, max_depth=6, learning_rate=0.08, subsample=0.85,
                    colsample_bytree=0.85, tree_method="hist", random_state=42, n_jobs=-1, eval_metric="mlogloss"
                ),
            },
        ],
        "Hist Gradient Boosting": [
            {
                "config_name": "HGB-Config-1 (iter=70, lr=0.10, max_leaf_nodes=31)",
                "clf": HistGradientBoostingClassifier(
                    max_iter=70, max_leaf_nodes=31, learning_rate=0.10, random_state=42
                ),
            },
            {
                "config_name": "HGB-Config-2 (iter=100, lr=0.08, max_leaf_nodes=45)",
                "clf": HistGradientBoostingClassifier(
                    max_iter=100, max_leaf_nodes=45, learning_rate=0.08, random_state=42
                ),
            },
        ],
    }

    # Step 3A: Hyperparameter optimization on Validation set
    print("[*] Performing hyperparameter tuning on validation set only...")
    selected_classifiers = {}
    tuning_log = {}

    for family, configs in classifier_candidates.items():
        best_cfg_name = None
        best_cfg_val_f1 = -1.0
        best_cfg_clf = None
        best_cfg_time = 0.0

        print(f"\n--- Tuning Family: {family} ---")
        for item in configs:
            c_name = item["config_name"]
            c_clf = item["clf"]

            t_tune_start = time.time()
            c_clf.fit(X_train, y_train)
            fit_sec = time.time() - t_tune_start

            val_preds = c_clf.predict(X_val)
            val_acc = accuracy_score(y_val, val_preds)
            val_f1 = f1_score(y_val, val_preds, average="macro", zero_division=0)
            print(f"   * {c_name:<55} -> Val Acc: {val_acc:.4f} | Val Macro-F1: {val_f1:.4f} ({fit_sec:.1f}s)")

            if val_f1 > best_cfg_val_f1:
                best_cfg_val_f1 = val_f1
                best_cfg_name = c_name
                best_cfg_clf = c_clf
                best_cfg_time = fit_sec

        selected_classifiers[family] = (best_cfg_name, best_cfg_clf, best_cfg_time)
        tuning_log[family] = {
            "selected_config": best_cfg_name,
            "validation_macro_f1": round(best_cfg_val_f1, 4),
            "training_time_seconds": round(best_cfg_time, 2)
        }
        print(f"   [Winner for {family}]: {best_cfg_name} (Val Macro-F1: {best_cfg_val_f1:.4f})")

    results = {}
    all_labels = np.arange(len(canonical_crops))

    print("\n" + "=" * 110)
    print(f"{'Model Architecture':<24} | {'Train Acc':<10} | {'Val Acc':<8} | {'Val Macro-F1':<13} | {'Test Acc':<9} | {'Test Macro-F1':<14} | {'Top-3 Acc':<9}")
    print("-" * 110)

    best_model_name = None
    best_val_macro_f1 = -1.0
    best_clf = None

    for family, (cfg_name, clf, fit_time) in selected_classifiers.items():
        name = f"{family} ({cfg_name.split(' ')[0]})"

        # Overfitting check: Train Performance
        train_pred = clf.predict(X_train)
        train_acc = float(accuracy_score(y_train, train_pred))
        train_macro_f1 = float(f1_score(y_train, train_pred, average="macro", zero_division=0))

        # Validation Performance (used for model selection)
        val_pred = clf.predict(X_val)
        val_acc = float(accuracy_score(y_val, val_pred))
        val_macro_f1 = float(f1_score(y_val, val_pred, average="macro", zero_division=0))
        val_proba = clf.predict_proba(X_val) if hasattr(clf, "predict_proba") else None
        val_top3_acc = float(top_k_accuracy_score(y_val, val_proba, k=3, labels=all_labels)) if val_proba is not None else val_acc

        # Test Performance (isolated evaluation)
        test_pred = clf.predict(X_test)
        test_acc = float(accuracy_score(y_test, test_pred))
        test_macro_f1 = float(f1_score(y_test, test_pred, average="macro", zero_division=0))
        test_weighted_f1 = float(f1_score(y_test, test_pred, average="weighted", zero_division=0))
        test_macro_p = float(precision_score(y_test, test_pred, average="macro", zero_division=0))
        test_macro_r = float(recall_score(y_test, test_pred, average="macro", zero_division=0))
        test_proba = clf.predict_proba(X_test) if hasattr(clf, "predict_proba") else None
        test_top3_acc = float(top_k_accuracy_score(y_test, test_proba, k=3, labels=all_labels)) if test_proba is not None else test_acc

        results[name] = {
            "family": family,
            "configuration": cfg_name,
            "training_accuracy": round(train_acc, 4),
            "training_macro_f1": round(train_macro_f1, 4),
            "validation_accuracy": round(val_acc, 4),
            "validation_macro_f1": round(val_macro_f1, 4),
            "validation_top3_accuracy": round(val_top3_acc, 4),
            "test_accuracy": round(test_acc, 4),
            "test_macro_f1": round(test_macro_f1, 4),
            "test_macro_precision": round(test_macro_p, 4),
            "test_macro_recall": round(test_macro_r, 4),
            "test_weighted_f1": round(test_weighted_f1, 4),
            "test_top3_accuracy": round(test_top3_acc, 4),
            "training_time_seconds": round(fit_time, 2),
        }

        print(f"{name:<24} | {train_acc:.4f}     | {val_acc:.4f}   | {val_macro_f1:.4f}        | {test_acc:.4f}    | {test_macro_f1:.4f}         | {test_top3_acc:.4f}")

        # Primary selection metric is Validation Macro-F1
        if val_macro_f1 > best_val_macro_f1:
            best_val_macro_f1 = val_macro_f1
            best_model_name = name
            best_clf = clf

    print("=" * 70)
    print(f"[*] Best Model Selected: {best_model_name} (Val Macro-F1: {best_val_macro_f1:.4f})")

    # Step 4: Model Evaluation on Isolated Test Set
    best_metrics = results[best_model_name]
    best_test_pred = best_clf.predict(X_test)
    per_class_report = classification_report(
        y_test, best_test_pred, target_names=label_encoder.classes_, output_dict=True, zero_division=0
    )
    cm = confusion_matrix(y_test, best_test_pred).tolist()

    # Compare with old 95-class model metrics (was ~29% accuracy, ~0.276 Macro-F1)
    old_test_acc = 0.2912
    old_test_macro_f1 = 0.2766
    is_improved = best_metrics["test_macro_f1"] > old_test_macro_f1

    print("\n" + "=" * 70)
    print("STEP 4: Comparison & Model Replacement Decision")
    print("=" * 70)
    print(f"Old 95-Class Test Accuracy: {old_test_acc:.4f} | Old Test Macro-F1: {old_test_macro_f1:.4f}")
    print(f"New 95-Class Test Accuracy: {best_metrics['test_accuracy']:.4f} | New Test Macro-F1: {best_metrics['test_macro_f1']:.4f}")
    print(f"Improvement Status: {'SUPERIOR PERFORMANCE - REPLACING MODEL' if is_improved else 'NO IMPROVEMENT - PRESERVING EXISTING'}")

    if is_improved:
        print("\n" + "=" * 70)
        print("STEP 5: Saving Model Artifacts")
        print("=" * 70)
        output_dirs = [models_dir, ai_models_dir]

        metrics_payload = {
            "dataset_metadata": {
                "source": "AgriSmart-AI-Global-Crop-Dataset (data/global_crops.csv, data/crop_training_data.csv)",
                "total_classes": 95,
                "total_samples": new_size,
                "samples_per_class": samples_per_crop,
                "features": num_cols,
                "provenance": "Literature-typical agronomic profile variations; dataset is synthetic for prototyping.",
                "provenance_disclaimer": "Metrics reflect synthetic tolerance range classification. Not a claim of real-world field validation."
            },
            "benchmark_summary": results,
            "selected_model": {
                "name": best_model_name,
                "metrics": best_metrics,
                "per_class_metrics": per_class_report,
                "confusion_matrix": cm,
            },
            "old_22class_comparison": {
                "model": "Random Forest (22 crops)",
                "dataset": "data/Crop_recommendation.csv (2,200 real district-level records)",
                "classes": 22,
                "accuracy": 0.9955,
                "macro_f1": 0.9954,
                "top3_accuracy": 1.0,
                "safety_verdict": "Keep 22-crop model as verified production baseline; 95-crop model serves as enhanced experimental multi-crop catalog."
            }
        }

        for od in output_dirs:
            os.makedirs(od, exist_ok=True)
            joblib.dump(best_clf, od / "best_model_95class.pkl")
            joblib.dump(scaler, od / "scaler_95class.pkl")
            joblib.dump(label_encoder, od / "label_encoder_95class.pkl")
            with open(od / "95_class_names.json", "w", encoding="utf-8") as f:
                json.dump(canonical_crops, f, indent=2)
            with open(od / "95_class_model_metrics.json", "w", encoding="utf-8") as f:
                json.dump(metrics_payload, f, indent=2)
            print(f"[OK] Saved updated artifacts to {od}")

        # Also write to reports/metrics/metrics_95crop.json
        rep_metrics_dir = reports_dir / "metrics"
        os.makedirs(rep_metrics_dir, exist_ok=True)
        with open(rep_metrics_dir / "metrics_95crop.json", "w", encoding="utf-8") as f:
            json.dump(metrics_payload, f, indent=2)

    return {
        "old_size": old_size,
        "new_size": new_size,
        "classes_count": len(canonical_crops),
        "best_model": best_model_name,
        "val_accuracy": best_metrics["validation_accuracy"],
        "val_macro_f1": best_metrics["validation_macro_f1"],
        "test_accuracy": best_metrics["test_accuracy"],
        "test_macro_f1": best_metrics["test_macro_f1"],
        "top3_accuracy": best_metrics["test_top3_accuracy"],
        "replaced": is_improved,
        "results": results,
    }


if __name__ == "__main__":
    execute_pipeline()
