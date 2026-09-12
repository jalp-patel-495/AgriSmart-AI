# AgriSmart AI – PlantVillage Dataset Validation Report

**Audit Date**: 2026-09-12  
**Dataset Path**: `J:\AGRISMART_AI\dataset\raw`  
**Status**: VERIFIED & READY

---

## 1. Dataset Overview

| Metric | Result |
|---|---|
| **Total Images Discovered** | 15,014 |
| **Classes Discovered** | 13 classes |
| **Integrity Verified Images** | 15,014 |
| **Corrupted Images** | 0 |
| **Identified Exact Duplicates** | 2 |
| **Train/Validation Partition Leakage** | 0 (Zero Leakage) |

---

## 2. Dynamic Class Distribution

| Class ID | Canonical Class Name | Image Count | Distribution % |
|---|---|---|---|
| 0 | `Apple___Apple_scab` | 630 | 4.2% |
| 1 | `Apple___Black_rot` | 621 | 4.14% |
| 2 | `Apple___healthy` | 1,645 | 10.96% |
| 3 | `Corn___Common_rust` | 1,192 | 7.94% |
| 4 | `Corn___healthy` | 1,162 | 7.74% |
| 5 | `Corn___Northern_Leaf_Blight` | 985 | 6.56% |
| 6 | `Potato___Early_blight` | 1,000 | 6.66% |
| 7 | `Potato___healthy` | 152 | 1.01% |
| 8 | `Potato___Late_blight` | 1,000 | 6.66% |
| 9 | `Tomato___Bacterial_spot` | 2,127 | 14.17% |
| 10 | `Tomato___Early_blight` | 1,000 | 6.66% |
| 11 | `Tomato___healthy` | 1,591 | 10.6% |
| 12 | `Tomato___Late_blight` | 1,909 | 12.71% |

---

## 3. Resolution & Dimensionality Audit

| Dimension (Width x Height) | Occurrences | Percentage |
|---|---|---|
| 256x256 | 15,014 | 100.0% |

---

## 4. Integrity & Leakage Assessment

- **File Validity**: 15014 valid image files successfully decoded with PIL Image.
- **Corruptions Detected**: 0 corrupted files.
- **Data Leakage Check**: Train and validation partitions are verified disjoint with 0 overlapping samples.
- **Preprocessing Action**: Images are standardized via PyTorch torchvision transforms to 224x224 RGB tensors normalized using ImageNet mean & standard deviation.
