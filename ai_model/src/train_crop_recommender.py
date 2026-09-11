"""
AgriSmart AI – Crop Recommendation Model Training Pipeline
Trains a Scikit-Learn Random Forest Classifier on Soil (N, P, K, pH)
and Agrometeorological (Temperature, Humidity, Rainfall) parameters across 22 crops.
"""
import os
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score, f1_score
from sklearn.pipeline import Pipeline
import joblib

# Canonical 22 crops with realistic agronomic boundaries (mean, std)
CROP_PROFILES = {
    "Rice": {"N": (80, 10), "P": (48, 8), "K": (40, 6), "temp": (24, 2), "humidity": (82, 5), "ph": (6.5, 0.5), "rainfall": (230, 25)},
    "Maize": {"N": (78, 12), "P": (48, 10), "K": (20, 5), "temp": (22, 3), "humidity": (65, 8), "ph": (6.3, 0.6), "rainfall": (85, 15)},
    "Chickpea": {"N": (40, 8), "P": (68, 10), "K": (80, 8), "temp": (19, 2), "humidity": (17, 4), "ph": (7.3, 0.4), "rainfall": (80, 12)},
    "Kidneybeans": {"N": (21, 6), "P": (134, 12), "K": (20, 5), "temp": (20, 3), "humidity": (22, 5), "ph": (5.7, 0.4), "rainfall": (106, 20)},
    "Pigeonpeas": {"N": (21, 5), "P": (68, 9), "K": (20, 4), "temp": (28, 4), "humidity": (48, 9), "ph": (5.8, 0.6), "rainfall": (150, 25)},
    "Mothbeans": {"N": (21, 6), "P": (48, 8), "K": (20, 5), "temp": (28, 3), "humidity": (53, 9), "ph": (6.8, 0.7), "rainfall": (51, 10)},
    "Mungbean": {"N": (21, 5), "P": (48, 7), "K": (20, 4), "temp": (28, 3), "humidity": (86, 4), "ph": (6.7, 0.5), "rainfall": (48, 10)},
    "Blackgram": {"N": (40, 8), "P": (67, 10), "K": (19, 4), "temp": (30, 3), "humidity": (65, 8), "ph": (7.1, 0.4), "rainfall": (68, 12)},
    "Lentil": {"N": (19, 5), "P": (68, 9), "K": (19, 4), "temp": (23, 4), "humidity": (65, 7), "ph": (6.9, 0.5), "rainfall": (46, 8)},
    "Pomegranate": {"N": (19, 5), "P": (19, 5), "K": (40, 6), "temp": (22, 3), "humidity": (90, 4), "ph": (6.4, 0.5), "rainfall": (108, 15)},
    "Banana": {"N": (100, 12), "P": (75, 10), "K": (50, 7), "temp": (27, 2), "humidity": (80, 5), "ph": (6.0, 0.5), "rainfall": (105, 15)},
    "Mango": {"N": (20, 5), "P": (27, 6), "K": (30, 5), "temp": (31, 3), "humidity": (50, 8), "ph": (5.8, 0.6), "rainfall": (95, 15)},
    "Grapes": {"N": (23, 6), "P": (133, 14), "K": (200, 15), "temp": (24, 6), "humidity": (82, 5), "ph": (6.0, 0.5), "rainfall": (70, 10)},
    "Watermelon": {"N": (99, 12), "P": (17, 4), "K": (50, 6), "temp": (26, 3), "humidity": (85, 5), "ph": (6.5, 0.4), "rainfall": (51, 8)},
    "Muskmelon": {"N": (100, 10), "P": (18, 4), "K": (50, 5), "temp": (29, 2), "humidity": (92, 3), "ph": (6.4, 0.4), "rainfall": (25, 5)},
    "Apple": {"N": (21, 5), "P": (134, 12), "K": (200, 15), "temp": (22, 3), "humidity": (92, 3), "ph": (5.9, 0.4), "rainfall": (113, 15)},
    "Orange": {"N": (20, 5), "P": (17, 4), "K": (10, 3), "temp": (23, 5), "humidity": (92, 3), "ph": (7.0, 0.4), "rainfall": (110, 14)},
    "Papaya": {"N": (50, 10), "P": (59, 8), "K": (50, 6), "temp": (34, 4), "humidity": (92, 4), "ph": (6.7, 0.4), "rainfall": (143, 20)},
    "Coconut": {"N": (22, 5), "P": (17, 4), "K": (30, 5), "temp": (27, 2), "humidity": (95, 3), "ph": (6.0, 0.4), "rainfall": (176, 25)},
    "Cotton": {"N": (118, 15), "P": (46, 8), "K": (20, 4), "temp": (24, 3), "humidity": (80, 6), "ph": (6.9, 0.6), "rainfall": (80, 12)},
    "Jute": {"N": (78, 12), "P": (46, 8), "K": (40, 6), "temp": (25, 2), "humidity": (80, 5), "ph": (6.7, 0.5), "rainfall": (175, 20)},
    "Coffee": {"N": (101, 12), "P": (29, 6), "K": (30, 5), "temp": (26, 3), "humidity": (59, 7), "ph": (6.8, 0.4), "rainfall": (158, 22)},
}

