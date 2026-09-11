# AgriSmart AI – Intelligent Crop Health & Disease Diagnostic Platform

AgriSmart AI is an end-to-end intelligent agricultural diagnosis and advisory system designed to empower farmers and agronomists with early plant disease detection, severity assessment, and actionable treatment recommendations.

---

## 🌾 Project Roadmap

- **Phase 1: Project Setup & Dataset Preparation** *(Current)*
  - Modular project structure (Frontend, Backend, AI Model, Dataset, Docs)
  - Python AI development environment setup
  - Disease ontology definition (15+ key crop-disease classes)
  - Dataset ingestion, validation, and preprocessing pipeline (OpenCV, Pandas)
  - Data augmentation and transformations (Albumentations)
  - Stratified Train/Val/Test partitioning and PyTorch Dataset integration
  - Git repository versioning and documentation
- **Phase 2: Deep Learning Model Architecture & Training**
  - Convolutional Neural Network (CNN) / Vision Transformer (ViT) model implementation
  - Transfer learning with EfficientNet / ResNet architectures
  - Training metrics, loss optimization, validation curves, and model checkpointing
- **Phase 3: Model Evaluation, Explainability & Optimization**
  - Confusion matrix, precision/recall/F1 evaluation
  - Grad-CAM heatmap explainability to highlight affected leaf areas
  - ONNX / TorchScript optimization for low-latency inference
- **Phase 4: Backend REST API & Integration**
  - FastAPI server with image inference pipelines
  - Real-time prediction endpoint, confidence scoring, and advisory mapping
- **Phase 5: Interactive Farmer Dashboard & Frontend**
  - Responsive React UI with drag-and-drop leaf image diagnosis
  - Disease identification report, symptom breakdown, and treatment guidance

---

## 📁 Repository Structure

```
AGRISMART_AI/
├── .vscode/               # VS Code workspace settings
├── docs/                  # Architectural and dataset documentation
│   ├── ARCHITECTURE.md
│   └── DATASET_GUIDE.md
├── dataset/               # Dataset storage and preparation scripts
│   ├── classes.json       # Defined crop disease classes and descriptions
│   ├── raw/               # Raw image directory structured by class
│   ├── processed/         # Preprocessed, resized, and normalized images
│   ├── splits/            # Train, validation, and test CSV manifests
│   ├── scripts/
│   │   ├── sample_generator.py  # Generates test dataset samples
│   │   ├── dataset_prep.py      # OpenCV + Pandas + Albumentations pipeline
│   │   └── verify_dataset.py    # PyTorch DataLoader & integrity verifier
│   └── requirements.txt
├── ai_model/              # AI training code, configurations, and models
│   ├── configs/           # Model hyperparameter configs
│   ├── models/            # Saved weights and exported checkpoints
│   └── README.md
├── backend/               # FastAPI REST API backend
│   ├── app/
│   ├── requirements.txt
│   └── main.py
├── frontend/              # React.js Farmer Dashboard
│   ├── src/
│   └── package.json
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start – Phase 1

### 1. Prerequisites
- Python 3.10+ (Tested with Python 3.12)
- Node.js 18+ (for frontend)
- Git

### 2. Dataset Pipeline Setup
```powershell
# Navigate to dataset directory
cd dataset

# Install required AI/CV packages
pip install -r requirements.txt

# (Optional) Generate sample dataset for testing
python scripts/sample_generator.py

# Run dataset preprocessing and augmentation pipeline
python scripts/dataset_prep.py

# Verify PyTorch Dataset loader and class distribution
python scripts/verify_dataset.py
```

---

## 🧪 Libraries & Tech Stack

| Component | Technologies |
|---|---|
| **AI / Machine Learning** | Python, PyTorch, Torchvision, Albumentations, OpenCV, NumPy, Pandas |
| **Backend** | FastAPI, Uvicorn, Pydantic |
| **Frontend** | React.js, JavaScript, HTML5, Vanilla CSS |
| **Tools & Version Control**| VS Code, Git, GitHub |
