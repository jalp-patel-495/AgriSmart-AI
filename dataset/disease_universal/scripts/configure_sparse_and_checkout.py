"""
AgriSmart AI - PlantVillage Full 38-Class Sparse Configuration
Writes all 38 class folder paths to .git/info/sparse-checkout and executes checkout.
"""
import subprocess
from pathlib import Path

CLASSES_38 = [
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

def main():
    root = Path(__file__).resolve().parents[3]
    repo_dir = root / "dataset" / "disease_universal" / "plantvillage" / "repo"
    sparse_file = repo_dir / ".git" / "info" / "sparse-checkout"

    lines = [
        "/*\n",
        "!/*/\n",
        "/raw/\n",
        "!/raw/*/\n",
        "/raw/color/\n",
        "!/raw/color/*/\n"
    ]
    for c in CLASSES_38:
        lines.append(f"/raw/color/{c}/\n")

    with open(sparse_file, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"[*] Wrote {len(CLASSES_38)} class paths to {sparse_file}")

    print("[*] Executing git checkout HEAD...")
    res = subprocess.run(
        ["git", "-c", "core.longpaths=true", "checkout", "HEAD"],
        cwd=repo_dir,
        capture_output=True,
        text=True
    )
    print(f"[*] Checkout code: {res.returncode}")
    if res.stdout:
        print(f"[*] stdout: {res.stdout.strip()[:300]}")
    if res.stderr:
        print(f"[*] stderr: {res.stderr.strip()[:300]}")

if __name__ == "__main__":
    main()
