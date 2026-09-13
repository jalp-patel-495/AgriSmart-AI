"""
AgriSmart AI – 19-Class Dataset Setup Script
Organizes dataset into:
1. dataset/disease/<Crop>/<Class>/ hierarchy
2. dataset/raw/<Class>/ flat hierarchy
Uses OS hardlinks for instantaneous zero-copy population.
"""
import os
import shutil
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PV_CACHE = PROJECT_ROOT / "dataset" / ".plantvillage_cache" / "raw" / "color"
DATASET_RAW = PROJECT_ROOT / "dataset" / "raw"
DATASET_DISEASE = PROJECT_ROOT / "dataset" / "disease"

# 6 New Classes mapping from PlantVillage cache
NEW_CLASSES = {
    "Grape": [
        ("Grape___Black_rot", "Grape_Black_Rot"),
        ("Grape___healthy", "Grape_Healthy")
    ],
    "Bell_Pepper": [
        ("Pepper,_bell___Bacterial_spot", "Bell_Pepper_Bacterial_Spot"),
        ("Pepper,_bell___healthy", "Bell_Pepper_Healthy")
    ],
    "Peach": [
        ("Peach___Bacterial_spot", "Peach_Bacterial_Spot"),
        ("Peach___healthy", "Peach_Healthy")
    ]
}

# 13 Existing Classes in dataset/raw
EXISTING_CLASSES = {
    "Apple": [
        "Apple___Apple_scab",
        "Apple___Black_rot",
        "Apple___healthy"
    ],
    "Corn": [
        "Corn___Common_rust",
        "Corn___Northern_Leaf_Blight",
        "Corn___healthy"
    ],
    "Potato": [
        "Potato___Early_blight",
        "Potato___Late_blight",
        "Potato___healthy"
    ],
    "Tomato": [
        "Tomato___Bacterial_spot",
        "Tomato___Early_blight",
        "Tomato___Late_blight",
        "Tomato___healthy"
    ]
}


def link_or_copy(src: Path, dst: Path):
    if dst.exists():
        return
    try:
        os.link(str(src), str(dst))
    except Exception:
        shutil.copy2(str(src), str(dst))


def main():
    print("[*] Setting up 19-class dataset...")
    DATASET_DISEASE.mkdir(parents=True, exist_ok=True)
    DATASET_RAW.mkdir(parents=True, exist_ok=True)

    # 1. Populate dataset/disease/ for existing crops
    for crop, classes in EXISTING_CLASSES.items():
        crop_dir = DATASET_DISEASE / crop
        crop_dir.mkdir(parents=True, exist_ok=True)
        for cname in classes:
            raw_class_dir = DATASET_RAW / cname
            disease_class_dir = crop_dir / cname
            disease_class_dir.mkdir(parents=True, exist_ok=True)
            if raw_class_dir.exists():
                count = 0
                for img_f in raw_class_dir.glob("*.*"):
                    if img_f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                        link_or_copy(img_f, disease_class_dir / img_f.name)
                        count += 1
                print(f"    [Existing] {crop}/{cname}: {count} images")

    # 2. Populate new classes into dataset/disease/ and dataset/raw/
    for crop, pairs in NEW_CLASSES.items():
        crop_dir = DATASET_DISEASE / crop
        crop_dir.mkdir(parents=True, exist_ok=True)
        for pv_src_name, target_name in pairs:
            pv_src_dir = PV_CACHE / pv_src_name
            if not pv_src_dir.exists():
                print(f"[!] Warning: PlantVillage source not found: {pv_src_dir}")
                continue

            raw_target_dir = DATASET_RAW / target_name
            raw_target_dir.mkdir(parents=True, exist_ok=True)

            disease_target_dir = crop_dir / target_name
            disease_target_dir.mkdir(parents=True, exist_ok=True)

            count = 0
            for img_f in pv_src_dir.glob("*.*"):
                if img_f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                    link_or_copy(img_f, raw_target_dir / img_f.name)
                    link_or_copy(img_f, disease_target_dir / img_f.name)
                    count += 1
            print(f"    [New] {crop}/{target_name} (from {pv_src_name}): {count} images")

    # Summary
    raw_subdirs = sorted([d.name for d in DATASET_RAW.iterdir() if d.is_dir()])
    print(f"\n[OK] Total classes in dataset/raw: {len(raw_subdirs)}")
    for d in raw_subdirs:
        imgs = len(list((DATASET_RAW / d).glob("*.*")))
        print(f"  - {d}: {imgs} images")


if __name__ == "__main__":
    main()
