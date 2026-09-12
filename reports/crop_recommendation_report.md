# AgriSmart AI – Crop Recommendation Benchmark Report

**Date**: 2026-09-12 18:44:03  
**Dataset**: `Crop_recommendation.csv` (2200 specimens across 22 crops)  
**Validation Split**: 20% Stratified (Seed=42)  
**Selection Metric**: **Macro-F1**

| Model | Macro F1 | Accuracy | Macro Precision | Macro Recall | Weighted F1 | Inference Latency (ms) | Training Time (s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Random Forest | 0.9955 | 0.9955 | 0.9957 | 0.9955 | 0.9955 | 0.15 | 0.224 |
| LightGBM | 0.9886 | 0.9886 | 0.9891 | 0.9886 | 0.9886 | 0.02 | 0.52 |
| Gradient Boosting | 0.9863 | 0.9864 | 0.987 | 0.9864 | 0.9863 | 0.06 | 9.553 |
| XGBoost | 0.9862 | 0.9864 | 0.9874 | 0.9864 | 0.9862 | 0.01 | 2.244 |

### Selected Champion: **Random Forest**
- **Validation Macro-F1**: `0.9955`
- **Validation Accuracy**: `0.9955`
- **Validation Precision**: `0.9957`
- **Validation Recall**: `0.9955`
- **Saved Model**: `models/crop_recommendation/best_model.pkl`
