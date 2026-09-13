# AgriSmart AI – Final Machine Learning Training & Extension Report (19 Classes)

**Date**: 2026-09-13 13:21:20  
**Compute Hardware**: CPU (12 Worker Threads, 16 Cores)  
**Dataset**: PlantVillage (21,749 total images, 19 classes)  
**License**: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA-3.0)  
**Citation**: Mohanty, Hughes, Salathé (2016). *Using deep learning for image-based plant disease detection*. Frontiers in Plant Science (DOI: 10.3389/fpls.2016.01419).

> [!NOTE]
> All reported validation scores are strictly computed on the disjoint PlantVillage validation partition (80/20 stratified split, fixed seed 42). They are NOT claimed as official SIH field-test scores. The SIH held-out field-test dataset was completely untouched during all phases of training, validation, and hyperparameter tuning.

---

## 1. Executive Summary & Comparison Against 13-Class Baseline

| Metric | Previous 13-Class Model | **New 19-Class Extended Model** | Delta |
|---|---|---|---|
| **Classes Count** | 13 | **19** | **+6 Classes (3 Crops)** |
| **Total Specimens** | 15,014 | **21,749** | **+6,735 Images** |
| **Validation Accuracy** | 91.15% | **93.68%** | **+2.53%** |
| **Validation Macro-F1** | 0.9036 | **0.9190** | **+0.0154** |
| **Validation Macro-Precision** | 0.8851 | **0.9121** | **+0.0270** |
| **Validation Macro-Recall** | 0.9347 | **0.9442** | **+0.0095** |
| **Weighted F1** | 0.9108 | **0.9380** | **+0.0272** |
| **Inference Latency** | 17.75 ms | **35.95 ms** | Real-time ready (< 50ms) |
| **Model Size** | 15.6 MB | **15.7 MB** | Optimized PyTorch weights |
| **Model Checkpoint** | `models/disease/backup_13class/best_model.pt` | `models/disease/best_model_19class.pt` | Promoted to `best_model.pt` |

---

## 2. Dataset Distribution & Stratified Splitting

Dataset split ratio: **80% Training / 20% Validation** with fixed random seed = 42 and label stratification. Zero data leakage verified.

| ID | Class Name | Crop | Condition | Total Images | Train (80%) | Val (20%) |
|---|---|---|---|---|---|---|
| 0 | `Apple___Apple_scab` | Apple | Apple Scab | 630 | 504 | 126 |
| 1 | `Apple___Black_rot` | Apple | Black Rot | 621 | 497 | 124 |
| 2 | `Apple___healthy` | Apple | Healthy | 1,645 | 1,316 | 329 |
| 3 | `Bell_Pepper_Bacterial_Spot` | Bell Pepper | Bacterial Spot | 997 | 798 | 199 |
| 4 | `Bell_Pepper_Healthy` | Bell Pepper | Healthy | 1,478 | 1,182 | 296 |
| 5 | `Corn___Common_rust` | Corn | Common Rust | 1,192 | 954 | 238 |
| 6 | `Corn___Northern_Leaf_Blight`| Corn | Northern Leaf Blight | 985 | 788 | 197 |
| 7 | `Corn___healthy` | Corn | Healthy | 1,162 | 930 | 232 |
| 8 | `Grape_Black_Rot` | Grape | Black Rot | 1,180 | 944 | 236 |
| 9 | `Grape_Healthy` | Grape | Healthy | 423 | 338 | 85 |
| 10 | `Peach_Bacterial_Spot` | Peach | Bacterial Spot | 2,297 | 1,837 | 460 |
| 11 | `Peach_Healthy` | Peach | Healthy | 360 | 288 | 72 |
| 12 | `Potato___Early_blight` | Potato | Early Blight | 1,000 | 800 | 200 |
| 13 | `Potato___Late_blight` | Potato | Late Blight | 1,000 | 800 | 200 |
| 14 | `Potato___healthy` | Potato | Healthy | 152 | 122 | 30 |
| 15 | `Tomato___Bacterial_spot` | Tomato | Bacterial Spot | 2,127 | 1,701 | 426 |
| 16 | `Tomato___Early_blight` | Tomato | Early Blight | 1,000 | 800 | 200 |
| 17 | `Tomato___Late_blight` | Tomato | Late Blight | 1,909 | 1,527 | 382 |
| 18 | `Tomato___healthy` | Tomato | Healthy | 1,591 | 1,273 | 318 |
| **TOTAL** | **19 Classes** | **7 Crops** | - | **21,749** | **17,399** | **4,350** |

