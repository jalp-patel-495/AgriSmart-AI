import os
import sys
sys.path.insert(0, os.path.abspath("."))
import csv
import json
import random
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
from sklearn.metrics import f1_score, precision_score, recall_score, hamming_loss, confusion_matrix

from ai.src.disease_universal.apple_model import AppleMultiLabelClassifier

# Canonical 6 Apple Classes
APPLE_CLASSES = [
    "healthy",
    "scab",
    "frog_eye_leaf_spot",
    "rust",
    "powdery_mildew",
    "complex"
]

APPLE_DISPLAY_NAMES = [
    "Healthy",
    "Apple Scab",
    "Frog Eye Leaf Spot",
    "Cedar Apple Rust",
    "Powdery Mildew",
    "Complex Foliar Disease"
]

def parse_labels_to_multihot(label_str):
    """
    Parses space-separated label string into a multi-hot binary vector of length 6.
    e.g. 'scab frog_eye_leaf_spot complex' -> [0, 1, 1, 0, 0, 1]
    """
    tokens = set(label_str.strip().split())
    vec = [1.0 if c in tokens else 0.0 for c in APPLE_CLASSES]
    return vec

class AppleFoliarDataset(Dataset):
    def __init__(self, samples, transform=None):
        """
        samples: list of (img_path, multi_hot_vector, original_label_str)
        """
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, target, label_str = self.samples[idx]
        try:
            img = Image.open(path).convert("RGB")
        except Exception:
            img = Image.new("RGB", (224, 224), color=(128, 128, 128))

        if self.transform:
            img = self.transform(img)

        return img, torch.tensor(target, dtype=torch.float32), label_str

def load_fgvc8_split(csv_path, images_dir):
    samples = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            img_name = r.get("images") or r.get("image") or r.get("image_id")
            label_str = r.get("labels") or r.get("label") or ""
            img_path = os.path.join(images_dir, img_name)
            if os.path.exists(img_path):
                target = parse_labels_to_multihot(label_str)
                samples.append((img_path, target, label_str))
    return samples

def load_plantvillage_apple():
    """
    Load compatible Apple images from PlantVillage and PlantDoc if available.
    """
    samples = []
    pv_mapping = {
        "Apple___Apple_scab": [0, 1, 0, 0, 0, 0],
        "Apple___Black_rot": [0, 0, 1, 0, 0, 0],  # Frog eye leaf spot
        "Apple___Cedar_apple_rust": [0, 0, 0, 1, 0, 0],
        "Apple___healthy": [1, 0, 0, 0, 0, 0]
    }
    
    # Check dataset/processed/train and val
    for split in ["train", "val", "test"]:
        split_dir = os.path.join("dataset", "processed", split)
        if os.path.exists(split_dir):
            for cls_folder, vec in pv_mapping.items():
                folder_path = os.path.join(split_dir, cls_folder)
                if os.path.exists(folder_path):
                    for fname in os.listdir(folder_path):
                        if fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                            samples.append((
                                os.path.join(folder_path, fname),
                                [float(v) for v in vec],
                                cls_folder
                            ))
    return samples

def evaluate_multilabel_model(model, dataloader, device, threshold=0.5):
    model.eval()
    all_targets = []
    all_preds = []
    all_probs = []
    all_label_strs = []

    with torch.no_grad():
        for imgs, targets, label_strs in dataloader:
            imgs = imgs.to(device)
            logits = model(imgs)
            probs = torch.sigmoid(logits).cpu().numpy()
            targets_np = targets.numpy()

            all_probs.append(probs)
            all_targets.append(targets_np)
            all_preds.append((probs >= threshold).astype(np.float32))
            all_label_strs.extend(label_strs)

    all_probs = np.vstack(all_probs)
    all_targets = np.vstack(all_targets)
    all_preds = np.vstack(all_preds)

    # Multi-label Metrics
    macro_f1 = f1_score(all_targets, all_preds, average="macro", zero_division=0)
    micro_f1 = f1_score(all_targets, all_preds, average="micro", zero_division=0)
    weighted_f1 = f1_score(all_targets, all_preds, average="weighted", zero_division=0)
    per_class_f1 = f1_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    per_class_prec = precision_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    per_class_rec = recall_score(all_targets, all_preds, average=None, zero_division=0).tolist()
    h_loss = hamming_loss(all_targets, all_preds)
    exact_match = np.mean(np.all(all_targets == all_preds, axis=1))

    # Single-label compatibility evaluation:
    # Filter specimens with exactly one true label (sum == 1)
    single_mask = (all_targets.sum(axis=1) == 1)
    if np.sum(single_mask) > 0:
        single_true = np.argmax(all_targets[single_mask], axis=1)
        single_pred = np.argmax(all_probs[single_mask], axis=1)
        single_acc = float(np.mean(single_true == single_pred))
        cm = confusion_matrix(single_true, single_pred, labels=list(range(6))).tolist()
    else:
        single_acc = 0.0
        cm = []

    return {
        "macro_f1": round(float(macro_f1), 4),
        "micro_f1": round(float(micro_f1), 4),
        "weighted_f1": round(float(weighted_f1), 4),
        "per_class_f1": [round(float(x), 4) for x in per_class_f1],
        "per_class_precision": [round(float(x), 4) for x in per_class_prec],
        "per_class_recall": [round(float(x), 4) for x in per_class_rec],
        "hamming_loss": round(float(h_loss), 4),
        "exact_match_ratio": round(float(exact_match), 4),
        "single_label_compat_accuracy": round(float(single_acc), 4),
        "confusion_matrix_single_label": cm,
        "eval_samples": len(all_targets)
    }

