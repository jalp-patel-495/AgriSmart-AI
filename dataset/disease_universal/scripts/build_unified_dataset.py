"""
AgriSmart AI - Unified Dataset Ingestion, Class Harmonization & Stratified Splitter
Builds:
- dataset/disease_universal/unified/train
- dataset/disease_universal/unified/val
- dataset/disease_universal/unified/test
- dataset/disease_universal/unified/field_benchmark
- dataset/disease_universal/metadata/coverage_report.json

Rules:
1. One canonical mapping throughout: dataset -> training -> checkpoint -> inference -> backend -> frontend.
2. Independent field data (PlantDoc field images & FieldPV) kept separate in field_benchmark/ to evaluate real-world robustness.
3. Stratified train/val/test splits (70% train, 15% val, 15% test) with fixed deterministic seed (seed=42).
4. Actual verifiable image counts per crop and disease without fabrication.
"""
import os
import shutil
import json
import random
from pathlib import Path
from typing import Dict, List, Tuple

# Mapping from PlantDoc folder names to canonical class IDs
PLANTDOC_MAPPING = {
    "Apple Scab Leaf": "apple_scab",
    "Apple rust leaf": "apple_cedar_apple_rust",
    "Apple leaf": "apple_healthy",
    "Bell_pepper leaf spot": "bell_pepper_bacterial_spot",
    "Bell_pepper leaf": "bell_pepper_healthy",
    "Blueberry leaf": "blueberry_healthy",
    "Cherry leaf": "cherry_healthy",
    "Corn Gray leaf spot": "corn_cercospora_leaf_spot",
    "Corn leaf blight": "corn_northern_leaf_blight",
    "Corn rust leaf": "corn_common_rust",
    "grape leaf black rot": "grape_black_rot",
    "grape leaf": "grape_healthy",
    "Peach leaf": "peach_healthy",
    "Potato leaf early blight": "potato_early_blight",
    "Potato leaf late blight": "potato_late_blight",
    "Raspberry leaf": "raspberry_healthy",
    "Soyabean leaf": "soybean_healthy",
    "Squash Powdery mildew leaf": "squash_powdery_mildew",
    "Strawberry leaf": "strawberry_healthy",
    "Tomato leaf bacterial spot": "tomato_bacterial_spot",
    "Tomato Early blight leaf": "tomato_early_blight",
    "Tomato leaf late blight": "tomato_late_blight",
    "Tomato mold leaf": "tomato_leaf_mold",
    "Tomato Septoria leaf spot": "tomato_septoria_leaf_spot",
    "Tomato two spotted spider mites leaf": "tomato_spider_mites",
    "Tomato leaf yellow virus": "tomato_yellow_leaf_curl_virus",
    "Tomato leaf mosaic virus": "tomato_mosaic_virus",
    "Tomato leaf": "tomato_healthy"
}

# Mapping from PlantVillage folder names to canonical class IDs
PLANTVILLAGE_MAPPING = {
    "Apple___Apple_scab": "apple_scab",
    "Apple___Black_rot": "apple_black_rot",
    "Apple___Cedar_apple_rust": "apple_cedar_apple_rust",
    "Apple___healthy": "apple_healthy",
    "Blueberry___healthy": "blueberry_healthy",
    "Cherry_(including_sour)___Powdery_mildew": "cherry_powdery_mildew",
    "Cherry_(including_sour)___healthy": "cherry_healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "corn_cercospora_leaf_spot",
    "Corn_(maize)___Common_rust_": "corn_common_rust",
    "Corn_(maize)___Northern_Leaf_Blight": "corn_northern_leaf_blight",
    "Corn_(maize)___healthy": "corn_healthy",
    "Grape___Black_rot": "grape_black_rot",
    "Grape___Esca_(Black_Measles)": "grape_esca_black_measles",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "grape_leaf_blight",
    "Grape___healthy": "grape_healthy",
    "Orange___Haunglongbing_(Citrus_greening)": "orange_citrus_greening",
    "Peach___Bacterial_spot": "peach_bacterial_spot",
    "Peach___healthy": "peach_healthy",
    "Pepper,_bell___Bacterial_spot": "bell_pepper_bacterial_spot",
    "Pepper,_bell___healthy": "bell_pepper_healthy",
    "Potato___Early_blight": "potato_early_blight",
    "Potato___Late_blight": "potato_late_blight",
    "Potato___healthy": "potato_healthy",
    "Raspberry___healthy": "raspberry_healthy",
    "Soybean___healthy": "soybean_healthy",
    "Squash___Powdery_mildew": "squash_powdery_mildew",
    "Strawberry___Leaf_scorch": "strawberry_leaf_scorch",
    "Strawberry___healthy": "strawberry_healthy",
    "Tomato___Bacterial_spot": "tomato_bacterial_spot",
    "Tomato___Early_blight": "tomato_early_blight",
    "Tomato___Late_blight": "tomato_late_blight",
    "Tomato___Leaf_Mold": "tomato_leaf_mold",
    "Tomato___Septoria_leaf_spot": "tomato_septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite": "tomato_spider_mites",
    "Tomato___Target_Spot": "tomato_target_spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "tomato_yellow_leaf_curl_virus",
    "Tomato___Tomato_mosaic_virus": "tomato_mosaic_virus",
    "Tomato___healthy": "tomato_healthy"
}

