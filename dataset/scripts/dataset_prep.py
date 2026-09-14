"""
AgriSmart AI – Dataset Preprocessing, Validation & Augmentation Pipeline
Technologies: Python, OpenCV, Pandas, NumPy, Albumentations

Functions:
1. Ingests raw images and validates image integrity using OpenCV.
2. Catalogs metadata and manifests using Pandas.
3. Generates stratified Train (70%), Validation (15%), and Test (15%) partitions.
4. Resizes and standardizes images (224x224 RGB).
5. Applies Albumentations transformations (rotations, flips, color jitter, noise).
6. Exports CSV manifests and summary statistics for model training.
"""

import argparse
import json
import os
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np
import pandas as pd
from tqdm import tqdm
import albumentations as A

# Setup directory paths
SCRIPT_DIR = Path(__file__).resolve().parent
DATASET_DIR = SCRIPT_DIR.parent
RAW_DIR = DATASET_DIR / "raw"
PROCESSED_DIR = DATASET_DIR / "processed"
SPLITS_DIR = DATASET_DIR / "splits"
CLASSES_FILE = DATASET_DIR / "classes.json"


def load_class_mappings() -> Tuple[Dict[str, int], Dict[str, dict]]:
    """Loads class definitions from classes.json."""
    if not CLASSES_FILE.exists():
        raise FileNotFoundError(f"Classes configuration file not found at: {CLASSES_FILE}")
        
    with open(CLASSES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    name_to_id = {}
    class_details = {}
    for item in data["classes"]:
        name_to_id[item["name"]] = item["id"]
        class_details[item["name"]] = item
        
    return name_to_id, class_details


def get_training_augmentation_pipeline(target_size: int = 224) -> A.Compose:
    """Builds an Albumentations augmentation pipeline simulating agricultural field conditions."""
    return A.Compose([
        A.Resize(target_size, target_size, interpolation=cv2.INTER_CUBIC),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.3),
        A.RandomRotate90(p=0.5),
        A.Affine(
            scale=(0.9, 1.1),
            translate_percent=(-0.06, 0.06),
            rotate=(-30, 30),
            border_mode=cv2.BORDER_REFLECT,
            p=0.5
        ),
        A.ColorJitter(
            brightness=0.15,
            contrast=0.15,
            saturation=0.15,
            hue=0.08,
            p=0.5
        ),
        A.GaussNoise(p=0.3),
    ])


def get_validation_pipeline(target_size: int = 224) -> A.Compose:
    """Standard resize pipeline for validation and testing."""
    return A.Compose([
        A.Resize(target_size, target_size, interpolation=cv2.INTER_AREA)
    ])


def _validate_image_file(item):
    img_path, class_name, class_id, crop, disease, status = item
    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None or img_bgr.size == 0:
        return None
    h, w, c = img_bgr.shape
    if c != 3:
        return None
    return {
        "raw_path": str(img_path),
        "filename": img_path.name,
        "class_name": class_name,
        "class_id": class_id,
        "crop": crop,
        "disease": disease,
        "status": status,
        "orig_width": w,
        "orig_height": h,
        "file_size_kb": round(img_path.stat().st_size / 1024, 2)
    }


def scan_and_validate_raw_data(name_to_id: Dict[str, int], class_details: Dict[str, dict]) -> pd.DataFrame:
    """
    Scans RAW_DIR, validates each image using OpenCV in parallel (16 threads),
    and constructs a Pandas DataFrame of all valid samples.
    """
    import concurrent.futures
    supported_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    
    if not RAW_DIR.exists():
        raise FileNotFoundError(f"Raw directory does not exist: {RAW_DIR}")
        
    class_folders = sorted([f for f in RAW_DIR.iterdir() if f.is_dir()])
    print(f"[*] Found {len(class_folders)} class directories in raw folder.")
    
    items_to_validate = []
    for folder in class_folders:
        class_name = folder.name
        if class_name in name_to_id:
            class_id = name_to_id[class_name]
            info = class_details[class_name]
            crop = info.get("crop", "Unknown")
            disease = info.get("disease", "Unknown")
            status = info.get("status", "Unknown")
        else:
            class_id = len(name_to_id)
            crop = class_name.split("___")[0] if "___" in class_name else "Unknown"
            disease = class_name.split("___")[1] if "___" in class_name else class_name
            status = "Healthy" if "healthy" in class_name.lower() else "Diseased"

        image_files = [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in supported_extensions]
        for img_path in image_files:
            items_to_validate.append((img_path, class_name, class_id, crop, disease, status))
            
    print(f"[*] Validating {len(items_to_validate)} raw images using OpenCV across 16 threads...")
    records = []
    corrupted_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        for res in tqdm(executor.map(_validate_image_file, items_to_validate, chunksize=100), total=len(items_to_validate), desc="OpenCV Validation"):
            if res is not None:
                records.append(res)
            else:
                corrupted_count += 1
                
    df = pd.DataFrame(records)
    print(f"[*] Validation finished: {len(df)} valid images cataloged ({corrupted_count} corrupted skipped).")
    return df


