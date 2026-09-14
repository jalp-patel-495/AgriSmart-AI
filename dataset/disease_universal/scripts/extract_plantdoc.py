"""
AgriSmart AI - PlantDoc Dataset Extractor & Sanitizer
Extracts all 2,581 images from the local Git object store, sanitizing Windows-incompatible filenames.
"""
import os
import re
import subprocess
from pathlib import Path

def sanitize_filename(filename: str) -> str:
    # Replace invalid Windows chars (?, :, *, ", <, >, |, %, &) with _
    clean = re.sub(r'[\\/*?:"<>|%&=]', '_', filename)
    # Truncate if excessively long
    if len(clean) > 80:
        stem, ext = os.path.splitext(clean)
        ext = ext[:10] if ext else ".jpg"
        clean = stem[:70] + ext
    return clean

def extract_plantdoc():
    root = Path(__file__).resolve().parents[3]
    repo_dir = root / "dataset" / "disease_universal" / "plantdoc" / "repo"
    out_dir = root / "dataset" / "disease_universal" / "plantdoc" / "images"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[*] Extracting PlantDoc from {repo_dir} to {out_dir}...")
    p = subprocess.run(
        ["git", "ls-tree", "-r", "HEAD"],
        cwd=repo_dir,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore"
    )
    if p.returncode != 0:
        print(f"[!] git ls-tree failed: {p.stderr}")
        return

    extracted_counts = {}
    lines = p.stdout.strip().splitlines()
    print(f"[*] Found {len(lines)} objects in git tree.")

    for i, line in enumerate(lines):
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        meta, rel_path = parts[0], parts[1]
        blob_sha = meta.split()[2]
        
        # We only care about image files
        suffix = Path(rel_path).suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".bmp"}:
            continue

        path_parts = rel_path.split("/")
        if len(path_parts) >= 2:
            # e.g., train/Apple Scab Leaf/image.jpg or test/Apple Scab Leaf/image.jpg
            class_name = path_parts[1]
            raw_fname = path_parts[-1]
            clean_fname = sanitize_filename(raw_fname)

            cls_dir = out_dir / class_name
            cls_dir.mkdir(parents=True, exist_ok=True)
            dest_file = cls_dir / clean_fname

            # Check if file already written
            if dest_file.exists() and dest_file.stat().st_size > 0:
                extracted_counts[class_name] = extracted_counts.get(class_name, 0) + 1
                continue

            # Stream object from git blob
            blob_proc = subprocess.run(
                ["git", "cat-file", "-p", blob_sha],
                cwd=repo_dir,
                capture_output=True
            )
            if blob_proc.returncode == 0 and len(blob_proc.stdout) > 0:
                with open(dest_file, "wb") as f:
                    f.write(blob_proc.stdout)
                extracted_counts[class_name] = extracted_counts.get(class_name, 0) + 1

        if (i + 1) % 500 == 0 or (i + 1) == len(lines):
            print(f"[*] Processed {i + 1}/{len(lines)} files...")

    print(f"[OK] Successfully extracted {sum(extracted_counts.values())} PlantDoc images across {len(extracted_counts)} classes.")
    return extracted_counts

if __name__ == "__main__":
    extract_plantdoc()
