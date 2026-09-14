"""
AgriSmart AI – PlantVillage 38-Class Transfer Learning Training Engine
Source Dataset: https://github.com/spMohanty/PlantVillage-Dataset
Supported Crops: 14 crops, 38 classes

Features:
- Automated dataset discovery and stratified split loading
- Two-Stage Transfer Learning (Head warmup -> Fine-tuning upper layers)
- Transfer learning backbones: mobilenet_v3_large (default, fast on CPU), efficientnet_b0, resnet50
- Class-weighted Cross-Entropy loss for handling class imbalance
- AdamW optimizer with Cosine Annealing learning rate schedule
- Early stopping based on Validation Macro-F1
- Checkpointing to models/disease/best_model.pt and models/disease/plantvillage_model.pt
- Checkpoint metadata saving (architecture, class_names, metrics, timestamps)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from PIL import Image

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ai.src.disease.models import build_crop_disease_model, CropDiseaseClassifier
from ai.src.disease.losses import build_criterion
from ai.src.disease.evaluate import evaluate_model
from ai.src.disease.augmentation import (
    get_albumentations_train_transforms,
    get_albumentations_val_transforms,
    get_train_transforms,
    get_val_transforms
)
from ai.src.disease.dataset import detect_dataset_path, discover_classes_and_samples, PlantVillageDataset


def load_dataset_from_splits_or_raw(
    root_dir: Path,
    batch_size: int = 32,
    img_size: int = 224,
    num_workers: int = 0
) -> Tuple[DataLoader, DataLoader, DataLoader, List[str], torch.Tensor]:
    """
    Loads DataLoaders from dataset/splits (train.csv, val.csv, test.csv) if present,
    or falls back to dynamic directory scanning on dataset/raw.
    Uses Albumentations transforms for training and standard normalization for validation/test.
    """
    splits_dir = root_dir / "dataset" / "splits"
    classes_json_path = root_dir / "models" / "disease" / "class_names.json"
    
    if not classes_json_path.exists():
        classes_json_path = root_dir / "dataset" / "classes.json"
        
    with open(classes_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        if isinstance(data, list):
            canonical_classes = data
        elif isinstance(data, dict) and "classes" in data:
            canonical_classes = [c["name"] for c in sorted(data["classes"], key=lambda x: x.get("id", 0))]
        else:
            canonical_classes = list(data.values())

    class_to_idx = {name: idx for idx, name in enumerate(canonical_classes)}
    num_classes = len(canonical_classes)

    train_csv = splits_dir / "train.csv"
    val_csv = splits_dir / "val.csv"
    test_csv = splits_dir / "test.csv"

    # Albumentations transforms for training and validation
    train_tf = get_albumentations_train_transforms(image_size=img_size)
    val_tf = get_albumentations_val_transforms(image_size=img_size)

    if train_csv.exists() and val_csv.exists():
        print(f"[*] Loading dataset manifests from {splits_dir}...")
        import pandas as pd
        train_df = pd.read_csv(train_csv)
        val_df = pd.read_csv(val_csv)
        test_df = pd.read_csv(test_csv) if test_csv.exists() else val_df

        def extract_samples(df):
            samples = []
            dataset_dir = root_dir / "dataset"
            use_proc = len(df) > 0 and (dataset_dir / str(df["processed_path"].iloc[0])).exists()
            for proc_p, raw_p, cname in zip(df["processed_path"], df["raw_path"], df["class_name"]):
                cid = class_to_idx.get(str(cname))
                if cid is not None:
                    p_str = str(dataset_dir / str(proc_p)) if use_proc else str(raw_p)
                    samples.append((p_str, cid))
            return samples

        train_samples = extract_samples(train_df)
        val_samples = extract_samples(val_df)
        test_samples = extract_samples(test_df)

        print(f"[*] Loaded samples: Train={len(train_samples)}, Val={len(val_samples)}, Test={len(test_samples)} across {num_classes} classes.")
    else:
        # Fallback to scanning raw directory
        raw_path = detect_dataset_path()
        print(f"[*] Scanning raw dataset directory: {raw_path}...")
        classes_found, all_samples, class_counts = discover_classes_and_samples(raw_path)
        canonical_classes = classes_found
        class_to_idx = {name: idx for idx, name in enumerate(canonical_classes)}
        num_classes = len(canonical_classes)

        from sklearn.model_selection import train_test_split
        train_val, test_samples = train_test_split(all_samples, test_size=0.15, stratify=[s[1] for s in all_samples], random_state=42)
        train_samples, val_samples = train_test_split(train_val, test_size=0.1765, stratify=[s[1] for s in train_val], random_state=42)

    # Compute class frequencies and inverse-frequency weights
    class_counts = [0] * num_classes
    for _, cid in train_samples:
        if cid < num_classes:
            class_counts[cid] += 1

    total_train = max(1, len(train_samples))
    weights = []
    for cnt in class_counts:
        w = total_train / (num_classes * max(cnt, 1))
        weights.append(min(w, 8.0))  # Clip extreme imbalance weights
    class_weights = torch.tensor(weights, dtype=torch.float32)

    train_ds = PlantVillageDataset(train_samples, transform=train_tf)
    val_ds = PlantVillageDataset(val_samples, transform=val_tf)
    test_ds = PlantVillageDataset(test_samples, transform=val_tf)

    use_cuda = torch.cuda.is_available()
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=num_workers, pin_memory=use_cuda)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=num_workers, pin_memory=use_cuda)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=num_workers, pin_memory=use_cuda)

    return train_loader, val_loader, test_loader, canonical_classes, class_weights


def train_single_epoch(
    model: nn.Module,
    train_loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
    scaler: Optional[Any] = None,
    use_amp: bool = False
) -> Tuple[float, float]:
    """Trains model for one epoch and returns (average loss, throughput imgs/sec)."""
    model.train()
    running_loss = 0.0
    total_samples = 0
    t0 = time.time()

    for inputs, targets in train_loader:
        inputs = inputs.to(device)
        targets = targets.to(device)

        optimizer.zero_grad()
        if use_amp and scaler is not None:
            with torch.amp.autocast("cuda"):
                outputs = model(inputs)
                loss = criterion(outputs, targets)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

        running_loss += loss.item() * inputs.size(0)
        total_samples += inputs.size(0)

    elapsed = max(time.time() - t0, 1e-4)
    avg_loss = running_loss / total_samples if total_samples > 0 else 0.0
    throughput = total_samples / elapsed
    return avg_loss, throughput


def run_training(
    architecture: str = "mobilenet_v3_large",
    stage1_epochs: int = 3,
    stage2_epochs: int = 3,
    batch_size: int = 32,
    lr: float = 1e-3,
    fine_tune_lr: float = 1e-4,
    weight_decay: float = 1e-4,
    dropout: float = 0.3,
    patience: int = 3,
    device_name: str = "auto"
) -> Dict[str, Any]:
    """
    Main training routine. Executes two-stage transfer learning,
    validates on each epoch, checkpoints peak Macro-F1 model weights.
    """
    if device_name == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(device_name)

    if device.type == "cuda":
        torch.backends.cudnn.benchmark = True
        device_display = f"CUDA GPU ({torch.cuda.get_device_name(0)})"
    else:
        device_display = f"CPU ({torch.get_num_threads()} threads)"

    print("=" * 75)
    print(f"[*] AgriSmart AI – PlantVillage 38-Class Model Training")
    print(f"[*] Architecture   : {architecture}")
    print(f"[*] Compute Device : {device_display}")
    print(f"[*] Batch Size     : {batch_size}")
    print(f"[*] Stage 1 Epochs : {stage1_epochs} (Backbone frozen, Head training)")
    print(f"[*] Stage 2 Epochs : {stage2_epochs} (Upper-layer fine-tuning)")
    print("=" * 75)

    # 1. Load Data
    train_loader, val_loader, test_loader, class_names, class_weights = load_dataset_from_splits_or_raw(
        root_dir=PROJECT_ROOT,
        batch_size=batch_size,
        img_size=224,
        num_workers=0
    )
    num_classes = len(class_names)
    print(f"[*] Classes to predict: {num_classes}")

    # 2. Build Model
    model = build_crop_disease_model(
        architecture=architecture,
        num_classes=num_classes,
        pretrained=True,
        dropout=dropout
    )
    model.to(device)

    # 3. Loss criterion with class weighting
    criterion = build_criterion(loss_type="weighted_cross_entropy", class_weights=class_weights.to(device))

    best_macro_f1 = -1.0
    best_state_dict = None
    best_metrics = {}
    epochs_no_improve = 0

    history = {
        "architecture": architecture,
        "epochs": [],
        "train_loss": [],
        "val_loss": [],
        "val_macro_f1": [],
        "val_accuracy": []
    }

    start_time = time.time()

    use_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda") if use_amp else None
    if use_amp:
        print(f"[*] CUDA Mixed Precision (AMP fp16) Enabled on {torch.cuda.get_device_name(0)}")
    else:
        print(f"[*] Running on CPU with {torch.get_num_threads()} threads")

    # -------------------------------------------------------------
    # STAGE 1: Train Classification Head (Backbone Frozen)
    # -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("[*] STARTING STAGE 1: Classification Head Training")
    print("=" * 60)
    model.freeze_backbone()

    optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=lr, weight_decay=weight_decay)
    scheduler = CosineAnnealingLR(optimizer, T_max=max(stage1_epochs, 1), eta_min=1e-6)

    for epoch in range(1, stage1_epochs + 1):
        t0 = time.time()
        train_loss, throughput = train_single_epoch(model, train_loader, criterion, optimizer, device, scaler=scaler, use_amp=use_amp)
        scheduler.step()

        val_metrics = evaluate_model(model, val_loader, device, class_names)
        val_f1 = val_metrics["macro_f1"]
        val_acc = val_metrics["accuracy"]
        elapsed = time.time() - t0

        print(
            f"Epoch {epoch:2d}/{stage1_epochs:2d} (Stage 1) [{elapsed:.1f}s, {throughput:.1f} img/s] | "
            f"Train Loss: {train_loss:.4f} | "
            f"Val Loss: {val_metrics.get('val_loss', 0.0):.4f} | "
            f"Val Acc: {val_acc:.4f} | "
            f"Val Macro-F1: {val_f1:.4f}"
        )

        history["epochs"].append(epoch)
        history["train_loss"].append(round(train_loss, 4))
        history["val_loss"].append(round(val_metrics.get("val_loss", 0.0), 4))
        history["val_macro_f1"].append(round(val_f1, 4))
        history["val_accuracy"].append(round(val_acc, 4))

        if val_f1 > best_macro_f1:
            best_macro_f1 = val_f1
            best_metrics = val_metrics
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            print(f"  [+] New best Stage 1 Macro-F1: {best_macro_f1:.4f}")

    # -------------------------------------------------------------
    # STAGE 2: Fine-Tuning Upper Backbone Layers
    # -------------------------------------------------------------
    if stage2_epochs > 0:
        print("\n" + "=" * 60)
        print("[*] STARTING STAGE 2: Fine-Tuning Upper Backbone Layers")
        print("=" * 60)
        model.unfreeze_upper_layers()

        optimizer_ft = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=fine_tune_lr, weight_decay=weight_decay)
        scheduler_ft = CosineAnnealingLR(optimizer_ft, T_max=max(stage2_epochs, 1), eta_min=1e-7)

        for epoch in range(1, stage2_epochs + 1):
            global_epoch = stage1_epochs + epoch
            t0 = time.time()
            train_loss, throughput = train_single_epoch(model, train_loader, criterion, optimizer_ft, device, scaler=scaler, use_amp=use_amp)
            scheduler_ft.step()

            val_metrics = evaluate_model(model, val_loader, device, class_names)
            val_f1 = val_metrics["macro_f1"]
            val_acc = val_metrics["accuracy"]
            elapsed = time.time() - t0

            print(
                f"Epoch {global_epoch:2d}/{stage1_epochs + stage2_epochs:2d} (Stage 2) [{elapsed:.1f}s, {throughput:.1f} img/s] | "
                f"Train Loss: {train_loss:.4f} | "
                f"Val Acc: {val_acc:.4f} | "
                f"Val Macro-F1: {val_f1:.4f}"
            )

            history["epochs"].append(global_epoch)
            history["train_loss"].append(round(train_loss, 4))
            history["val_loss"].append(round(val_metrics.get("val_loss", 0.0), 4))
            history["val_macro_f1"].append(round(val_f1, 4))
            history["val_accuracy"].append(round(val_acc, 4))

            if val_f1 > best_macro_f1:
                best_macro_f1 = val_f1
                best_metrics = val_metrics
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
                epochs_no_improve = 0
                print(f"  [+] New best Stage 2 Macro-F1: {best_macro_f1:.4f}")
            else:
                epochs_no_improve += 1
                if epochs_no_improve >= patience:
                    print(f"  [!] Early stopping triggered (no improvement in {patience} epochs).")
                    break

    # Restore best checkpoint
    if best_state_dict is not None:
        model.load_state_dict(best_state_dict)

    # -------------------------------------------------------------
    # TEST SET FINAL EVALUATION
    # -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("[*] Running Final Evaluation on Unseen Test Partition...")
    print("=" * 60)
    test_metrics = evaluate_model(model, test_loader, device, class_names)
    print(f"Test Accuracy        : {test_metrics['accuracy']:.4f} ({test_metrics['accuracy']*100:.2f}%)")
    print(f"Test Macro-Precision : {test_metrics['macro_precision']:.4f}")
    print(f"Test Macro-Recall    : {test_metrics['macro_recall']:.4f}")
    print(f"Test Macro-F1        : {test_metrics['macro_f1']:.4f}")
    print(f"Test Weighted-F1     : {test_metrics['weighted_f1']:.4f}")
    print(f"Avg Inference Latency: {test_metrics['avg_latency_ms']:.2f} ms/sample")

    total_training_time = round(time.time() - start_time, 2)
    print(f"\n[*] Total Training Time: {total_training_time:.2f} seconds")

    # -------------------------------------------------------------
    # SAVE MODEL CHECKPOINTS & METADATA
    # -------------------------------------------------------------
    models_dir = PROJECT_ROOT / "models" / "disease"
    models_dir.mkdir(parents=True, exist_ok=True)

    checkpoint_payload = {
        "architecture": architecture,
        "class_names": class_names,
        "num_classes": len(class_names),
        "model_state_dict": model.state_dict(),
        "val_metrics": best_metrics,
        "test_metrics": test_metrics,
        "training_time_s": total_training_time,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    # Save to primary locations
    pt_path1 = models_dir / "best_model.pt"
    pt_path2 = models_dir / "plantvillage_model.pt"
    pt_path3 = models_dir / "best_model_robust.pt"

    torch.save(checkpoint_payload, pt_path1)
    torch.save(checkpoint_payload, pt_path2)
    torch.save(checkpoint_payload, pt_path3)
    print(f"[OK] Saved model checkpoints to:\n  - {pt_path1}\n  - {pt_path2}\n  - {pt_path3}")

    # Also save to ai/models/disease if present
    ai_models_dir = PROJECT_ROOT / "ai" / "models" / "disease"
    if ai_models_dir.exists():
        torch.save(checkpoint_payload, ai_models_dir / "best_model.pt")

    # Save class_names.json
    with open(models_dir / "class_names.json", "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=2)

    # Save training summary config
    config_summary = {
        "model_name": "AgriSmart-AI PlantVillage Disease Classifier",
        "dataset_source": "spMohanty/PlantVillage-Dataset",
        "total_classes": num_classes,
        "architecture": architecture,
        "best_val_macro_f1": best_macro_f1,
        "test_accuracy": test_metrics["accuracy"],
        "test_macro_f1": test_metrics["macro_f1"],
        "test_weighted_f1": test_metrics["weighted_f1"],
        "latency_ms_per_image": test_metrics["avg_latency_ms"],
        "training_time_seconds": total_training_time,
        "history": history
    }
    with open(models_dir / "model_config.json", "w", encoding="utf-8") as f:
        json.dump(config_summary, f, indent=2)
    print(f"[OK] Saved model configuration and history to {models_dir / 'model_config.json'}")

    return {
        "best_val_macro_f1": best_macro_f1,
        "test_metrics": test_metrics,
        "training_time": total_training_time
    }


def main():
    parser = argparse.ArgumentParser(description="Train PlantVillage Crop Disease Classifier")
    parser.add_argument("--architecture", type=str, default="mobilenet_v3_large",
                        choices=["mobilenet_v3_large", "mobilenet_v3_small", "efficientnet_b0", "resnet50"],
                        help="Transfer-learning backbone architecture (default: mobilenet_v3_large)")
    parser.add_argument("--epochs-stage1", type=int, default=5, help="Epochs for Stage 1 head warmup (default: 5)")
    parser.add_argument("--epochs-stage2", type=int, default=15, help="Epochs for Stage 2 fine-tuning (default: 15)")
    parser.add_argument("--batch-size", type=int, default=64, help="Mini-batch size (default: 64)")
    parser.add_argument("--lr", type=float, default=1e-3, help="Stage 1 learning rate (default: 0.001)")
    parser.add_argument("--fine-tune-lr", type=float, default=1e-4, help="Stage 2 learning rate (default: 0.0001)")
    parser.add_argument("--weight-decay", type=float, default=1e-4, help="AdamW weight decay (default: 0.0001)")
    parser.add_argument("--dropout", type=float, default=0.3, help="Dropout probability (default: 0.3)")
    parser.add_argument("--patience", type=int, default=4, help="Early stopping patience in epochs (default: 4)")
    parser.add_argument("--device", type=str, default="auto", help="Compute device ('cpu', 'cuda', 'auto')")

    args = parser.parse_args()

    run_training(
        architecture=args.architecture,
        stage1_epochs=args.epochs_stage1,
        stage2_epochs=args.epochs_stage2,
        batch_size=args.batch_size,
        lr=args.lr,
        fine_tune_lr=args.fine_tune_lr,
        weight_decay=args.weight_decay,
        dropout=args.dropout,
        patience=args.patience,
        device_name=args.device
    )


if __name__ == "__main__":
    main()
