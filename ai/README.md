# AgriSmart AI – Computer Vision & Machine Learning Core

## Architecture Overview
AgriSmart AI features a **Unified Crop + Disease Detection** engine built on top of 2-stage transfer learning. Rather than using disconnected models, every class dynamically represents `CROP + DISEASE` (e.g. `Tomato___Early_blight`), outputting both crop species and pathogen classification in a single, high-throughput forward pass.

---

## Benchmarked Vision Architectures
Five ImageNet-pretrained transfer learning backbones were systematically trained and evaluated:
1. **EfficientNet-B0** (Selected Winner – Macro-F1: 0.8175)
2. **ResNet50**
3. **DenseNet121**
4. **MobileNetV3**
5. **ConvNeXt-Tiny**

### Primary Selection Metric: **Macro-F1**
Final model selection is based strictly on Validation Macro-F1 to handle class imbalances properly.

---

## Directory Layout
```
├── configs/
│   └── config.yaml               # Hyperparameters, augmentation, training config
├── models/
│   ├── disease/
│   │   ├── best_model.pt         # Winning model checkpoint
│   │   ├── efficientnet_b0.pt    # Individual model checkpoints
│   │   ├── resnet50.pt
│   │   ├── densenet121.pt
│   │   ├── mobilenet_v3.pt
│   │   ├── convnext_tiny.pt
│   │   ├── class_names.json      # Dynamic class index mapping
│   │   └── model_config.json     # Architecture and threshold metadata
│   └── model_registry.json       # Central model registry with verified metrics
├── reports/
│   ├── figures/
│   │   ├── confusion_matrix.png
│   │   ├── training_curve.png
│   │   ├── model_comparison.png
│   │   └── class_distribution.png
│   ├── disease_model_comparison.csv
│   ├── disease_model_comparison.md
│   ├── final_model_report.md
│   └── data_validation_report.md
├── scripts/
│   └── validate_data.py          # PlantVillage dataset auditor & integrity check
├── src/
│   ├── disease/                  # Data loaders, augmentation, training, evaluation
│   ├── pipeline/
│   │   └── image_analysis.py     # Backend-ready unified prediction entrypoint
│   ├── crop_recommendation/      # Auxiliary modules (Real dataset gated)
│   ├── irrigation/
│   ├── stress/
│   ├── yield_prediction/
│   ├── weather/                  # Weather intelligence rule engine
│   ├── sustainability/           # 0-100 agricultural sustainability scoring
│   ├── assistant/                # Multi-lingual farmer advisory (EN/GU/HI)
│   └── agent/                    # Multi-factor agentic advisor
├── train_all.py                  # Master training command
├── predict.py                    # Standalone CLI prediction tool
└── requirements.txt
```

---

## Execution Commands

### 1. Validate Dataset Integrity
```bash
python scripts/validate_data.py
```

### 2. Run Master Training & Benchmark
```bash
python train_all.py
```

### 3. Run Inference on Any Plant Leaf Image
```bash
python predict.py "path/to/leaf_image.jpg"
```

---

## Backend Integration
Your existing backend can import the prediction engine directly without reloading model weights:

```python
from ai.src.pipeline.image_analysis import analyze_image

# Run inference with model caching & confidence verification
result = analyze_image("path/to/leaf.jpg", confidence_threshold=0.60)
print(result)
```

**JSON Output Format:**
```json
{
    "status": "success",
    "crop": "Tomato",
    "crop_confidence": 0.942,
    "disease": "Early Blight",
    "disease_confidence": 0.915,
    "confidence": 0.915,
    "class": "Tomato___Early_blight",
    "top_predictions": [
        {
            "class": "Tomato___Early_blight",
            "crop": "Tomato",
            "disease": "Early Blight",
            "confidence": 0.915
        },
        {
            "class": "Tomato___Late_blight",
            "crop": "Tomato",
            "disease": "Late Blight",
            "confidence": 0.041
        }
    ],
    "pathogen": "Alternaria solani (Fungus)",
    "symptoms": "Dark brown spots with characteristic concentric rings.",
    "prevention": "Rotate with non-solanaceous crops every 2-3 years.",
    "management": "Remove lower infected foliage and apply preventative bio-fungicides.",
    "advice": "Water at the soil level using drip irrigation to keep foliage dry."
}
```
