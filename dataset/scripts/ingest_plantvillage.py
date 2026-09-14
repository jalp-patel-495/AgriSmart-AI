"""
AgriSmart AI – PlantVillage Dataset Ingestion Pipeline
Source: https://github.com/spMohanty/PlantVillage-Dataset

Features:
1. Performs a shallow, blob-filtered sparse clone of the spMohanty/PlantVillage-Dataset
   repository to fetch ONLY `raw/color` images (saving ~70% bandwidth and disk space).
2. Maps PlantVillage class folders to AgriSmart AI canonical naming conventions.
3. Copies real leaf disease images into `dataset/raw/<class_name>/`.
4. Supports `--mode core` (13 canonical classes, ~15k images) or `--mode all` (38 classes).
5. Provides a `--max-per-class` option for rapid testing and balanced dataset generation.
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict

# Root paths
SCRIPT_DIR = Path(__file__).resolve().parent
DATASET_DIR = SCRIPT_DIR.parent
RAW_DIR = DATASET_DIR / "raw"
DEFAULT_STAGING_DIR = DATASET_DIR / ".plantvillage_cache"

REPO_URL = "https://github.com/spMohanty/PlantVillage-Dataset.git"

# 38 Canonical PlantVillage original class folder names (spMohanty/PlantVillage-Dataset)
ORIGINAL_PLANTVILLAGE_38_CLASSES: list = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy"
]

# Preserve exact original PlantVillage folder structure without renaming
ALL_CLASS_MAPPING: Dict[str, str] = {c: c for c in ORIGINAL_PLANTVILLAGE_38_CLASSES}



def run_cmd(cmd: list, cwd: Path = None) -> None:
    """Executes a shell command and checks return code."""
    print(f"[CMD] {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {result.returncode}: {' '.join(cmd)}")


def clone_plantvillage_sparse(staging_dir: Path) -> Path:
    """
    Performs a shallow sparse checkout of only the raw/color directory
    from spMohanty/PlantVillage-Dataset.
    """
    color_dir = staging_dir / "raw" / "color"
    if color_dir.exists() and any(color_dir.iterdir()):
        print(f"[*] Found cached PlantVillage color images at: {color_dir}")
        return color_dir

    print(f"[*] Initializing Git sparse checkout of PlantVillage dataset into {staging_dir}...")
    staging_dir.parent.mkdir(parents=True, exist_ok=True)

    if not (staging_dir / ".git").exists():
        # Clone with core.longpaths enabled for Windows compatibility
        run_cmd([
            "git",
            "-c", "core.longpaths=true",
            "clone",
            "--depth", "1",
            "--filter=blob:none",
            "--sparse",
            REPO_URL,
            str(staging_dir)
        ])
    
    # Configure sparse-checkout to checkout only raw/color
    print("[*] Configuring sparse-checkout to download raw/color...")
    run_cmd(["git", "-c", "core.longpaths=true", "sparse-checkout", "set", "raw/color"], cwd=staging_dir)

    if not color_dir.exists():
        raise RuntimeError(f"Expected directory {color_dir} not found after sparse-checkout.")

    print(f"[OK] Successfully fetched PlantVillage color images into {color_dir}")
    return color_dir


def ingest_classes(
    source_color_dir: Path,
    mapping: Dict[str, str],
    max_per_class: int = None,
    backup_existing: bool = True
) -> Dict[str, int]:
    """
    Ingests and maps images from the source PlantVillage directory to dataset/raw/.
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    summary_counts = {}

    for pv_folder_name, dest_class_name in mapping.items():
        src_folder = source_color_dir / pv_folder_name
        dest_folder = RAW_DIR / dest_class_name

        if not src_folder.exists():
            print(f"[WARN] Source folder '{pv_folder_name}' not found in PlantVillage. Skipping.")
            continue

        # Collect source image files
        valid_extensions = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
        src_images = [f for f in src_folder.iterdir() if f.is_file() and f.suffix in valid_extensions]

        if not src_images:
            print(f"[WARN] No valid images in '{pv_folder_name}'. Skipping.")
            continue

        if max_per_class and len(src_images) > max_per_class:
            src_images = src_images[:max_per_class]

        # Reset destination folder to replace old synthetic samples cleanly
        if dest_folder.exists():
            shutil.rmtree(dest_folder)
        dest_folder.mkdir(parents=True, exist_ok=True)

        copied = 0
        for img in src_images:
            dest_img = dest_folder / img.name
            shutil.copy2(img, dest_img)
            copied += 1

        summary_counts[dest_class_name] = copied
        print(f"[OK] Ingested {copied:4d} images -> {dest_class_name}")

    return summary_counts


def main():
    parser = argparse.ArgumentParser(description="Ingest spMohanty/PlantVillage-Dataset into AgriSmart AI")
    parser.add_argument(
        "--mode",
        choices=["all", "core"],
        default="all",
        help="Choose 'all' for all 38 PlantVillage classes, or 'core' for 13 classes."
    )
    parser.add_argument(
        "--staging-dir",
        type=Path,
        default=DEFAULT_STAGING_DIR,
        help="Directory to cache the PlantVillage Git repository."
    )
    parser.add_argument(
        "--max-per-class",
        type=int,
        default=None,
        help="Optional limit on number of images per class (e.g. 500) for balanced/faster workflows."
    )
    parser.add_argument(
        "--keep-cache",
        action="store_true",
        default=True,
        help="Retain cloned repository cache in .plantvillage_cache for future use."
    )

    args = parser.parse_args()

    mapping = CORE_CLASS_MAPPING if args.mode == "core" else ALL_CLASS_MAPPING

    print("=" * 70)
    print(f"[*] AgriSmart AI – PlantVillage Dataset Ingestion")
    print(f"[*] Source:  {REPO_URL}")
    print(f"[*] Mode:    {args.mode.upper()} ({len(mapping)} classes)")
    print(f"[*] Target:  {RAW_DIR}")
    if args.max_per_class:
        print(f"[*] Limit:   {args.max_per_class} images / class")
    print("=" * 70)

    color_dir = clone_plantvillage_sparse(args.staging_dir)
    counts = ingest_classes(color_dir, mapping, max_per_class=args.max_per_class)

    total_images = sum(counts.values())
    print("=" * 70)
    print(f"[SUCCESS] Ingested a total of {total_images} real plant leaf images across {len(counts)} classes!")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Run dataset preprocessing and augmentation:")
    print("   python dataset/scripts/dataset_prep.py")
    print("2. Verify PyTorch dataset loaders:")
    print("   python dataset/scripts/verify_dataset.py")
    print("=" * 70)


if __name__ == "__main__":
    main()
