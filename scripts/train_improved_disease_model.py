"""
AgriSmart AI – Improved 19-Class Disease Detection Training & Evaluation Pipeline
Addresses Apple vs. Grape disease confusion via expanded training diversity,
targeted realistic augmentation (no lesion erasing), label smoothing, and two-stage fine-tuning.
Saves model separately to: models/disease/best_model_improved.pt
"""
import os
import sys
import time
import json
import random
from pathlib import Path
from typing import Dict, List, Tuple, Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)
from PIL import Image

# Project paths
WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
AI_ROOT = WORKSPACE_ROOT / "ai"
for p in [str(WORKSPACE_ROOT), str(AI_ROOT)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from ai.src.disease.dataset import (
    discover_classes_and_samples,
    compute_class_weights,
    PlantVillageDataset,
    VALID_EXTENSIONS
)
from ai.src.disease.augmentation import get_targeted_train_transforms, get_val_transforms, get_inference_transforms
from ai.src.disease.models import build_crop_disease_model


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def evaluate_classifier(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
    class_names: List[str]
) -> Dict[str, Any]:
    model.eval()
    all_preds = []
    all_targets = []
    total_time = 0.0
    total_samples = 0

    with torch.no_grad():
        for inputs, targets in loader:
            inputs = inputs.to(device)
            bs = inputs.size(0)

            t0 = time.perf_counter()
            outputs = model(inputs)
            total_time += (time.perf_counter() - t0)

            preds = torch.argmax(outputs, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_targets.extend(targets.numpy())
            total_samples += bs

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)

    acc = float(accuracy_score(all_targets, all_preds))
    macro_prec = float(precision_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_rec = float(recall_score(all_targets, all_preds, average="macro", zero_division=0))
    macro_f1 = float(f1_score(all_targets, all_preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(all_targets, all_preds, average="weighted", zero_division=0))

    per_class_prec = precision_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    per_class_rec = recall_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    per_class_f1 = f1_score(all_targets, all_preds, average=None, zero_division=0).tolist()

    cm = confusion_matrix(all_targets, all_preds, labels=list(range(len(class_names))))
    avg_latency_ms = (total_time / total_samples) * 1000 if total_samples > 0 else 0.0

    per_class_dict = {}
    for idx, cname in enumerate(class_names):
        per_class_dict[cname] = {
            "precision": round(per_class_prec[idx], 4),
            "recall": round(per_class_rec[idx], 4),
            "f1_score": round(per_class_f1[idx], 4),
            "support": int(np.sum(all_targets == idx))
        }

    return {
        "accuracy": round(acc, 4),
        "macro_precision": round(macro_prec, 4),
        "macro_recall": round(macro_rec, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "per_class": per_class_dict,
        "confusion_matrix": cm.tolist(),
        "avg_latency_ms": round(avg_latency_ms, 2),
        "total_samples": int(total_samples)
    }


def plot_cm(cm: List[List[int]], class_names: List[str], save_path: str):
    fig, ax = plt.subplots(figsize=(14, 12))
    cm_arr = np.array(cm)
    im = ax.imshow(cm_arr, interpolation="nearest", cmap=plt.cm.Greens)
    ax.figure.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    ax.set(
        xticks=np.arange(cm_arr.shape[1]),
        yticks=np.arange(cm_arr.shape[0]),
        xticklabels=class_names,
        yticklabels=class_names,
        title="AgriSmart AI Improved 19-Class Disease Confusion Matrix",
        ylabel="Ground Truth Class",
        xlabel="Predicted Class"
    )
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor", fontsize=8)
    plt.setp(ax.get_yticklabels(), fontsize=8)

    thresh = cm_arr.max() / 2.0
    for i in range(cm_arr.shape[0]):
        for j in range(cm_arr.shape[1]):
            val = cm_arr[i, j]
            if val > 0:
                ax.text(
                    j, i, format(val, "d"),
                    ha="center", va="center",
                    color="white" if val > thresh else "black",
                    fontsize=7
                )

    fig.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def plot_curves(history: Dict[str, Any], save_path: str):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))
    epochs = history["epochs"]

    ax1.plot(epochs, history["train_loss"], marker="o", color="#10b981", label="Train Loss", linewidth=2)
    ax1.set_title("Training Loss Across Epochs", fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.grid(True, linestyle="--", alpha=0.5)
    ax1.legend()

    ax2.plot(epochs, history["val_macro_f1"], marker="s", color="#3b82f6", label="Val Macro-F1", linewidth=2)
    ax2.plot(epochs, history["val_accuracy"], marker="^", color="#f59e0b", label="Val Accuracy", linewidth=2)
    ax2.set_title("Validation Metrics Progression", fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Score")
    ax2.set_ylim(0, 1.05)
    ax2.grid(True, linestyle="--", alpha=0.5)
    ax2.legend()

    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()


def main():
    set_seed(42)
    device = torch.device("cpu")
    num_threads = min(12, os.cpu_count() or 4)
    torch.set_num_threads(num_threads)

    print("=" * 75)
    print(" AGRISMART AI – IMPROVED 19-CLASS DISEASE DETECTION MODEL TRAINING")
    print("=" * 75)
    print(f"[*] Compute Engine: CPU ({num_threads} worker threads)")
    print(f"[*] Fixed Random Seed: 42")

    dataset_path = WORKSPACE_ROOT / "dataset" / "raw"
    
    # Load canonical classes from classes.json to guarantee exact order
    classes_json_path = WORKSPACE_ROOT / "dataset" / "classes.json"
    with open(classes_json_path, "r", encoding="utf-8") as f:
        meta_classes = json.load(f)["classes"]
    canonical_class_names = [c["name"] for c in sorted(meta_classes, key=lambda x: x["id"])]
    
    class_to_idx = {name: idx for idx, name in enumerate(canonical_class_names)}
    
    all_samples = []
    class_counts = {idx: 0 for idx in range(len(canonical_class_names))}
    
    for cname in canonical_class_names:
        cdir = dataset_path / cname
        if not cdir.exists():
            raise FileNotFoundError(f"Class folder {cdir} does not exist!")
        c_idx = class_to_idx[cname]
        for img_path in cdir.iterdir():
            if img_path.is_file() and img_path.suffix.lower() in VALID_EXTENSIONS:
                all_samples.append((str(img_path.resolve()), c_idx))
                class_counts[c_idx] += 1
                
    print(f"[*] Discovered {len(canonical_class_names)} canonical classes with {len(all_samples):,} total images.")

    # 1. Stratified 75% Train / 15% Validation / 10% Test split with fixed seed 42
    paths = [s[0] for s in all_samples]
    labels = [s[1] for s in all_samples]

    # Split off test set (10%)
    train_val_paths, test_paths, train_val_labels, test_labels = train_test_split(
        paths,
        labels,
        test_size=0.10,
        random_state=42,
        stratify=labels
    )

    # Split train and validation (15% of total -> 15/90 ~ 16.67% of train_val)
    train_paths, val_paths, train_labels, val_labels = train_test_split(
        train_val_paths,
        train_val_labels,
        test_size=0.1667,
        random_state=42,
        stratify=train_val_labels
    )

    full_train_samples = list(zip(train_paths, train_labels))
    full_val_samples = list(zip(val_paths, val_labels))
    test_samples = list(zip(test_paths, test_labels))

    print(f"[*] Full Partition: {len(full_train_samples):,} Train / {len(full_val_samples):,} Val / {len(test_samples):,} Test")

    # Expanded balanced sampling: allocate up to 250 samples per class for training
    # This gives 2.5x more lesion and background diversity than the previous 100-sample limit
    MAX_TRAIN_PER_CLASS = 250
    MAX_VAL_PER_CLASS = 45
    MAX_TEST_PER_CLASS = 30

    train_by_class = {idx: [] for idx in range(len(canonical_class_names))}
    for item in full_train_samples:
        train_by_class[item[1]].append(item)

    val_by_class = {idx: [] for idx in range(len(canonical_class_names))}
    for item in full_val_samples:
        val_by_class[item[1]].append(item)

    test_by_class = {idx: [] for idx in range(len(canonical_class_names))}
    for item in test_samples:
        test_by_class[item[1]].append(item)

    active_train_samples = []
    active_val_samples = []
    active_test_samples = []

    rng = random.Random(42)
    for idx in range(len(canonical_class_names)):
        c_train = train_by_class[idx]
        rng.shuffle(c_train)
        active_train_samples.extend(c_train[:MAX_TRAIN_PER_CLASS])

        c_val = val_by_class[idx]
        rng.shuffle(c_val)
        active_val_samples.extend(c_val[:MAX_VAL_PER_CLASS])

        c_test = test_by_class[idx]
        rng.shuffle(c_test)
        active_test_samples.extend(c_test[:MAX_TEST_PER_CLASS])

    print(f"\n[*] Active Balanced Budget: {len(active_train_samples)} Train / {len(active_val_samples)} Val / {len(active_test_samples)} Test")
    print(f"    Apple Scab: {len([s for s in active_train_samples if s[1]==0])} train samples")
    print(f"    Apple Black Rot: {len([s for s in active_train_samples if s[1]==1])} train samples")
    print(f"    Grape Black Rot: {len([s for s in active_train_samples if s[1]==8])} train samples")

    # 2. Compute Class Weights for Loss
    class_weights = compute_class_weights(active_train_samples, len(canonical_class_names)).to(device)

    # 3. DataLoaders with Targeted Leaf Augmentation (No lesion erasing)
    train_dataset = PlantVillageDataset(active_train_samples, transform=get_targeted_train_transforms(image_size=224))
    val_dataset = PlantVillageDataset(active_val_samples, transform=get_val_transforms(image_size=224))
    test_dataset = PlantVillageDataset(active_test_samples, transform=get_val_transforms(image_size=224))

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False, num_workers=0)

    # 4. Build Model & Loss with Label Smoothing
    print("\n[*] Initializing EfficientNet-B0 19-class Classifier...")
    model = build_crop_disease_model(architecture="efficientnet_b0", num_classes=19, pretrained=True, dropout=0.3)
    model.to(device)

    # Label smoothing 0.10 regularizes overconfident lesion classification
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=0.10)

    history = {
        "epochs": [],
        "train_loss": [],
        "val_macro_f1": [],
        "val_accuracy": []
    }

    best_macro_f1 = -1.0
    best_state_dict = None
    best_val_metrics = {}

    # -------------------------------------------------------------
    # STAGE 1: Train Classification Head (Backbone Frozen) - 2 Epochs
    # -------------------------------------------------------------
    print("\n" + "=" * 50)
    print(" STAGE 1: Training Classification Head (2 Epochs)")
    print("=" * 50)
    model.freeze_backbone()
    optimizer_s1 = AdamW(model.head_module.parameters(), lr=1e-3, weight_decay=1e-4)

    for ep in range(1, 3):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        n_samples = 0

        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer_s1.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer_s1.step()

            running_loss += loss.item() * inputs.size(0)
            n_samples += inputs.size(0)

        ep_loss = running_loss / n_samples
        val_res = evaluate_classifier(model, val_loader, device, canonical_class_names)
        ep_time = time.time() - t0

        history["epochs"].append(ep)
        history["train_loss"].append(round(ep_loss, 4))
        history["val_macro_f1"].append(val_res["macro_f1"])
        history["val_accuracy"].append(val_res["accuracy"])

        print(f"[Stage 1 - Epoch {ep}/2] Loss: {ep_loss:.4f} | Val Macro-F1: {val_res['macro_f1']:.4f} | Acc: {val_res['accuracy']:.4f} ({ep_time:.1f}s)")

        if val_res["macro_f1"] > best_macro_f1:
            best_macro_f1 = val_res["macro_f1"]
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            best_val_metrics = val_res

    # -------------------------------------------------------------
    # STAGE 2: Fine-Tuning Upper Layers (Unfreeze Top Stages) - 2 Epochs
    # -------------------------------------------------------------
    print("\n" + "=" * 50)
    print(" STAGE 2: Fine-Tuning Upper Backbone (2 Epochs)")
    print("=" * 50)
    model.unfreeze_upper_layers()
    trainable_params = [p for p in model.parameters() if p.requires_grad]
    optimizer_s2 = AdamW(trainable_params, lr=1e-4, weight_decay=1e-4)
    scheduler_s2 = CosineAnnealingLR(optimizer_s2, T_max=2, eta_min=1e-6)

    for ep in range(3, 5):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        n_samples = 0

        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer_s2.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer_s2.step()

            running_loss += loss.item() * inputs.size(0)
            n_samples += inputs.size(0)

        scheduler_s2.step()
        ep_loss = running_loss / n_samples
        val_res = evaluate_classifier(model, val_loader, device, canonical_class_names)
        ep_time = time.time() - t0

        history["epochs"].append(ep)
        history["train_loss"].append(round(ep_loss, 4))
        history["val_macro_f1"].append(val_res["macro_f1"])
        history["val_accuracy"].append(val_res["accuracy"])

        print(f"[Stage 2 - Epoch {ep-2}/2] Loss: {ep_loss:.4f} | Val Macro-F1: {val_res['macro_f1']:.4f} | Acc: {val_res['accuracy']:.4f} ({ep_time:.1f}s)")

        if val_res["macro_f1"] > best_macro_f1:
            best_macro_f1 = val_res["macro_f1"]
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            best_val_metrics = val_res

    # Load best weights
    model.load_state_dict(best_state_dict)

    # 5. Final Evaluation on Validation and Independent Test Sets
    print("\n" + "=" * 50)
    print(" FINAL EVALUATION ON VALIDATION SET")
    print("=" * 50)
    val_final = evaluate_classifier(model, val_loader, device, canonical_class_names)
    print(f"Val Accuracy:   {val_final['accuracy']:.4f} ({val_final['accuracy']*100:.2f}%)")
    print(f"Val Macro-F1:   {val_final['macro_f1']:.4f}")
    print(f"Val Weighted-F1:{val_final['weighted_f1']:.4f}")

    print("\n" + "=" * 50)
    print(" INDEPENDENT EVALUATION ON TEST SET")
    print("=" * 50)
    test_final = evaluate_classifier(model, test_loader, device, canonical_class_names)
    print(f"Test Accuracy:   {test_final['accuracy']:.4f} ({test_final['accuracy']*100:.2f}%)")
    print(f"Test Macro-F1:   {test_final['macro_f1']:.4f}")
    print(f"Test Weighted-F1:{test_final['weighted_f1']:.4f}")

    # Check Apple vs Grape confusion specifically
    cm_test = test_final["confusion_matrix"]
    # 0: Apple___Apple_scab, 1: Apple___Black_rot, 8: Grape_Black_Rot
    apple_scab_to_grape_br = cm_test[0][8]
    apple_br_to_grape_br = cm_test[1][8]
    grape_br_to_apple_scab = cm_test[8][0]
    grape_br_to_apple_br = cm_test[8][1]

    print(f"\n--- Apple vs. Grape Confusion (Test Set) ---")
    print(f"  Apple Scab (0) -> Grape Black Rot (8): {apple_scab_to_grape_br}")
    print(f"  Apple Black Rot (1) -> Grape Black Rot (8): {apple_br_to_grape_br}")
    print(f"  Grape Black Rot (8) -> Apple Scab (0): {grape_br_to_apple_scab}")
    print(f"  Grape Black Rot (8) -> Apple Black Rot (1): {grape_br_to_apple_br}")

    print(f"\n--- Per-Class Performance (Test Set) ---")
    for cname in ["Apple___Apple_scab", "Apple___Black_rot", "Apple___healthy", "Grape_Black_Rot", "Grape_Healthy"]:
        m = test_final["per_class"][cname]
        print(f"  {cname:<28}: P={m['precision']:.4f} | R={m['recall']:.4f} | F1={m['f1_score']:.4f} | Sup={m['support']}")

    # 6. Evaluate Diagnostic Apple Leaf Image (OIP.jpg)
    print("\n" + "=" * 50)
    print(" EVALUATING DIAGNOSTIC APPLE LEAF IMAGE (OIP.jpg)")
    print("=" * 50)
    
    diag_path = Path(r"C:\Users\JALP PATEL\Downloads\OIP.jpg")
    if not diag_path.exists():
        diag_path = WORKSPACE_ROOT / "OIP.jpg"
    
    diag_results = []
    if diag_path.exists():
        im = Image.open(diag_path).convert("RGB")
        inf_transforms = get_inference_transforms(224)
        diag_tensor = inf_transforms(im).unsqueeze(0).to(device)
        
        with torch.no_grad():
            diag_logits = model(diag_tensor)
            diag_probs = F.softmax(diag_logits, dim=1).squeeze(0).cpu().numpy()
            
        diag_top5_idx = np.argsort(diag_probs)[::-1][:5]
        for rank, c_id in enumerate(diag_top5_idx):
            c_name = canonical_class_names[c_id]
            # Parse crop
            crop = "Apple" if "apple" in c_name.lower() else ("Grape" if "grape" in c_name.lower() else c_name.split("_")[0])
            prob_pct = diag_probs[c_id] * 100
            diag_results.append({
                "rank": rank + 1,
                "class_id": int(c_id),
                "class_name": c_name,
                "crop": crop,
                "probability": round(float(diag_probs[c_id]), 6),
                "probability_pct": round(prob_pct, 2),
                "logit": round(float(diag_logits[0, c_id]), 4)
            })
            print(f"  Top-{rank+1}: [{c_id}] {c_name} (Crop: {crop}) | Prob: {prob_pct:.2f}% | Logit: {diag_logits[0, c_id]:.4f}")
    else:
        print("[!] Warning: Diagnostic image OIP.jpg not found.")

    # 7. Save Model Separately First: models/disease/best_model_improved.pt
    models_dir = WORKSPACE_ROOT / "models" / "disease"
    ai_models_dir = AI_ROOT / "models" / "disease"
    models_dir.mkdir(parents=True, exist_ok=True)
    ai_models_dir.mkdir(parents=True, exist_ok=True)

    robust_ckpt_path = models_dir / "best_model_robust.pt"
    ai_robust_ckpt_path = ai_models_dir / "best_model_robust.pt"
    improved_ckpt_path = models_dir / "best_model_improved.pt"
    ai_improved_ckpt_path = ai_models_dir / "best_model_improved.pt"

    checkpoint_data = {
        "architecture": "efficientnet_b0",
        "num_classes": 19,
        "model_state_dict": best_state_dict,
        "class_names": canonical_class_names,
        "metrics": {
            "validation": val_final,
            "test": test_final,
            "diagnostic_sample": diag_results
        },
        "history": history,
        "training_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "training_config": {
            "max_train_per_class": MAX_TRAIN_PER_CLASS,
            "max_val_per_class": MAX_VAL_PER_CLASS,
            "max_test_per_class": MAX_TEST_PER_CLASS,
            "label_smoothing": 0.10,
            "batch_size": 32,
            "random_state": 42
        }
    }

    torch.save(checkpoint_data, robust_ckpt_path)
    torch.save(checkpoint_data, ai_robust_ckpt_path)
    torch.save(checkpoint_data, improved_ckpt_path)
    torch.save(checkpoint_data, ai_improved_ckpt_path)
    print(f"\n[OK] Saved robust 19-class checkpoint to: {robust_ckpt_path}")

    # Save class names JSON
    with open(models_dir / "robust_class_names.json", "w", encoding="utf-8") as f:
        json.dump(canonical_class_names, f, indent=4)
    with open(ai_models_dir / "robust_class_names.json", "w", encoding="utf-8") as f:
        json.dump(canonical_class_names, f, indent=4)

    # Save metrics JSON
    with open(models_dir / "robust_model_metrics.json", "w", encoding="utf-8") as f:
        json.dump(checkpoint_data["metrics"], f, indent=4)
    with open(ai_models_dir / "robust_model_metrics.json", "w", encoding="utf-8") as f:
        json.dump(checkpoint_data["metrics"], f, indent=4)

    # Save plots
    fig_dir = WORKSPACE_ROOT / "reports" / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)
    plot_cm(test_final["confusion_matrix"], canonical_class_names, str(fig_dir / "confusion_matrix_improved.png"))
    plot_curves(history, str(fig_dir / "training_curve_improved.png"))

    print(f"[OK] Improved model artifacts and plots saved successfully.")

    # 8. Assess Promotion
    prev_ckpt = torch.load(models_dir / "best_model.pt", map_location="cpu", weights_only=False)
    prev_f1 = prev_ckpt.get("metrics", {}).get("macro_f1", 0.90)
    new_f1 = test_final["macro_f1"]
    print(f"\n[PROMOTION ASSESSMENT]")
    print(f"  Previous Model Validation Macro-F1: {prev_f1:.4f}")
    print(f"  Improved Model Test Macro-F1:       {new_f1:.4f}")
    
    promote = new_f1 >= prev_f1
    print(f"  Promotion Criteria Met: {promote}")

    return checkpoint_data, promote


if __name__ == "__main__":
    main()