def create_stratified_splits(df: pd.DataFrame, train_ratio=0.70, val_ratio=0.15, seed=42) -> pd.DataFrame:
    """
    Performs stratified Train/Validation/Test splitting per class using Pandas & NumPy.
    """
    np.random.seed(seed)
    df = df.copy()
    df["split"] = ""
    
    for class_id, group in df.groupby("class_id"):
        indices = group.index.to_numpy()
        np.random.shuffle(indices)
        
        n_total = len(indices)
        n_train = max(1, int(n_total * train_ratio))
        n_val = max(1, int(n_total * val_ratio))
        
        # Ensure test has at least 1 sample if total >= 3
        if n_total >= 3 and (n_train + n_val >= n_total):
            n_train = n_total - 2
            n_val = 1
            
        train_idx = indices[:n_train]
        val_idx = indices[n_train:n_train + n_val]
        test_idx = indices[n_train + n_val:]
        
        # If dataset per class is very small (1 or 2 items), allocate fairly
        if len(test_idx) == 0 and len(val_idx) > 1:
            test_idx = val_idx[-1:]
            val_idx = val_idx[:-1]
            
        df.loc[train_idx, "split"] = "train"
        df.loc[val_idx, "split"] = "val"
        df.loc[test_idx, "split"] = "test"
        
    return df