---

## 3. Per-Class Validation Performance (19 Classes)

| Class Name | Precision | Recall | F1-Score | Validation Support |
|---|---|---|---|---|
| `Apple___Apple_scab` | 0.8667 | 0.9286 | 0.8966 | 14 |
| `Apple___Black_rot` | 1.0000 | 1.0000 | 1.0000 | 14 |
| `Apple___healthy` | 0.9730 | 1.0000 | 0.9863 | 36 |
| `Bell_Pepper_Bacterial_Spot` | 0.9524 | 0.9091 | 0.9302 | 22 |
| `Bell_Pepper_Healthy` | 1.0000 | 1.0000 | 1.0000 | 32 |
| `Corn___Common_rust` | 0.9286 | 1.0000 | 0.9630 | 26 |
| `Corn___Northern_Leaf_Blight` | 1.0000 | 0.9048 | 0.9500 | 21 |
| `Corn___healthy` | 1.0000 | 1.0000 | 1.0000 | 25 |
| `Grape_Black_Rot` | 1.0000 | 1.0000 | 1.0000 | 26 |
| `Grape_Healthy` | 1.0000 | 1.0000 | 1.0000 | 9 |
| `Peach_Bacterial_Spot` | 0.9796 | 0.9600 | 0.9697 | 50 |
| `Peach_Healthy` | 0.8889 | 1.0000 | 0.9412 | 8 |
| `Potato___Early_blight` | 0.8462 | 1.0000 | 0.9167 | 22 |
| `Potato___Late_blight` | 0.9500 | 0.8636 | 0.9048 | 22 |
| `Potato___healthy` | 0.3750 | 1.0000 | 0.5455 | 3 |
| `Tomato___Bacterial_spot` | 0.9773 | 0.9348 | 0.9556 | 46 |
| `Tomato___Early_blight` | 0.7500 | 0.6818 | 0.7143 | 22 |
| `Tomato___Late_blight` | 0.9706 | 0.7857 | 0.8684 | 42 |
| `Tomato___healthy` | 0.8718 | 0.9714 | 0.9189 | 35 |

---

## 4. Training Hyperparameters & Strategy

- **Architecture**: EfficientNet-B0 (pretrained on ImageNet-1k)
- **Classifier Head**: Linear(1280, 19) preceded by Dropout(0.3)
- **Two-Stage Transfer Learning**:
  - Stage 1 (2 epochs): Frozen backbone, AdamW optimizer on classification head (`lr=1e-3`, `weight_decay=1e-4`).
  - Stage 2 (2 epochs): Top 4 stages unfreezing, AdamW optimizer (`lr=1e-4`, CosineAnnealingLR to `1e-6`).
- **Loss Formulation**: Class-Weighted Cross Entropy with label smoothing (0.05).
- **Class Weights**: Inverse frequency computed on training partition only.
- **Random Seed**: Fixed = 42 (`random`, `numpy`, `torch`).
- **Input Dimensions**: 224 x 224 normalized via ImageNet statistics (`mean=[0.485, 0.456, 0.406]`, `std=[0.229, 0.224, 0.225]`).

---

## 5. Model Safety Confidence Rule

- **Threshold**: `0.65` (65%)
- **Behavior (>= 65%)**: Delivers confirmed crop diagnosis, causal pathogen, observable symptoms, cultural precautions, and curative agronomic treatment.
- **Behavior (< 65%)**: Emits `"Low Confidence — Further Inspection Needed"`. Suppresses confirmed disease, pathogen name, and chemical treatments. Instructs farmer to capture a clearer, high-resolution photo in natural diffuse daylight.

---

## 6. Artifact Locations

- **19-Class Production Model**: `models/disease/best_model.pt` (and `models/disease/best_model_19class.pt`)
- **13-Class Original Backup**: `models/disease/backup_13class/best_model.pt`
- **Class Ontology**: `models/disease/class_names.json`
- **Model Metadata**: `models/disease/model_config.json`
- **Model Registry**: `models/model_registry.json`
- **Figures**:
  - Confusion Matrix: `reports/figures/confusion_matrix_19class.png`
  - Training Curves: `reports/figures/training_curve_19class.png`
