"""
AgriSmart AI - PlantVillage Targeted Blob Extractor
Extracts images for classes directly from git tree blobs into raw/color/.
"""
import subprocess
from pathlib import Path

def extract_subset(max_per_class: int = 150):
    root = Path(__file__).resolve().parents[3]
    repo_dir = root / "dataset" / "disease_universal" / "plantvillage" / "repo"
    color_dir = repo_dir / "raw" / "color"
    color_dir.mkdir(parents=True, exist_ok=True)

    p = subprocess.run(
        ["git", "ls-tree", "-r", "HEAD", "raw/color"],
        cwd=repo_dir,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore"
    )
    if p.returncode != 0:
        print("[!] git ls-tree failed.")
        return

    lines = p.stdout.strip().splitlines()
    print(f"[*] Found {len(lines)} files in PlantVillage tree.")

    by_class = {}
    for line in lines:
        parts = line.split("\t")
        if len(parts) == 2:
            sha = parts[0].split()[2]
            path = parts[1]
            sub = path.split("/")
            if len(sub) >= 3:
                cls = sub[2]
                by_class.setdefault(cls, []).append((sha, sub[-1]))

    extracted_counts = {}
    for cls, samples in sorted(by_class.items()):
        cls_dir = color_dir / cls
        cls_dir.mkdir(parents=True, exist_ok=True)
        
        # Check existing images in cls_dir
        existing = len([f for f in cls_dir.iterdir() if f.is_file()])
        if existing >= 50:
            extracted_counts[cls] = existing
            continue

        selected = samples[:max_per_class]
        count = 0
        for sha, fname in selected:
            dest = cls_dir / fname
            if dest.exists() and dest.stat().st_size > 0:
                count += 1
                continue
            res = subprocess.run(["git", "cat-file", "-p", sha], cwd=repo_dir, capture_output=True)
            if res.returncode == 0 and len(res.stdout) > 0:
                with open(dest, "wb") as f:
                    f.write(res.stdout)
                count += 1
        extracted_counts[cls] = count
        print(f"[*] Extracted {count:4d} images -> {cls}")

    print(f"\n[OK] Extracted across {len(extracted_counts)} classes. Total images: {sum(extracted_counts.values())}")

if __name__ == "__main__":
    extract_subset()