# Agronomic Metadata for recommendations
CROP_AGRONOMY = {
    "Rice": {"water_need": "High (1200-1500 mm)", "duration_days": "110-150 days", "season": "Kharif (Monsoon)", "soil_pref": "Clayey, heavy alluvial soil with standing water tolerance."},
    "Maize": {"water_need": "Moderate (500-800 mm)", "duration_days": "90-120 days", "season": "Kharif & Rabi", "soil_pref": "Well-drained deep loamy soil rich in organic matter."},
    "Chickpea": {"water_need": "Low (300-450 mm)", "duration_days": "90-110 days", "season": "Rabi (Winter)", "soil_pref": "Sandy loam to clay loam, drought resistant."},
    "Kidneybeans": {"water_need": "Moderate (400-600 mm)", "duration_days": "80-100 days", "season": "Kharif / Spring", "soil_pref": "Light well-drained loams, sensitive to waterlogging."},
    "Pigeonpeas": {"water_need": "Moderate (600-800 mm)", "duration_days": "150-180 days", "season": "Kharif", "soil_pref": "Deep permeable loams, deep taproot system."},
    "Mothbeans": {"water_need": "Very Low (250-400 mm)", "duration_days": "75-90 days", "season": "Kharif (Arid)", "soil_pref": "Light sandy to loamy soils, highly drought resilient."},
    "Mungbean": {"water_need": "Low (350-500 mm)", "duration_days": "65-75 days", "season": "Summer / Kharif", "soil_pref": "Loam to sandy loam with good internal drainage."},
    "Blackgram": {"water_need": "Low to Moderate (400-600 mm)", "duration_days": "70-90 days", "season": "Kharif", "soil_pref": "Heavy clay loam or black cotton soil."},
    "Lentil": {"water_need": "Low (300-450 mm)", "duration_days": "110-130 days", "season": "Rabi (Winter)", "soil_pref": "Alluvial, light loams to moderate clay soils."},
    "Pomegranate": {"water_need": "Moderate (600-900 mm)", "duration_days": "Perennial Orchard", "season": "Year-round", "soil_pref": "Deep loamy to gravelly soil with pH 6.0-7.5."},
    "Banana": {"water_need": "High (1500-2200 mm)", "duration_days": "11-13 months", "season": "Perennial", "soil_pref": "Rich fertile alluvial loam with high potassium."},
    "Mango": {"water_need": "Moderate (700-1100 mm)", "duration_days": "Perennial Orchard", "season": "Summer harvest", "soil_pref": "Deep alluvial and red loamy soil, good drainage."},
    "Grapes": {"water_need": "Moderate (500-750 mm)", "duration_days": "Perennial Vine", "season": "Spring harvest", "soil_pref": "Well-drained gravelly loam, sensitive to salinity."},
    "Watermelon": {"water_need": "Moderate (400-600 mm)", "duration_days": "80-100 days", "season": "Zaid (Summer)", "soil_pref": "Sandy loam, warms quickly in sunlight."},
    "Muskmelon": {"water_need": "Moderate (400-550 mm)", "duration_days": "75-90 days", "season": "Zaid (Summer)", "soil_pref": "Sandy to sandy loam, neutral to slightly alkaline."},
    "Apple": {"water_need": "Moderate (700-1000 mm)", "duration_days": "Perennial Orchard", "season": "Autumn harvest", "soil_pref": "Deep well-drained loam with chill requirement."},
    "Orange": {"water_need": "Moderate (800-1200 mm)", "duration_days": "Perennial Orchard", "season": "Winter / Spring", "soil_pref": "Light loamy to medium textured soil, no hardpan."},
    "Papaya": {"water_need": "High (1200-1600 mm)", "duration_days": "10-12 months", "season": "Perennial", "soil_pref": "Rich porous loam, zero tolerance for standing water."},
    "Coconut": {"water_need": "High (1300-2000 mm)", "duration_days": "Perennial Palm", "season": "Year-round", "soil_pref": "Coastal sandy loams, alluvial and red loams."},
    "Cotton": {"water_need": "Moderate to High (700-1100 mm)", "duration_days": "150-180 days", "season": "Kharif", "soil_pref": "Deep black cotton soil (Vertisols) with moisture retention."},
    "Jute": {"water_need": "High (1200-1600 mm)", "duration_days": "120-140 days", "season": "Early Kharif", "soil_pref": "Rich alluvial silt deposits along river basins."},
    "Coffee": {"water_need": "High (1400-2000 mm)", "duration_days": "Perennial Shade", "season": "Winter harvest", "soil_pref": "Fertile volcanic or humus-rich loam on slope terrain."},
}


