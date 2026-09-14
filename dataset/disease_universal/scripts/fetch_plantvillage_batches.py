"""
AgriSmart AI - PlantVillage Batch Sparse Checkout
Checks out the 38 classes across 14 crops in manageable batches with progress logging.
"""
import subprocess
import time
from pathlib import Path

BATCHES = [
    ("Batch 1: Apple", [
        "raw/color/Apple___Apple_scab",
        "raw/color/Apple___Black_rot",
        "raw/color/Apple___Cedar_apple_rust",
        "raw/color/Apple___healthy"
    ]),
    ("Batch 2: Blueberry & Cherry", [
        "raw/color/Blueberry___healthy",
        "raw/color/Cherry_(including_sour)___Powdery_mildew",
        "raw/color/Cherry_(including_sour)___healthy"
    ]),
    ("Batch 3: Corn", [
        "raw/color/Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
        "raw/color/Corn_(maize)___Common_rust_",
        "raw/color/Corn_(maize)___Northern_Leaf_Blight",
        "raw/color/Corn_(maize)___healthy"
    ]),
    ("Batch 4: Grape", [
        "raw/color/Grape___Black_rot",
        "raw/color/Grape___Esca_(Black_Measles)",
        "raw/color/Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
        "raw/color/Grape___healthy"
    ]),
    ("Batch 5: Orange & Bell Pepper", [
        "raw/color/Orange___Haunglongbing_(Citrus_greening)",
        "raw/color/Pepper,_bell___Bacterial_spot",
        "raw/color/Pepper,_bell___healthy"
    ]),
    ("Batch 6: Potato", [
        "raw/color/Potato___Early_blight",
        "raw/color/Potato___Late_blight",
        "raw/color/Potato___healthy"
    ]),
    ("Batch 7: Raspberry, Soybean, Squash, Strawberry", [
        "raw/color/Raspberry___healthy",
        "raw/color/Soybean___healthy",
        "raw/color/Squash___Powdery_mildew",
        "raw/color/Strawberry___Leaf_scorch",
        "raw/color/Strawberry___healthy"
    ]),
    ("Batch 8: Tomato", [
        "raw/color/Tomato___Bacterial_spot",
        "raw/color/Tomato___Early_blight",
        "raw/color/Tomato___Late_blight",
        "raw/color/Tomato___Leaf_Mold",
        "raw/color/Tomato___Septoria_leaf_spot",
        "raw/color/Tomato___Spider_mites Two-spotted_spider_mite",
        "raw/color/Tomato___Target_Spot",
        "raw/color/Tomato___Tomato_Yellow_Leaf_Curl_Virus",
        "raw/color/Tomato___Tomato_mosaic_virus",
        "raw/color/Tomato___healthy"
    ])
]

def main():
    root = Path(__file__).resolve().parents[3]
    repo_dir = root / "dataset" / "disease_universal" / "plantvillage" / "repo"
    
    print(f"[*] Starting PlantVillage batch checkout in {repo_dir}...")
    for batch_name, paths in BATCHES:
        print(f"\n[*] Processing {batch_name} ({len(paths)} classes)...")
        cmd = ["git", "-c", "core.longpaths=true", "sparse-checkout", "add"] + paths
        success = False
        for attempt in range(3):
            try:
                res = subprocess.run(cmd, cwd=repo_dir, capture_output=True, text=True, timeout=180)
                if res.returncode == 0:
                    print(f"[OK] Successfully checked out {batch_name}.")
                    success = True
                    break
                else:
                    print(f"[!] Attempt {attempt+1} failed: {res.stderr.strip()[:100]}")
                    time.sleep(2)
            except subprocess.TimeoutExpired:
                print(f"[!] Attempt {attempt+1} timed out.")
                time.sleep(2)
        if not success:
            print(f"[WARN] Could not checkout {batch_name} after 3 attempts.")

    # Count total images checked out
    color_dir = repo_dir / "raw" / "color"
    total_imgs = 0
    class_counts = {}
    if color_dir.exists():
        for d in sorted(color_dir.iterdir()):
            if d.is_dir() and not d.name.startswith("."):
                cnt = sum(1 for f in d.iterdir() if f.is_file() and f.suffix.lower() in {'.jpg', '.jpeg', '.png'})
                class_counts[d.name] = cnt
                total_imgs += cnt

    print(f"\n==================================================")
    print(f"[SUMMARY] PlantVillage classes downloaded: {len(class_counts)}")
    print(f"[SUMMARY] Total images downloaded: {total_imgs}")
    for c, cnt in class_counts.items():
        print(f"  - {c}: {cnt}")
    print(f"==================================================")

if __name__ == "__main__":
    main()
