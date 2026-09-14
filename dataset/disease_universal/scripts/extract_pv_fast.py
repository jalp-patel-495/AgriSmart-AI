"""
AgriSmart AI - PlantVillage High-Performance Batch Extractor
Uses a single persistent `git cat-file --batch` process to extract images directly from the Git object database in seconds.
"""
import subprocess
from pathlib import Path

def extract_fast(max_per_class: int = 150):
    root = Path(__file__).resolve().parents[3]
    repo_dir = root / "dataset" / "disease_universal" / "plantvillage" / "repo"
    color_dir = repo_dir / "raw" / "color"
    color_dir.mkdir(parents=True, exist_ok=True)

    print(f"[*] Reading tree from {repo_dir}...")
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
    print(f"[*] Found {len(lines)} files in git tree.")

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

    # Start single persistent git cat-file --batch process
    proc = subprocess.Popen(
        ["git", "cat-file", "--batch"],
        cwd=repo_dir,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        bufsize=0
    )

    extracted_counts = {}
    total_written = 0

    for cls, samples in sorted(by_class.items()):
        cls_dir = color_dir / cls
        cls_dir.mkdir(parents=True, exist_ok=True)

        existing = len([f for f in cls_dir.iterdir() if f.is_file()])
        if existing >= 50:
            extracted_counts[cls] = existing
            continue

        selected = samples[:max_per_class]
        cls_written = 0

        for sha, fname in selected:
            dest = cls_dir / fname
            if dest.exists() and dest.stat().st_size > 0:
                cls_written += 1
                continue

            # Send sha to batch process
            proc.stdin.write(f"{sha}\n".encode("ascii"))
            proc.stdin.flush()

            # Read header: "<sha> blob <size>\n"
            header = proc.stdout.readline().decode("ascii", errors="ignore").strip()
            if not header or "missing" in header:
                continue

            parts = header.split()
            if len(parts) >= 3 and parts[1] == "blob":
                size = int(parts[2])
                content = proc.stdout.read(size)
                proc.stdout.read(1)  # trailing newline

                with open(dest, "wb") as f:
                    f.write(content)
                cls_written += 1
                total_written += 1

        extracted_counts[cls] = cls_written
        print(f"[*] Extracted {cls_written:4d} images -> {cls}")

    proc.stdin.close()
    proc.wait()

    print(f"\n==================================================")
    print(f"[OK] High-performance extraction completed!")
    print(f"Classes populated: {len(extracted_counts)}")
    print(f"Total images now in raw/color: {sum(extracted_counts.values())}")
    print(f"==================================================")

if __name__ == "__main__":
    extract_fast()
