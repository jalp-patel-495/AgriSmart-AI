"""
AgriSmart AI – Smart Irrigation Training & Evaluation
Trains Logistic Regression and Random Forest models IF a real labeled dataset exists.
"""
from pathlib import Path
from typing import Dict, Any, Optional
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score


def train_irrigation(
    dataset_path: Optional[str] = None,
    output_dir: str = "ai/models/irrigation"
) -> Dict[str, Any]:
    """
    Trains smart irrigation model ONLY if real labeled dataset is present.
    """
    root = Path(__file__).resolve().parents[3]
    ai_root = Path(__file__).resolve().parents[2]

    candidates = [
        Path(dataset_path) if dataset_path else None,
        ai_root / "data" / "irrigation_data.csv",
        root / "data" / "irrigation_data.csv",
        root / "dataset" / "irrigation_data.csv"
    ]
    resolved = None
    for c in candidates:
        if c and c.exists():
            resolved = c
            break

    if not resolved:
        return {
            "status": "SKIPPED",
            "reason": "NOT TRAINED – REAL DATASET REQUIRED (Expected: data/irrigation_data.csv)",
            "metrics": None,
            "best_model": None
        }

    df = pd.read_csv(resolved)
    target_col = [c for c in df.columns if "irrigat" in c.lower() or "label" in c.lower()][0]
    X = df[[c for c in df.columns if c != target_col]]
    y = df[target_col]

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
        "Logistic Regression": LogisticRegression(max_iter=500),
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
        f1 = float(f1_score(y_val, preds, zero_division=0))
        metrics = {"accuracy": round(acc, 4), "f1": round(f1, 4)}

        if f1 > best_score:
            best_score = f1
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