def build_unified():
    root = Path(__file__).resolve().parents[3]
    ds_root = root / "dataset" / "disease_universal"
    unified_dir = ds_root / "unified"
    meta_dir = ds_root / "metadata"

    train_dir = unified_dir / "train"
    val_dir = unified_dir / "val"
    test_dir = unified_dir / "test"
    field_bench_dir = unified_dir / "field_benchmark"

    for d in [train_dir, val_dir, test_dir, field_bench_dir, meta_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Load canonical class registry
    with open(ds_root / "class_registry.json", "r", encoding="utf-8") as f:
        registry_data = json.load(f)
    classes_info = registry_data["classes"]
    id_to_class = {c["canonical_class_id"]: c for c in classes_info}

    # Collect images from all valid local sources
    # 1. PlantDoc (Field / In-the-wild)
    plantdoc_images = ds_root / "plantdoc" / "images"
    field_samples_by_class = {}
    if plantdoc_images.exists():
        for sub in plantdoc_images.iterdir():
            if sub.is_dir() and sub.name in PLANTDOC_MAPPING:
                cid = PLANTDOC_MAPPING[sub.name]
                field_samples_by_class.setdefault(cid, [])
                for f in sub.iterdir():
                    if f.is_file() and f.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
                        field_samples_by_class[cid].append(str(f))

    # 2. PlantVillage (Lab / Controlled)
    pv_images = ds_root / "plantvillage" / "repo" / "raw" / "color"
    lab_samples_by_class = {}
    if pv_images.exists():
        for sub in pv_images.iterdir():
            if sub.is_dir() and sub.name in PLANTVILLAGE_MAPPING:
                cid = PLANTVILLAGE_MAPPING[sub.name]
                lab_samples_by_class.setdefault(cid, [])
                for f in sub.iterdir():
                    if f.is_file() and f.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
                        lab_samples_by_class[cid].append(str(f))

    # 3. Existing processed dataset in dataset/processed/
    proc_train = root / "dataset" / "processed" / "train"
    if proc_train.exists():
        for sub in proc_train.iterdir():
            if sub.is_dir():
                clean_name = sub.name
                if clean_name in PLANTVILLAGE_MAPPING:
                    cid = PLANTVILLAGE_MAPPING[clean_name]
                    lab_samples_by_class.setdefault(cid, [])
                    for f in sub.iterdir():
                        if f.is_file() and f.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
                            lab_samples_by_class[cid].append(str(f))

    print(f"[*] Found PlantDoc field classes: {len(field_samples_by_class)} with {sum(len(v) for v in field_samples_by_class.values())} images")
    print(f"[*] Found PlantVillage lab classes: {len(lab_samples_by_class)} with {sum(len(v) for v in lab_samples_by_class.values())} images")

    # Combine and allocate:
    # 50% of field images go to field_benchmark/ (strictly independent test set)
    # 50% of field images + lab images go into train/val/test splits to instill field robustness
    random.seed(42)

    total_train = 0
    total_val = 0
    total_test = 0
    total_field_bench = 0
    class_counts = {}

    all_canonical_ids = sorted(list(set(list(field_samples_by_class.keys()) + list(lab_samples_by_class.keys()))))

    for cid in all_canonical_ids:
        field_imgs = field_samples_by_class.get(cid, [])
        lab_imgs = lab_samples_by_class.get(cid, [])

        random.shuffle(field_imgs)
        random.shuffle(lab_imgs)

        # Split field images: 50% field benchmark, 50% mixed training
        split_pt = len(field_imgs) // 2
        field_eval = field_imgs[:split_pt]
        field_train = field_imgs[split_pt:]

        # Save to field_benchmark
        fb_class_dir = field_bench_dir / cid
        fb_class_dir.mkdir(parents=True, exist_ok=True)
        for src in field_eval:
            shutil.copy2(src, fb_class_dir / f"field_{Path(src).name}")
            total_field_bench += 1

        # Combine lab + field_train for model training pool
        train_pool = lab_imgs + field_train
        random.shuffle(train_pool)

        n = len(train_pool)
        n_train = int(n * 0.70)
        n_val = int(n * 0.15)

        train_files = train_pool[:n_train]
        val_files = train_pool[n_train:n_train + n_val]
        test_files = train_pool[n_train + n_val:]

        for subset, split_dir in [(train_files, train_dir), (val_files, val_dir), (test_files, test_dir)]:
            s_class_dir = split_dir / cid
            s_class_dir.mkdir(parents=True, exist_ok=True)
            for src in subset:
                shutil.copy2(src, s_class_dir / Path(src).name)

        total_train += len(train_files)
        total_val += len(val_files)
        total_test += len(test_files)
        class_counts[cid] = {
            "train": len(train_files),
            "val": len(val_files),
            "test": len(test_files),
            "field_benchmark": len(field_eval),
            "total": n + len(field_eval)
        }

    print(f"\n==================================================")
    print(f"[SUMMARY] Unified Dataset Created across {len(class_counts)} classes:")
    print(f" - Train samples: {total_train}")
    print(f" - Validation samples: {total_val}")
    print(f" - Test samples: {total_test}")
    print(f" - Independent Field Benchmark: {total_field_bench}")
    print(f" - Grand Total Images: {total_train + total_val + total_test + total_field_bench}")
    print(f"==================================================")

    # Generate 14-plant coverage report
    crops_14 = [
        "Apple", "Blueberry", "Cherry", "Corn", "Grape", "Orange", "Peach",
        "Bell Pepper", "Potato", "Raspberry", "Soybean", "Squash", "Strawberry", "Tomato"
    ]
    crop_coverage = {}
    for c in classes_info:
        crop = c["crop"]
        cid = c["canonical_class_id"]
        crop_coverage.setdefault(crop, {"healthy": [], "diseases": [], "sources": set(), "images": 0})
        cnt = class_counts.get(cid, {}).get("total", 0)
        crop_coverage[crop]["images"] += cnt
        if cnt > 0:
            crop_coverage[crop]["sources"].add("PlantVillage" if cid in lab_samples_by_class else "PlantDoc")
        if c["healthy"]:
            crop_coverage[crop]["healthy"].append(c["disease"])
        else:
            crop_coverage[crop]["diseases"].append(c["disease"])

    coverage_table = []
    for crop in crops_14:
        info = crop_coverage.get(crop, {"healthy": [], "diseases": [], "sources": set(), "images": 0})
        coverage_table.append({
            "crop": crop,
            "healthy": ", ".join(info["healthy"]) if info["healthy"] else "None",
            "diseases": ", ".join(info["diseases"]) if info["diseases"] else "None (Healthy Only)",
            "sources": ", ".join(sorted(list(info["sources"]))) if info["sources"] else "PlantVillage / PlantDoc",
            "image_count": info["images"]
        })

    report = {
        "dataset_name": "AgriSmart AI Disease Universal Dataset",
        "splits": {
            "train": total_train,
            "val": total_val,
            "test": total_test,
            "field_benchmark": total_field_bench,
            "total": total_train + total_val + total_test + total_field_bench
        },
        "class_counts": class_counts,
        "crop_coverage_table": coverage_table
    }

    with open(meta_dir / "coverage_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report

if __name__ == "__main__":
    build_unified()
