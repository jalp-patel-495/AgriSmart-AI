# AgriSmart AI – PlantVillage Dataset Validation Report

**Audit Date**: 2026-09-12  
**Dataset Path**: `J:\AGRISMART_AI\dataset\raw`  
**Status**: VERIFIED & READY

---

## 1. Dataset Overview

| Metric | Result |
|---|---|
| **Total Images Discovered** | 21,749 |
| **Classes Discovered** | 19 classes |
| **Integrity Verified Images** | 21,749 |
| **Corrupted Images** | 0 |
| **Identified Exact Duplicates** | 2 |
| **Train/Validation Partition Leakage** | 0 (Zero Leakage) |

---

## 2. Dynamic Class Distribution

| Class ID | Canonical Class Name | Image Count | Distribution % |
|---|---|---|---|
| 0 | `Apple___Apple_scab` | 630 | 2.9% |
| 1 | `Apple___Black_rot` | 621 | 2.86% |
| 2 | `Apple___healthy` | 1,645 | 7.56% |
| 3 | `Bell_Pepper_Bacterial_Spot` | 997 | 4.58% |
| 4 | `Bell_Pepper_Healthy` | 1,478 | 6.8% |
| 5 | `Corn___Common_rust` | 1,192 | 5.48% |
| 6 | `Corn___healthy` | 1,162 | 5.34% |
| 7 | `Corn___Northern_Leaf_Blight` | 985 | 4.53% |
| 8 | `Grape_Black_Rot` | 1,180 | 5.43% |
| 9 | `Grape_Healthy` | 423 | 1.94% |
| 10 | `Peach_Bacterial_Spot` | 2,297 | 10.56% |
| 11 | `Peach_Healthy` | 360 | 1.66% |
| 12 | `Potato___Early_blight` | 1,000 | 4.6% |
| 13 | `Potato___healthy` | 152 | 0.7% |
| 14 | `Potato___Late_blight` | 1,000 | 4.6% |
| 15 | `Tomato___Bacterial_spot` | 2,127 | 9.78% |
| 16 | `Tomato___Early_blight` | 1,000 | 4.6% |
| 17 | `Tomato___healthy` | 1,591 | 7.32% |
| 18 | `Tomato___Late_blight` | 1,909 | 8.78% |

---

## 3. Resolution & Dimensionality Audit

| Dimension (Width x Height) | Occurrences | Percentage |
|---|---|---|
| 256x256 | 21,749 | 100.0% |

---

## 4. Integrity & Leakage Assessment

- **File Validity**: 21749 valid image files successfully decoded with PIL Image.
- **Corruptions Detected**: 0 corrupted files.
- **Data Leakage Check**: Train and validation partitions are verified disjoint with 0 overlapping samples.
- **Preprocessing Action**: Images are standardized via PyTorch torchvision transforms to 224x224 RGB tensors normalized using ImageNet mean & standard deviation.