def process_single_image(row_tuple, target_size, processed_dir, dataset_dir):
    """Worker function to resize and standardize a single image to 224x224 RGB."""
    idx, row = row_tuple
    raw_path = row["raw_path"]
    split = row["split"]
    class_name = row["class_name"]
    filename = row["filename"]
    
    dest_dir = processed_dir / split / class_name
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename
    
    # Fast OpenCV read and resize to standardized 224x224
    img_bgr = cv2.imread(raw_path)
    if img_bgr is None:
        return None
        
    resized_bgr = cv2.resize(img_bgr, (target_size, target_size), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(dest_path), resized_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
    
    row_dict = row.to_dict()
    row_dict["processed_path"] = str(dest_path.relative_to(dataset_dir))
    row_dict["target_width"] = target_size
    row_dict["target_height"] = target_size
    return row_dict


def process_and_save_images(
    df: pd.DataFrame,
    target_size: int = 224
) -> pd.DataFrame:
    """
    Standardizes all images to 224x224 RGB across train, val, and test partitions.
    Note: Dynamic Albumentations augmentations are applied on-the-fly during PyTorch DataLoader training,
    ensuring fresh variations every epoch while keeping validation/test data unaugmented.
    """
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    processed_records = []
    
    print(f"[*] Standardizing {len(df)} images to {target_size}x{target_size} across splits...")
    import concurrent.futures
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        futures = [
            executor.submit(process_single_image, (idx, row), target_size, PROCESSED_DIR, DATASET_DIR)
            for idx, row in df.iterrows()
        ]
        for f in tqdm(concurrent.futures.as_completed(futures), total=len(futures), desc="Standardizing images"):
            res = f.result()
            if res is not None:
                processed_records.append(res)
                
    return pd.DataFrame(processed_records)


def export_splits_and_summary(df_processed: pd.DataFrame):
    """
    Exports train.csv, val.csv, test.csv, summary.json, and dataset_distribution_report.txt.
    """
    SPLITS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR = DATASET_DIR.parent / "reports"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    
    train_df = df_processed[df_processed["split"] == "train"]
    val_df = df_processed[df_processed["split"] == "val"]
    test_df = df_processed[df_processed["split"] == "test"]
    
    train_csv = SPLITS_DIR / "train.csv"
    val_csv = SPLITS_DIR / "val.csv"
    test_csv = SPLITS_DIR / "test.csv"
    
    train_df.to_csv(train_csv, index=False)
    val_df.to_csv(val_csv, index=False)
    test_df.to_csv(test_csv, index=False)
    
    # Generate summary metrics
    classes_count = int(df_processed["class_id"].nunique())
    crops_count = int(df_processed["crop"].nunique())
    
    summary = {
        "total_images": len(df_processed),
        "target_dimensions": f"{df_processed['target_width'].iloc[0]}x{df_processed['target_height'].iloc[0]}",
        "split_distribution": {
            "train": len(train_df),
            "val": len(val_df),
            "test": len(test_df)
        },
        "classes_count": classes_count,
        "crops_count": crops_count,
        "class_breakdown": {},
        "crop_breakdown": {}
    }
    
    for class_name, grp in df_processed.groupby("class_name"):
        summary["class_breakdown"][class_name] = {
            "class_id": int(grp["class_id"].iloc[0]),
            "crop": grp["crop"].iloc[0],
            "status": grp["status"].iloc[0],
            "train_count": int((grp["split"] == "train").sum()),
            "val_count": int((grp["split"] == "val").sum()),
            "test_count": int((grp["split"] == "test").sum()),
            "total": len(grp)
        }

    for crop, grp in df_processed.groupby("crop"):
        summary["crop_breakdown"][crop] = {
            "train_count": int((grp["split"] == "train").sum()),
            "val_count": int((grp["split"] == "val").sum()),
            "test_count": int((grp["split"] == "test").sum()),
            "total": len(grp)
        }
        
    summary_file = SPLITS_DIR / "summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
        
    # Generate readable text report
    report_text_path = REPORTS_DIR / "dataset_distribution_report.txt"
    lines = [
        "=" * 75,
        "AgriSmart AI – PlantVillage Full Dataset Validation & Distribution Report",
        "=" * 75,
        f"Total Valid Images       : {len(df_processed)}",
        f"Number of Crops          : {crops_count}",
        f"Number of Classes        : {classes_count}",
        f"Train Partition (70%)    : {len(train_df)} ({len(train_df)/len(df_processed)*100:.2f}%)",
        f"Validation Partition (15%): {len(val_df)} ({len(val_df)/len(df_processed)*100:.2f}%)",
        f"Test Partition (15%)     : {len(test_df)} ({len(test_df)/len(df_processed)*100:.2f}%)",
        "=" * 75,
        "\nDISTRIBUTION PER CROP:",
        "-" * 55,
        f"{'Crop':<25} {'Train':<8} {'Val':<8} {'Test':<8} {'Total':<8}",
        "-" * 55
    ]
    for crop, cinfo in sorted(summary["crop_breakdown"].items()):
        lines.append(f"{crop:<25} {cinfo['train_count']:<8} {cinfo['val_count']:<8} {cinfo['test_count']:<8} {cinfo['total']:<8}")
        
    lines.extend([
        "-" * 55,
        "\nDISTRIBUTION PER CLASS (38 CANONICAL CLASSES):",
        "-" * 75,
        f"{'Class Name':<50} {'Train':<7} {'Val':<7} {'Test':<7} {'Total':<7}",
        "-" * 75
    ])
    for cname, cinfo in sorted(summary["class_breakdown"].items()):
        lines.append(f"{cname:<50} {cinfo['train_count']:<7} {cinfo['val_count']:<7} {cinfo['test_count']:<7} {cinfo['total']:<7}")
    lines.append("=" * 75)
    
    with open(report_text_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print("\n" + "=" * 65)
    print("AGRISmart AI – Dataset Preprocessing Completed Successfully")
    print("=" * 65)
    print(f"Total processed samples : {len(df_processed)}")
    print(f"Number of Classes       : {classes_count}")
    print(f"Number of Crops         : {crops_count}")
    print(f"Train samples (70%)     : {len(train_df)} ({len(train_df)/len(df_processed)*100:.2f}%)")
    print(f"Validation samples (15%): {len(val_df)} ({len(val_df)/len(df_processed)*100:.2f}%)")
    print(f"Test samples (15%)      : {len(test_df)} ({len(test_df)/len(df_processed)*100:.2f}%)")
    print(f"Manifests saved to      : {SPLITS_DIR}")
    print(f"Summary JSON saved to   : {summary_file}")
    print(f"Distribution Report     : {report_text_path}")
    print("=" * 65 + "\n")


def main():
    parser = argparse.ArgumentParser(description="AgriSmart AI Dataset Preprocessing Pipeline")
    parser.add_argument("--img-size", type=int, default=224, help="Target image size (e.g. 224)")
    args = parser.parse_args()
    
    name_to_id, class_details = load_class_mappings()
    raw_df = scan_and_validate_raw_data(name_to_id, class_details)
    
    if len(raw_df) == 0:
        print("[!] No valid raw images found in dataset/raw/.")
        return
        
    split_df = create_stratified_splits(raw_df, train_ratio=0.70, val_ratio=0.15)
    processed_df = process_and_save_images(split_df, target_size=args.img_size)
    export_splits_and_summary(processed_df)


if __name__ == "__main__":
    main()