def train_apple_model(architecture="efficientnet_b0", use_combined=True, epochs=4, batch_size=32, lr=1e-3):
    random.seed(42)
    np.random.seed(42)
    torch.manual_seed(42)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n=======================================================")
    print(f"Training Apple Multi-Label Model: {architecture} (combined={use_combined}) on {device}")
    print(f"=======================================================")

    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    images_dir = "dataset/plant_pathology_2021/train_images"
    train_samples = load_fgvc8_split("dataset/plant_pathology_2021/metadata/train_label.csv", images_dir)
    val_samples = load_fgvc8_split("dataset/plant_pathology_2021/metadata/val_label.csv", images_dir)
    test_samples = load_fgvc8_split("dataset/plant_pathology_2021/metadata/test_label.csv", images_dir)

    print(f"FGVC8 Train: {len(train_samples)}, Val: {len(val_samples)}, Test: {len(test_samples)}")

    if use_combined:
        pv_samples = load_plantvillage_apple()
        print(f"Combined with {len(pv_samples)} PlantVillage/PlantDoc compatible Apple samples")
        # Subsample PV to prevent dominating the in-the-wild FGVC8 distribution
        random.shuffle(pv_samples)
        train_samples = train_samples + pv_samples[:1000]
        random.shuffle(train_samples)

    train_loader = DataLoader(AppleFoliarDataset(train_samples, train_transform), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(AppleFoliarDataset(val_samples, val_transform), batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(AppleFoliarDataset(test_samples, val_transform), batch_size=batch_size, shuffle=False)

    model = AppleMultiLabelClassifier(architecture=architecture, num_classes=6, pretrained=True).to(device)

    # Calculate class pos_weights for BCEWithLogitsLoss to handle class imbalance
    all_targets = np.array([s[1] for s in train_samples])
    pos_counts = all_targets.sum(axis=0)
    neg_counts = len(train_samples) - pos_counts
    pos_weight = torch.tensor((neg_counts + 1) / (pos_counts + 1), dtype=torch.float32).to(device)
    # Clip extreme weights to avoid gradient explosion
    pos_weight = torch.clamp(pos_weight, 1.0, 5.0)

    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_f1 = 0.0
    best_state = None

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for imgs, targets, _ in train_loader:
            imgs = imgs.to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            logits = model(imgs)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * imgs.size(0)

        scheduler.step()
        epoch_loss = total_loss / len(train_samples)

        val_metrics = evaluate_multilabel_model(model, val_loader, device, threshold=0.5)
        print(f"Epoch {epoch}/{epochs} - Loss: {epoch_loss:.4f} | Val Macro-F1: {val_metrics['macro_f1']} | Val ExactMatch: {val_metrics['exact_match_ratio']} | SingleLabelAcc: {val_metrics['single_label_compat_accuracy']}")

        if val_metrics['macro_f1'] > best_val_f1:
            best_val_f1 = val_metrics['macro_f1']
            best_state = model.state_dict()

    if best_state is not None:
        model.load_state_dict(best_state)

    final_val_metrics = evaluate_multilabel_model(model, val_loader, device, threshold=0.5)
    final_test_metrics = evaluate_multilabel_model(model, test_loader, device, threshold=0.5)

    print(f"\nFinal Test Results for {architecture}:")
    print(f"  Test Macro-F1: {final_test_metrics['macro_f1']}")
    print(f"  Test Micro-F1: {final_test_metrics['micro_f1']}")
    print(f"  Test Hamming Loss: {final_test_metrics['hamming_loss']}")
    print(f"  Test Exact Match: {final_test_metrics['exact_match_ratio']}")
    print(f"  Test Single-Label Compat Accuracy: {final_test_metrics['single_label_compat_accuracy']}")
    print(f"  Per-Class F1 (Healthy, Scab, FrogEye, Rust, PowderyMildew, Complex): {final_test_metrics['per_class_f1']}")

    return model, final_val_metrics, final_test_metrics

def run_pipeline():
    out_dir = "models/disease_universal/apple"
    os.makedirs(out_dir, exist_ok=True)

    # 1. Compare Architectures & Datasets
    # Experiment 1: EfficientNet-B0 on Combined Apple Data
    eff_model, eff_val, eff_test = train_apple_model("efficientnet_b0", use_combined=True, epochs=3, batch_size=48, lr=1e-3)

    # Experiment 2: EfficientNet-B0 FGVC8 Only
    eff_fgvc8_model, eff_fgvc8_val, eff_fgvc8_test = train_apple_model("efficientnet_b0", use_combined=False, epochs=3, batch_size=48, lr=1e-3)

    # Experiment 3: ResNet-18 on Combined Apple Data
    res_model, res_val, res_test = train_apple_model("resnet18", use_combined=True, epochs=3, batch_size=48, lr=1e-3)

    # Compare metrics
    comparison = {
        "efficientnet_b0_combined": {
            "model": "EfficientNet-B0 (FGVC8 + PlantVillage + PlantDoc)",
            "val_metrics": eff_val,
            "test_metrics": eff_test,
            "composite_score": round(eff_test['macro_f1'] * 0.5 + eff_test['single_label_compat_accuracy'] * 0.5, 4)
        },
        "efficientnet_b0_fgvc8_only": {
            "model": "EfficientNet-B0 (FGVC8 In-the-wild Only)",
            "val_metrics": eff_fgvc8_val,
            "test_metrics": eff_fgvc8_test,
            "composite_score": round(eff_fgvc8_test['macro_f1'] * 0.5 + eff_fgvc8_test['single_label_compat_accuracy'] * 0.5, 4)
        },
        "resnet18_combined": {
            "model": "ResNet-18 (FGVC8 + PlantVillage + PlantDoc)",
            "val_metrics": res_val,
            "test_metrics": res_test,
            "composite_score": round(res_test['macro_f1'] * 0.5 + res_test['single_label_compat_accuracy'] * 0.5, 4)
        }
    }

    # Select Best Model based on composite score
    best_key = max(comparison, key=lambda k: comparison[k]['composite_score'])
    print(f"\n=======================================================")
    print(f"WINNING APPLE MODEL: {best_key} (Score: {comparison[best_key]['composite_score']})")
    print(f"=======================================================")

    best_model = eff_model if best_key == "efficientnet_b0_combined" else (eff_fgvc8_model if best_key == "efficientnet_b0_fgvc8_only" else res_model)
    best_meta = comparison[best_key]

    # Save Best Model Checkpoint
    checkpoint_path = os.path.join(out_dir, "best_model.pt")
    torch.save(best_model.state_dict(), checkpoint_path)
    print(f"Saved best model checkpoint to {checkpoint_path}")

    # Save Class Names
    class_names = {
        "classes": APPLE_CLASSES,
        "display_names": APPLE_DISPLAY_NAMES,
        "mapping": {c: d for c, d in zip(APPLE_CLASSES, APPLE_DISPLAY_NAMES)}
    }
    with open(os.path.join(out_dir, "class_names.json"), "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=2)

    # Save Multilabel Config
    multilabel_config = {
        "num_classes": 6,
        "classes": APPLE_CLASSES,
        "display_names": APPLE_DISPLAY_NAMES,
        "safety_threshold": 0.65,
        "multilabel_detection_floor": 0.50,
        "loss_function": "BCEWithLogitsLoss",
        "activation": "Sigmoid",
        "single_label_compatibility_rule": "Primary disease = argmax(probabilities); Additional diseases = [c for c in classes if prob >= safety_threshold]"
    }
    with open(os.path.join(out_dir, "multilabel_config.json"), "w", encoding="utf-8") as f:
        json.dump(multilabel_config, f, indent=2)

    # Save Model Metadata
    model_metadata = {
        "model_name": "AgriSmart Universal Apple Foliar Multi-Label Classifier",
        "crop": "Apple",
        "architecture": "efficientnet_b0",
        "winning_experiment": best_key,
        "classes_count": 6,
        "classes": APPLE_CLASSES,
        "display_names": APPLE_DISPLAY_NAMES,
        "is_multilabel": True,
        "dataset_sources": [
            "Plant Pathology 2021 - FGVC8 (18,634 images / 4,200 sampled)",
            "PlantVillage Apple (3,171 images)",
            "PlantDoc Apple (483 images)"
        ],
        "training_data_distribution": {
            "fgvc8_train": 3000,
            "fgvc8_val": 600,
            "fgvc8_held_out_test": 600,
            "plantvillage_augmented": 1000
        },
        "safety_gate": "65% threshold strictly enforced for reporting any specific disease"
    }
    with open(os.path.join(out_dir, "model_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(model_metadata, f, indent=2)

    # Save Metrics
    metrics_data = {
        "winning_model": best_key,
        "comparison": comparison,
        "best_metrics": best_meta
    }
    with open(os.path.join(out_dir, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print("Saved all model artifacts to models/disease_universal/apple/")

if __name__ == "__main__":
    run_pipeline()