def generate_synthetic_dataset(samples_per_crop: int = 150) -> pd.DataFrame:
    """Generates benchmark dataset based on agronomic distributions."""
    np.random.seed(42)
    records = []

    for crop, params in CROP_PROFILES.items():
        for _ in range(samples_per_crop):
            n = max(5, int(np.random.normal(params["N"][0], params["N"][1])))
            p = max(5, int(np.random.normal(params["P"][0], params["P"][1])))
            k = max(5, int(np.random.normal(params["K"][0], params["K"][1])))
            temp = float(np.round(np.clip(np.random.normal(params["temp"][0], params["temp"][1]), 8.0, 48.0), 2))
            humidity = float(np.round(np.clip(np.random.normal(params["humidity"][0], params["humidity"][1]), 10.0, 99.0), 1))
            ph = float(np.round(np.clip(np.random.normal(params["ph"][0], params["ph"][1]), 3.5, 9.5), 2))
            rainfall = float(np.round(np.clip(np.random.normal(params["rainfall"][0], params["rainfall"][1]), 10.0, 350.0), 1))

            records.append({
                "N": n,
                "P": p,
                "K": k,
                "temperature": temp,
                "humidity": humidity,
                "ph": ph,
                "rainfall": rainfall,
                "label": crop
            })

    return pd.DataFrame(records)


def train_crop_recommender():
    """Trains Random Forest Classifier pipeline and saves artifacts."""
    print("=" * 65)
    print("[*] Generating Agronomic Crop Dataset across 22 Crops...")
    df = generate_synthetic_dataset(samples_per_crop=150)
    print(f"[*] Total dataset size: {len(df)} samples across {df['label'].nunique()} classes.")

    feature_cols = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    X = df[feature_cols]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("[*] Training Random Forest Classification Pipeline...")
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", RandomForestClassifier(n_estimators=120, max_depth=16, random_state=42, n_jobs=-1))
    ])

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="macro")

    print("=" * 65)
    print(f"[+] Evaluation Results:")
    print(f"    - Accuracy:  {acc * 100:.2f}%")
    print(f"    - Macro-F1:  {f1 * 100:.2f}%")
    print("=" * 65)

    # Save trained model and metadata
    os.makedirs("ai_model/models", exist_ok=True)
    model_path = "ai_model/models/crop_recommender.joblib"
    joblib.dump(pipeline, model_path)
    print(f"[*] Serialized model to: {model_path}")

    meta_path = "ai_model/models/crop_agronomy.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(CROP_AGRONOMY, f, indent=2)
    print(f"[*] Saved agronomic metadata to: {meta_path}")
    print("=" * 65)


if __name__ == "__main__":
    train_crop_recommender()
