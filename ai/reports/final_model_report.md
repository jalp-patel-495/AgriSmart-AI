# AgriSmart AI – Final Machine Learning Training Report

**Date**: 2026-09-12 18:15:49  
**Hardware Engine**: CPU (CPU Optimized)  
**Dataset**: PlantVillage (15,014 specimens, 13 classes)  

---

## 1. Crop + Disease Detection Multi-Model Comparison

Primary Selection Metric: **Validation Macro-F1**

| Model | Architecture | Macro-F1 | Accuracy | Macro-Precision | Macro-Recall | Weighted-F1 | Latency (ms) | Size (MB) |
|---|---|---|---|---|---|---|---|---|
| **EFFICIENTNET_B0** | `efficientnet_b0` | **0.8175** | 0.8115 | 0.8319 | 0.8257 | 0.8041 | 17.75ms | 15.6 MB |
| **CONVNEXT_TINY** | `convnext_tiny` | **0.7935** | 0.8269 | 0.8626 | 0.8070 | 0.8034 | 40.74ms | 106.2 MB |
| **DENSENET121** | `densenet121` | **0.7158** | 0.7769 | 0.7203 | 0.7415 | 0.7665 | 41.17ms | 27.2 MB |
| **RESNET50** | `resnet50` | **0.6527** | 0.7346 | 0.6827 | 0.6665 | 0.7008 | 45.28ms | 90.1 MB |
| **MOBILENET_V3** | `mobilenet_v3` | **0.6394** | 0.6962 | 0.7053 | 0.6878 | 0.7015 | 8.73ms | 16.3 MB |

### Best Selected Model: **EFFICIENTNET_B0**
- **Macro-F1**: 0.8175
- **Accuracy**: 0.8115
- **Precision**: 0.8319
- **Recall**: 0.8257
- **Clean Macro-F1**: 0.8175 vs **Field Robust Macro-F1**: 0.7541
- **Saved Checkpoint**: `ai/models/disease/best_model.pt`

---

## 2. Auxiliary ML Modules Status

- **Crop Recommendation**: SKIPPED (NOT TRAINED – REAL DATASET REQUIRED (Expected: data/crop_recommendation.csv))
- **Smart Irrigation**: SKIPPED (NOT TRAINED – REAL DATASET REQUIRED (Expected: data/irrigation_data.csv))
- **Crop Stress**: SKIPPED (NOT TRAINED – REAL DATASET REQUIRED (Expected: data/crop_stress.csv))
- **Yield Prediction**: SKIPPED (NOT TRAINED – REAL DATASET REQUIRED (Expected: data/crop_yield.csv))

---

## 3. Generated Artifacts

- **Model Registry**: `ai/models/model_registry.json`
- **Confusion Matrix**: `ai/reports/figures/confusion_matrix.png`
- **Training Progression Curves**: `ai/reports/figures/training_curve.png`
- **Model Comparison Bar Chart**: `ai/reports/figures/model_comparison.png`
- **Class Distribution**: `ai/reports/figures/class_distribution.png`
