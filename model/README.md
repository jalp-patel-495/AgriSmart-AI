# AgriSmart AI – Model Specification & Predict Interface

Conforms to **Submission Contract Section 7.1** (`/model` directory requirement).

---

## 1. Overview
This directory provides the core AI training and inference entry points, including the standardized `predict` interface required by Section 4.1.

- **Task**: 38-Class & 19-Class Crop Leaf Disease and Health Classification
- **Supported Crops (14)**: Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Bell Pepper, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato
- **Architecture**: MobileNetV3-Large / EfficientNet-B0 transfer learning backbones
- **Pre-trained Weights Location**:
  - `models/disease/best_model.pt` (EfficientNet-B0 / MobileNetV3 production weights, ~15.7 MB)
  - `models/disease/class_names.json` (Ontology & class mapping)
  - `models/disease/model_config.json` (Model metadata & configuration)
  *(Weights are committed directly into the repository for zero-setup instant evaluation).*

---

## 2. Standard Predict Interface (Section 4.1)

### CLI Usage:
```bash
python model/predict.py <path_to_leaf_image.jpg>
```
*Example:*
```bash
python model/predict.py "dataset/.plantvillage_cache/raw/color/Apple___Apple_scab/00075aa8-d81a-4184-8541-b692b78d398a___FREC_Scab 3335.JPG"
```

### Python API Usage:
```python
from model.predict import predict

result = predict("path/to/leaf_image.jpg")
print(result["crop"])       # e.g., 'Apple'
print(result["disease"])    # e.g., 'Apple Scab'
print(result["confidence"]) # e.g., 0.9412
print(result["pathogen"])   # e.g., 'Venturia inaequalis (Fungus)'
print(result["advice"])     # Agronomic recommendations
```

---

## 3. Model Training Interface

To run the two-stage transfer learning pipeline:
```bash
python model/train.py --architecture mobilenet_v3_large --epochs-stage1 8 --epochs-stage2 20 --batch-size 32
```
