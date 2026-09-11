"""
AgriSmart AI – Sample Dataset Generator
Generates representative synthetic crop leaf images across healthy and diseased classes
for immediate pipeline testing, verification, and end-to-end dry runs.
"""

import json
import math
import os
import random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Base paths
SCRIPT_DIR = Path(__file__).resolve().parent
DATASET_DIR = SCRIPT_DIR.parent
CLASSES_FILE = DATASET_DIR / "classes.json"
RAW_DIR = DATASET_DIR / "raw"


def load_classes():
    with open(CLASSES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["classes"]


def generate_leaf_image(crop_name: str, disease_name: str, status: str, img_size=(320, 320)):
    """Creates a synthetic crop leaf with disease lesions or healthy texture."""
    width, height = img_size
    
    # 1. Background (soil / farm backdrop / studio gray-green)
    bg_color = (
        random.randint(220, 240),
        random.randint(225, 245),
        random.randint(220, 238)
    )
    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)
    
    # 2. Base leaf geometry (curved polygon representing leaf contour)
    cx, cy = width // 2, height // 2
    
    if crop_name in ["Corn", "Rice"]:
        # Elongated, slender leaf
        points = [
            (cx - 35, height - 30),
            (cx - 45, cy + 40),
            (cx - 30, cy - 60),
            (cx, 30),
            (cx + 30, cy - 60),
            (cx + 45, cy + 40),
            (cx + 35, height - 30),
        ]
        base_green = (45, random.randint(130, 165), 55)
    elif crop_name == "Apple":
        # Broad ovate leaf
        points = [
            (cx - 15, height - 40),
            (cx - 80, cy + 30),
            (cx - 75, cy - 40),
            (cx, 35),
            (cx + 75, cy - 40),
            (cx + 80, cy + 30),
            (cx + 15, height - 40),
        ]
        base_green = (35, random.randint(120, 150), 45)
    else:  # Tomato, Potato
        # Serrated compound leaflet
        points = [
            (cx - 20, height - 40),
            (cx - 75, cy + 50),
            (cx - 90, cy),
            (cx - 65, cy - 50),
            (cx, 35),
            (cx + 65, cy - 50),
            (cx + 90, cy),
            (cx + 75, cy + 50),
            (cx + 20, height - 40),
        ]
        base_green = (40, random.randint(135, 170), 50)
    
    # Draw leaf base
    draw.polygon(points, fill=base_green, outline=(30, 90, 35))
    
    # 3. Main vein and secondary veins
    vein_color = (base_green[0] + 25, base_green[1] + 25, base_green[2] + 15)
    draw.line([(cx, height - 40), (cx, 45)], fill=vein_color, width=3)
    
    for vy in range(cy + 60, 60, -35):
        draw.line([(cx, vy), (cx - 50, vy - 25)], fill=vein_color, width=2)
        draw.line([(cx, vy), (cx + 50, vy - 25)], fill=vein_color, width=2)
    
    # 4. Disease Symptoms simulation if not healthy
    if status == "Diseased":
        num_spots = random.randint(8, 20)
        
        if "blight" in disease_name.lower():
            # Concentric rings / large dark necrotic lesions
            for _ in range(random.randint(5, 12)):
                sx = random.randint(cx - 60, cx + 60)
                sy = random.randint(cy - 70, cy + 70)
                r = random.randint(12, 28)
                # Outer yellow halo
                draw.ellipse([sx - r - 4, sy - r - 4, sx + r + 4, sy + r + 4], fill=(195, 175, 45))
                # Brown necrotic lesion
                draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(85, 50, 25))
                # Inner concentric target ring
                if r > 16:
                    draw.ellipse([sx - r // 2, sy - r // 2, sx + r // 2, sy + r // 2], fill=(55, 30, 15))
        elif "rust" in disease_name.lower():
            # Cinnamon-red/orange pustules
            for _ in range(random.randint(25, 45)):
                sx = random.randint(cx - 50, cx + 50)
                sy = random.randint(cy - 100, cy + 80)
                r = random.randint(2, 6)
                draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(185, 75, 25))
        elif "scab" in disease_name.lower() or "black_rot" in disease_name.lower():
            # Dark olive/black puckered spots
            for _ in range(random.randint(10, 25)):
                sx = random.randint(cx - 65, cx + 65)
                sy = random.randint(cy - 80, cy + 60)
                r = random.randint(4, 12)
                draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(40, 42, 35))
        elif "bacterial_spot" in disease_name.lower() or "spot" in disease_name.lower():
            # Small water-soaked brown/yellow speckles
            for _ in range(random.randint(20, 40)):
                sx = random.randint(cx - 60, cx + 60)
                sy = random.randint(cy - 80, cy + 80)
                r = random.randint(3, 8)
                draw.ellipse([sx - r - 2, sy - r - 2, sx + r + 2, sy + r + 2], fill=(180, 170, 40))
                draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(70, 45, 30))
    
    # 5. Add subtle noise/texture blur
    img = img.filter(ImageFilter.SMOOTH_MORE)
    
    # Convert to numpy array to inject fine grain / natural camera sensor noise
    arr = np.array(img).astype(np.float32)
    noise = np.random.normal(0, 4.0, arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    
    return Image.fromarray(arr)


def generate_samples(samples_per_class: int = 15):
    classes = load_classes()
    print(f"Loaded {len(classes)} classes from {CLASSES_FILE.name}")
    
    total_created = 0
    for cls in classes:
        cls_dir = RAW_DIR / cls["name"]
        cls_dir.mkdir(parents=True, exist_ok=True)
        
        for i in range(1, samples_per_class + 1):
            img = generate_leaf_image(
                crop_name=cls["crop"],
                disease_name=cls["name"],
                status=cls["status"],
                img_size=(random.randint(280, 360), random.randint(280, 360))
            )
            filename = f"{cls['name']}_sample_{i:03d}.jpg"
            img.save(cls_dir / filename, "JPEG", quality=92)
            total_created += 1
            
        print(f"  [+] Created {samples_per_class} samples for: {cls['name']}")
        
    print(f"\nSuccessfully generated {total_created} sample images across {len(classes)} classes.")
    print(f"Raw dataset stored in: {RAW_DIR}")


if __name__ == "__main__":
    generate_samples(samples_per_class=12)
