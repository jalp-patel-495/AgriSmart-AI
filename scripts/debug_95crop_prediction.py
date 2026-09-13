import sys, os
from pathlib import Path
import numpy as np
import pandas as pd
import joblib, json

BASE_DIR = Path("j:/AGRISMART_AI")
sys.path.insert(0, str(BASE_DIR))
MODEL_DIR = BASE_DIR / "models" / "crop_recommendation"
DATA_DIR  = BASE_DIR / "data"
TRAINING_FEATURE_ORDER = ["temperature", "rainfall", "humidity", "ph", "nitrogen", "phosphorus", "potassium"]

model   = joblib.load(MODEL_DIR / "best_model_95class.pkl")
scaler  = joblib.load(MODEL_DIR / "scaler_95class.pkl")
encoder = joblib.load(MODEL_DIR / "label_encoder_95class.pkl")

print("MODEL:", type(model).__name__)
print("ENCODER classes:", len(encoder.classes_))
print("SCALER n_features:", scaler.n_features_in_)
if hasattr(scaler, "feature_names_in_"):
    print("SCALER order:", list(scaler.feature_names_in_))
else:
    print("SCALER has no feature_names_in_")

df_train = pd.read_csv(DATA_DIR / "crop_training_data.csv")
catalog_df = pd.read_csv(DATA_DIR / "global_crops.csv")
profiles = {}
for _, row in catalog_df.iterrows():
    profiles[str(row["crop_name"]).lower()] = row.to_dict()

def predict_top5(n, p, k, temperature, humidity, ph, rainfall):
    vec = [n, p, k, temperature, humidity, ph, rainfall]
    ordered = [vec[3], vec[6], vec[4], vec[5], vec[0], vec[1], vec[2]]
    X = pd.DataFrame([ordered], columns=TRAINING_FEATURE_ORDER)
    X_s = scaler.transform(X)
    probs = model.predict_proba(X_s)[0]
    top5 = np.argsort(probs)[::-1][:5]
    return [(encoder.inverse_transform([i])[0], round(float(probs[i])*100, 2)) for i in top5]

def frontend_params(crop_name):
    p = profiles.get(crop_name.lower())
    if not p:
        return None
    tMid = (float(p.get("temperature_min_c") or 20) + float(p.get("temperature_max_c") or 30)) / 2
    rMid = (float(p.get("rainfall_min_mm") or 500) + float(p.get("rainfall_max_mm") or 1000)) / 2
    phMid = (float(p.get("ph_min") or 6.0) + float(p.get("ph_max") or 7.5)) / 2
    hPref = str(p.get("humidity_preference", "")).lower()
    hum = 80.0 if hPref == "high" else (40.0 if hPref == "low" else 65.0)
    cat = str(p.get("crop_category", "")).strip()
    sub = str(p.get("sub_category", "")).strip()
    if cat == "Pulse" or "Legume" in sub:
        n2, p2, k2 = 25, 50, 30
    elif cat == "Cereal":
        n2, p2, k2 = 100, 50, 40
    elif cat in ("Fruit", "Plantation"):
        n2, p2, k2 = 60, 40, 50
    elif cat == "Oilseed":
        n2, p2, k2 = 70, 35, 35
    else:
        n2, p2, k2 = 80, 45, 45
    return {"N": n2, "P": p2, "K": k2, "temp": round(tMid, 1),
            "hum": hum, "ph": round(phMid, 1), "rain": round(rMid, 0),
            "cat": cat, "hum_pref": hPref}

test_crops = ["Rice", "Wheat", "Mango", "Potato", "Tomato", "Apple", "Barley"]

print()
print("===== PART 1: FRONTEND PROFILE PARAMETERS =====")
for crop in test_crops:
    fp = frontend_params(crop)
    if not fp:
        print(f"\n[{crop}] Profile not found")
        continue
    top5 = predict_top5(fp["N"], fp["P"], fp["K"], fp["temp"], fp["hum"], fp["ph"], fp["rain"])
    cat_info = fp["cat"]
    hum_info = fp["hum_pref"]
    print(f"\n[{crop}] cat={cat_info} hum_pref={hum_info}")
    print(f"  Input: N={fp['N']}, P={fp['P']}, K={fp['K']}, T={fp['temp']}, Hum={fp['hum']}, pH={fp['ph']}, Rain={fp['rain']}")
    for i, (c, prob) in enumerate(top5):
        mark = " <<< MATCH" if c.lower() == crop.lower() else ""
        print(f"  #{i+1}: {c} = {prob:.2f}%{mark}")

print()
print("===== PART 2: ACTUAL TRAINING SAMPLES =====")
for crop in test_crops:
    subset = df_train[df_train["recommended_crop"].str.lower() == crop.lower()]
    if len(subset) == 0:
        print(f"\n[{crop}] No training samples found")
        continue
    correct = 0
    for _, row in subset.iterrows():
        t5 = predict_top5(row["nitrogen"], row["phosphorus"], row["potassium"],
                          row["temperature"], row["humidity"], row["ph"], row["rainfall"])
        if t5[0][0].lower() == crop.lower():
            correct += 1
    sample = subset.iloc[0]
    t5 = predict_top5(sample["nitrogen"], sample["phosphorus"], sample["potassium"],
                      sample["temperature"], sample["humidity"], sample["ph"], sample["rainfall"])
    pct = 100 * correct / len(subset)
    print(f"\n[{crop}] Accuracy on all {len(subset)} samples: {correct}/{len(subset)} ({pct:.1f}%)")
    print(f"  Sample top3: {[(c, p) for c, p in t5[:3]]}")

print()
print("===== PART 3: LABEL ENCODER CHECK =====")
for crop in ["Rice", "Wheat", "Mango", "Potato", "Tomato"]:
    found = [c for c in encoder.classes_ if c.lower() == crop.lower()]
    if found:
        idx = encoder.transform([found[0]])[0]
        decoded = encoder.inverse_transform([idx])[0]
        ok = decoded.lower() == crop.lower()
        print(f"  {crop} -> idx={idx} -> decoded={decoded} -> OK={ok}")
    else:
        print(f"  {crop} -> NOT IN ENCODER")

print()
print("===== PART 4: WHAT FEATURES OVERLAP CAUSE FALSE MANGO PREDICTIONS =====")
print("Rice vs Mango training feature comparison:")
for crop in ["Rice", "Mango"]:
    sub = df_train[df_train["recommended_crop"].str.lower() == crop.lower()]
    print(f"  {crop}: temp={sub['temperature'].mean():.1f}, rain={sub['rainfall'].mean():.0f}, "
          f"hum={sub['humidity'].mean():.1f}, ph={sub['ph'].mean():.2f}")

print()
print("DONE")
