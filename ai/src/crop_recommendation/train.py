"""
AgriSmart AI – Crop Recommendation Training & Evaluation
Trains Random Forest and Gradient Boosting models IF a real labeled dataset is present.
"""
from pathlib import Path
from typing import Dict, Any, Optional
import os
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score


def train_crop_recommendation(
    dataset_path: Optional[str] = None,
    output_dir: str = "ai/models/crop_recommendation"
) -> Dict[str, Any]:
    """
    Trains crop recommendation model ONLY if a real dataset exists.
    Otherwise returns 'NOT TRAINED – REAL DATASET REQUIRED'.
    """
    root = Path(__file__).resolve().parents[3]
    ai_root = Path(__file__).resolve().parents[2]

    candidates = [
        Path(dataset_path) if dataset_path else None,
        ai_root / "data" / "crop_recommendation.csv",
        root / "data" / "crop_recommendation.csv",
        root / "dataset" / "crop_recommendation.csv"
    ]
    resolved_path = None
    for c in candidates:
        if c and c.exists():
            resolved_path = c
            break

    if not resolved_path:
        return {
            "status": "SKIPPED",
            "reason": "NOT TRAINED – REAL DATASET REQUIRED (Expected: data/crop_recommendation.csv)",
            "metrics": None,
            "best_model": None
        }

    # Load real dataset
    df = pd.read_csv(resolved_path)
    feature_cols = [c for c in df.columns if c.lower() != "label"]
    X = df[feature_cols]
    y = df["label"] if "label" in df.columns else df[df.columns[-1]]

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, random_state=42)
    }

    best_score = -1.0
    best_model_name = None
    best_model = None
    best_metrics = {}

    for name, clf in models.items():
        clf.fit(X_train, y_train)
        preds = clf.predict(X_val)
        acc = float(accuracy_score(y_val, preds))
        macro_f1 = float(f1_score(y_val, preds, average="macro", zero_division=0))
        prec = float(precision_score(y_val, preds, average="macro", zero_division=0))
        rec = float(recall_score(y_val, preds, average="macro", zero_division=0))

        metrics = {"accuracy": round(acc, 4), "macro_f1": round(macro_f1, 4), "precision": round(prec, 4), "recall": round(rec, 4)}

        if macro_f1 > best_score:
            best_score = macro_f1
            best_model_name = name
            best_model = clf
            best_metrics = metrics

    out_p = Path(output_dir)
    out_p.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, out_p / "best_model.pkl")

    return {
        "status": "OK",
        "best_model": best_model_name,
        "metrics": best_metrics,
        "saved_path": str(out_p / "best_model.pkl")
    }
