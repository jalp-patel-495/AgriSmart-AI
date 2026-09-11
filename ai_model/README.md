# AgriSmart AI – Model Training & Inference Architecture

This directory houses the deep learning model definitions, training loops, evaluation metrics, and exported weights for crop disease diagnosis.

## Structure
- `configs/` - Hyperparameter configuration files (YAML).
- `models/` - Checkpoint storage for trained weights (`.pth`, `.onnx`, `.pt`).
- `src/` - Model architectures (CNN, ResNet-50, EfficientNet-B0, MobileNetV3).

## Phase 2 Roadmap
- Implementation of PyTorch Vision models with Transfer Learning.
- Cross-entropy loss with Label Smoothing and AdamW optimizer.
- Validation checkpointing with EarlyStopping.
- Explainable AI (XAI) using Grad-CAM attention maps.
