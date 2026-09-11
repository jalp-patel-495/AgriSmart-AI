# AgriSmart AI – System Architecture

## Overview
AgriSmart AI is organized into distinct, modular layers to ensure clear separation of concerns between data preparation, model training, API serving, and frontend user experience.

```
+-------------------------------------------------------------+
|                      Farmer / Agronomist                    |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|               Frontend (React + Vanilla CSS)                |
|  - Farmer Dashboard                                         |
|  - Leaf Image Upload & Drag-and-Drop Dropzone               |
|  - Real-time Visual Inspection & Disease Diagnosis Result   |
+-------------------------------------------------------------+
                               |  HTTP / REST (JSON + Multipart)
                               v
+-------------------------------------------------------------+
|                   Backend (FastAPI Server)                  |
|  - CORS & Security Middleware                               |
|  - Health-check & Diagnostics (/api/health)                 |
|  - Inference Controller (/api/v1/predict)                   |
|  - Treatment & Preventive Advisory Mapping                  |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|            AI Inference Engine (PyTorch / TorchScript)      |
|  - Image Normalization & Tensor Transforms                  |
|  - Crop Disease Classifier (Deep CNN / EfficientNet)        |
|  - Confidence Scoring & Softmax Probabilities               |
|  - Grad-CAM Explainability Attention Heatmaps               |
+-------------------------------------------------------------+
                               ^
                               | Model Weights (.pth)
+-------------------------------------------------------------+
|                 Model Training Pipeline (ai_model/)         |
|  - Supervised Training with PyTorch                         |
|  - CrossEntropyLoss + AdamW Optimizer                       |
|  - EarlyStopping & Model Checkpointing                      |
+-------------------------------------------------------------+
                               ^
                               | PyTorch DataLoader
+-------------------------------------------------------------+
|          Dataset Preparation Pipeline (dataset/)            |
|  - Raw Ingestion & OpenCV Image Validation                  |
|  - Pandas Metadata Manifest & Stratified Train/Val/Test     |
|  - Albumentations Augmentations (Rotation, Flips, Noise)    |
|  - Normalized 224x224 RGB Image Export                      |
+-------------------------------------------------------------+
```

---

## Component Roles

### 1. Dataset Layer (`dataset/`)
- Responsible for validating image files, removing corrupted data, standardizing image dimensions (e.g. 224x224 RGB), and creating reproducible dataset partitions (Train, Validation, Test).
- Incorporates Albumentations transformations to simulate variable lighting, camera angles, and outdoor farm conditions.

### 2. AI Model Layer (`ai_model/`)
- Houses model architecture definitions, training loop scripts, learning rate schedulers, and hyperparameter configuration files.
- Exports trained model checkpoints for the backend inference service.

### 3. Backend Layer (`backend/`)
- High-performance asynchronous REST API powered by FastAPI.
- Handles image payload parsing, model forward pass execution, and enrichment of raw predictions with agricultural advice and organic/chemical treatments.

### 4. Frontend Layer (`frontend/`)
- Client application enabling farmers to take leaf photos or upload existing field images.
- Displays immediate visual feedback, disease diagnosis, confidence metrics, and preventative agronomic advice.
