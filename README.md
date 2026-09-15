# AgriSmart AI – Intelligent Crop Health & Sustainable Agriculture Decision Platform

AgriSmart AI is an end-to-end intelligent agricultural diagnosis and advisory system built for the Smart India Hackathon (SIH 2026). It combines computer vision leaf diagnostics, multi-crop suitability recommendations, smart irrigation decision modeling, live agrometeorological intelligence, deterministic sustainability scoring, and agentic multi-signal arbitration into a unified farmer-first platform.

---

## 📋 GitHub Submission Contract Compliance (Section 7)

This repository strictly complies with all specifications outlined in the **GitHub Submission Contract**:

| Section | Requirement | AgriSmart AI Implementation & Location |
| :--- | :--- | :--- |
| **7.1** | `/README.md` (entry point) | [README.md](file:///j:/AGRISMART_AI/README.md) (Complete architectural guide & run instructions) |
| **7.1** | `/src` or `/app` (source code) | [`/src`](file:///j:/AGRISMART_AI/src) and [`backend/app`](file:///j:/AGRISMART_AI/backend/app) |
| **7.1** | `/model` (training/inference code & predict interface) | [`/model`](file:///j:/AGRISMART_AI/model) containing [`model/predict.py`](file:///j:/AGRISMART_AI/model/predict.py), [`model/train.py`](file:///j:/AGRISMART_AI/model/train.py), and [`model/README.md`](file:///j:/AGRISMART_AI/model/README.md) |
| **7.1** | `/report` (one-page model report) | [`/report`](file:///j:/AGRISMART_AI/report) containing [`report/MODEL_REPORT.md`](file:///j:/AGRISMART_AI/report/MODEL_REPORT.md) and [`report/confusion_matrix.png`](file:///j:/AGRISMART_AI/report/plantvillage_confusion_matrix.png) |
| **7.1** | `requirements.txt` / environment file | [`requirements.txt`](file:///j:/AGRISMART_AI/requirements.txt) at repository root |
| **7.2.1**| Built core + bonus modules | Core (Disease Classifier), Bonus A (Crop Rec.), Bonus B (Smart Irrigation), Bonus C (Weather), Bonus D (Sustainability), Bonus E (Unified Advisor), Bonus G (Agentic Advisor), Enterprise RBAC Federation |
| **7.2.2**| Fast setup & reproducibility (< 10 min) | **~10-second CLI inference**: `python model/predict.py "<path_to_leaf_image.jpg>"` |
| **7.2.3**| Dataset & license | Canonical PlantVillage Dataset (54,305 images, 38 classes, CC-BY-SA 3.0) |
| **7.2.4**| Reported metrics for every model | Macro-F1: **0.9190** (19-class) / **0.9142** (38-class), Accuracy: **93.68%**, confusion matrix embedded |
| **7.2.5**| Architecture & known limitations | Detailed in Section 1 & Section 6 of this document |
| **7.2.6**| Demo video & deployed app link | [Live](https://agrismart-ai-hazel.vercel.app/) \| [Demo Video](https://youtu.be/5m0CMk2zGmI) |

---

## ⚡ 60-Second Judge Reproducibility Check

Judges can verify the core AI inference immediately without setting up servers or downloading external weights:
```bash
# Clone and run inference immediately on included sample leaf (takes < 10 seconds)
python model/predict.py "dataset/.plantvillage_cache/raw/color/Apple___Apple_scab/00075aa8-d81a-4184-8541-b692b78d398a___FREC_Scab 3335.JPG"
```
Output returns structured JSON with verified crop identity, disease classification, confidence calibration, causal pathogen, symptoms, and agronomic management instructions.

---

## 🌾 System Architecture & Modules

### 1. Core Module: Crop Disease Diagnostics (PlantVillage 38-Class Pipeline)
- **Architecture**: MobileNetV3 / EfficientNet transfer learning models trained on verified agricultural leaf specimens from the canonical **PlantVillage Dataset** .
- **Scope**: **38 classes across all 14 crops**:
  - **Apple**: Apple Scab, Black Rot, Cedar Apple Rust, Healthy
  - **Blueberry**: Healthy
  - **Cherry**: Powdery Mildew, Healthy
  - **Corn (Maize)**: Cercospora Leaf Spot (Gray Leaf Spot), Common Rust, Northern Leaf Blight, Healthy
  - **Grape**: Black Rot, Esca (Black Measles), Leaf Blight (Isariopsis Leaf Spot), Healthy
  - **Orange**: Huanglongbing (Citrus Greening)
  - **Peach**: Bacterial Spot, Healthy
  - **Bell Pepper**: Bacterial Spot, Healthy
  - **Potato**: Early Blight, Late Blight, Healthy
  - **Raspberry**: Healthy
  - **Soybean**: Healthy
  - **Squash**: Powdery Mildew
  - **Strawberry**: Leaf Scorch, Healthy
  - **Tomato**: Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Septoria Leaf Spot, Spider Mites (Two-Spotted Spider Mite), Target Spot, Tomato Mosaic Virus, Tomato Yellow Leaf Curl Virus, Healthy
- **Safety Gate**: Strict **65% Confidence Threshold**. For predictions under 65%, the system prompts the farmer for a clearer leaf image in diffuse natural daylight and strictly suppresses unverified pathogen identification and chemical spray recommendations.


### 2. Bonus Module A: Crop Recommendation (22-Crop Production Model)
- **Architecture**: Random Forest Classifier trained on 2,200 real district agro-climatic soil records.
- **Inputs**: Soil Macronutrients ($N, P, K$), Soil $pH$, Temperature ($°C$), Relative Humidity ($\%$), Rainfall ($mm$).
- **Performance**: **99.55% Validation Accuracy**, **0.9955 Validation Macro-F1**.
- **Role**: Field-verified production baseline for agricultural decision-making across 22 canonical Indian staples.

### 3. Experimental Feature: 95-Crop Recommendation (`⚠️ EXPERIMENTAL`)
- **Architecture**: Gradient-boosted multi-class classification model trained on literature tolerance envelopes.
- **Scope**: 95 global and high-value commercial crop classes spanning cereals, pseudo-grains, pulses, vegetables, fruits, spices, plantation, and medicinal crops.
- **Provenance Disclosure**: Trained on synthetic feature distributions bounded by literature tolerances from FAO Ecocrop and ICAR package-of-practices bulletins.
- **Display Requirement**: Prominently marked with `⚠️ EXPERIMENTAL` across the catalog, selection banners, and inference result cards. Kept strictly separate from user testing crop profiles and the 22-crop production baseline.

### 4. Bonus Module B: Smart Irrigation Model
- **Architecture**: Classification model trained on in-situ sensor records.
- **Supported Inputs**: `soil_moisture` ($\%$), `temperature` ($°C$), `humidity` ($\%$).
- **Performance**: **97.53% Validation Accuracy**, **0.9748 Validation Macro-F1**.
- **Wording Standard**: Formulates decisions as:
  > *"The irrigation model predicts that irrigation is/is not currently required under the provided conditions."*
- **Safety**: Does not fabricate root uptake thresholds, FAO-56 dual-depth physics, or exact volumetric water deliveries ($L/ha$).

### 5. Bonus Module C: Weather Intelligence
- **Data Ingestion**: Live Open-Meteo REST API integrating 7-day multi-tier agrometeorology (temperature, relative humidity, precipitation probability, weather codes).
- **Zero-Fabrication Policy**: If network or upstream weather service is unreachable, returns an explicit `Weather data unavailable` state (HTTP 503 / safe UI banner) with zero simulated or fabricated weather values.
- **Coordination**: Provides rainfall context to delay irrigation cycles when heavy rainfall is imminent.

### 6. Bonus Module D: Sustainability Score
- **Scoring Framework**: Deterministic, transparent, and reproducible 0–100 index evaluated across three weighted pillars:
  - **Water Efficiency**: 40 points max (irrigation model output + rain probability)
  - **Resource Use**: 30 points max (soil N-P-K deviation from crop literature target)
  - **Crop Health**: 30 points max (high-confidence disease diagnosis gate)
- **Classification Levels**:
  - `80 – 100`: **Excellent** (🟢)
  - `60 – 79`: **Good** (🟡)
  - `40 – 59`: **Moderate** (🟠)
  - `0 – 39`: **Needs Improvement** (🔴)
- **Missing Data Handling**: Partial telemetry does NOT default to 0; scores are dynamically normalized with an explicit `Based on available data` disclosure.
- **Regulatory Standard**: Disclaimed as: *"Rule-based sustainability assessment based on available project data. Not a certified environmental assessment."*

### 7. Bonus Module E: Unified Farmer Advisor
- **Role**: Synthesizes disease detection, irrigation, crop recommendation, and yield projection into farmer-friendly operational advice.
- **Safety Guardrails**: Never recommends unsupported chemical concentrations, exact pesticide dosages ($ml/L$), or guaranteed harvest yields. Prompts image recaptures when disease confidence is below 65%.

### 8. Bonus Module G: Agentic Advisor
- **Role**: Autonomous multi-signal arbitration engine evaluating cross-module interactions across all 6 core subsystems.
- **Arbitration Levels**: `CRITICAL` > `HIGH` > `MEDIUM` > `LOW` > `DATA INSUFFICIENT`.
- **Traceability**: Every generated recommendation strictly includes `Action`, `Reason`, and `Source` (e.g., *Source: Smart Irrigation*, *Reason: The irrigation model predicts irrigation is required.*).

### 9. Enterprise Security: 4-Tier Role-Based Access Control & Farmer ↔ Stakeholder Federation
- **Role Hierarchy**: Strict 4-tier access structure:
  1. `FARMER` (Default): Access to all 9 farming AI operational modules + `🏢 Connected Organizations` tab to manage data sharing partnerships with verified agribusinesses, cooperatives, insurers, and researchers.
  2. `AGRICULTURAL_EXPERT`: Access to all farming features + `👨‍🔬 Expert Review` (read-only audit of multi-subsystem field telemetries).
  3. `AGRICULTURAL_STAKEHOLDER`: Dedicated macro-level agricultural intelligence command center for agribusinesses, FPOs, processors, insurers, banks, and policy makers:
     - **Federated Farmer Telemetry**: Zero mock data. Telemetry is strictly aggregated from farmers who possess an `ACTIVE` connection record (`stakeholder_farmer_relationships`).
     - **Data Ownership**: Disease diagnoses (`disease_diagnosis_records`), smart irrigation logs (`irrigation_logs`), and crop suitability evaluations (`crop_recommendations`) are permanently bound to `farmer_id`.
     - **Connected Farmers Directory**: Filterable directory (by crop, risk, search) displaying farm holdings, recent disease observations, and soil moisture telemetry. Includes a comprehensive `FarmerDetailModal` for deep inspection.
     - **Connection Lifecycle Management**: Stakeholders review inbound requests (`GET /pending-requests`) with one-click Approve / Decline capabilities.
     - **Privacy & Security Barrier**: Attempting to view an unconnected farmer's telemetry returns `HTTP 403 Forbidden`. Revoking a connection immediately cuts off telemetry access.
     - **Phytosanitary & Disease Outbreak Surveillance**: Real visual disease detections among connected farmers, pathogen categorization, and outbreak severity tracking.
     - **Water Stress Index**: Network-wide soil moisture aggregation and irrigation urgency distribution.
     - **Micro-Climate & Weather Risk**: Regionally mapped Open-Meteo meteorological telemetry for connected farm coordinates.
     - **Grounded Risk & Early Warning Center**: 5-point alert cards (WHAT, WHY, ACTION, FARM/FARMER, SOURCE) synthesizing multi-signal farm risks.
     - **Grounded Agri Intelligence Copilot**: Natural language analytical assistant with telemetry grounding evidence inspection.
     - **Zero Fabricated Data Guarantee**: When no farmers are connected or telemetry is unobserved, honest informational empty states are returned.
  4. `ADMIN`: Full system access + `🛠️ User Management` (assign roles across all 4 tiers, toggle active status) and `🛠️ System Monitoring` (real-time model artifacts & service health).
- **Security Guarantee**: Cryptographic HMAC-SHA256 session tokens with backend dependency authorization (`require_role`). Frontend manipulation cannot bypass access (401 unauthenticated, 403 forbidden).
- **Documentation**: Full architectural specification available in [docs/role_based_access_control.md](docs/role_based_access_control.md).

---

## 📁 Repository Structure

```
AGRISMART_AI/
├── ai/                        # AI/ML core training and inference engines
│   ├── models/                # Production model weights and scalers
│   │   ├── crop_recommendation/ # 22-crop and 95-crop serialized models
│   │   ├── disease/           # 19-class EfficientNet-B0 checkpoint
│   │   └── irrigation/        # 3-feature Smart Irrigation model
│   └── src/                   # AI training, augmentation, and inference scripts
├── backend/                   # FastAPI high-throughput REST backend
│   ├── app/
│   │   ├── api/               # Dependencies (deps.py) & endpoints (auth, expert, stakeholder, admin, predict, etc.)
│   │   ├── core/              # Settings and security configuration
│   │   ├── db/                # SQLite database session and SQLAlchemy models
│   │   ├── schemas/           # Pydantic data schemas & RBAC roles (auth, stakeholder, etc.)
│   │   └── services/          # Business logic, auth tokens, and agrometeorological integrations
│   └── main.py                # FastAPI entry point
├── frontend/                  # React Vite single-page application
│   ├── src/
│   │   ├── components/        # Dashboard, StakeholderDashboard, ExpertReviewView, UserManagementView, etc.
│   │   ├── services/          # API client services (authApi, smartFarmingApi, etc.)
│   │   └── utils/             # Crop & disease canonical ontology resolver
│   └── package.json
├── data/                      # Global crop profiles, aliases, and training datasets
├── dataset/                   # PlantVillage dataset manifests and classes.json (19 classes)
├── docs/                      # Architectural guides & RBAC specification
├── reports/                   # Validation benchmarks, SIH audit, and final reports
├── tests/                     # Comprehensive test suite (93+ automated tests including stakeholder RBAC)
└── README.md
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.12)
- Node.js 18+ & npm
- Git

### 2. Backend Setup
```bash
# Create and activate Python virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Start FastAPI server on port 8000
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Interactive Swagger API documentation is available at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
Access the application in your browser at `http://localhost:5173`.

### 4. PlantVillage Full-Dataset Pipeline (Ingestion, Preprocessing, Training & Evaluation)

The project natively integrates the complete canonical **PlantVillage Dataset** ([spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset)) covering **54,305 leaf images across 38 disease and healthy classes and all 14 crops**.

#### A. Ingest Full PlantVillage Dataset (54,305 Images)
Ingests the entire canonical dataset without artificial per-class caps:
```bash
# Ingest all 38 classes (full canonical dataset ~54k images)
python dataset/scripts/ingest_plantvillage.py --mode all
```

#### B. Preprocess, Augment & Create Stratified Splits
Validates image integrity across 16 threads using OpenCV (0 corrupted), standardizes to 224×224 RGB, applies Albumentations augmentations (flips, rotations, affine scaling, noise) dynamically for training, and exports a leak-free 70% Train (37,997) / 15% Val (8,129) / 15% Test (8,179) split:
```bash
python dataset/scripts/dataset_prep.py --img-size 224
```
Manifests and reports generated:
- `dataset/splits/train.csv` (37,997 samples)
- `dataset/splits/val.csv` (8,129 samples)
- `dataset/splits/test.csv` (8,179 samples)
- `dataset/splits/summary.json`
- `reports/dataset_distribution_report.txt`

#### C. Train Crop Disease Classifier (Two-Stage Transfer Learning)
Trains a transfer-learning model (**MobileNetV3-Large** / **EfficientNet-B0**) with ImageNet pretrained weights using a 2-stage fine-tuning schedule:
- **Stage 1 (Head Warmup)**: Frozen backbone, AdamW optimizer (`lr=1e-3`), Cosine Annealing scheduler.
- **Stage 2 (Fine-tuning)**: Upper backbone unfreezing, lower learning rate (`lr=1e-4`), Cosine Annealing scheduler.
- **Class Imbalance**: Inverse-frequency weighted cross-entropy loss to counter the 36:1 imbalance between largest (`Orange Huanglongbing`: 5,507) and smallest (`Potato healthy`: 152) classes.
- **Hardware Acceleration**: Automatic CUDA GPU detection with mixed precision (AMP fp16) on NVIDIA RTX GPUs, and multi-threaded CPU fallback.

```bash
# Full dataset training (configurable epochs and batch size)
python scripts/train_plantvillage.py \
  --architecture mobilenet_v3_large \
  --epochs-stage1 8 \
  --epochs-stage2 20 \
  --batch-size 32
```
Checkpoints are saved automatically based on peak validation Macro-F1:
- `models/disease/best_model.pt`
- `models/disease/plantvillage_model.pt`
- `models/disease/class_names.json`
- `models/disease/model_config.json`

#### D. Evaluate Model & Benchmark on Unseen Test Partition
Evaluates the 8,179 unseen test samples, calculates Accuracy, Macro & Weighted Precision, Recall, F1-scores, latency benchmark (ms/image), and exports a high-resolution 38×38 confusion matrix heatmap:
```bash
python scripts/evaluate_plantvillage.py --checkpoint models/disease/best_model.pt
```
Outputs are saved to:
- `reports/plantvillage_evaluation_report.json`
- `reports/plantvillage_confusion_matrix.png`
- `reports/plantvillage_classification_report.txt`

#### E. Hardware & Training Time Specifications
- **GPU (CUDA with Mixed Precision)**: ~1.5 minutes per epoch on NVIDIA RTX 3050 6GB (~35–45 minutes total for full two-stage training).
- **CPU (Multi-threaded)**: ~22 minutes per epoch on 16-core CPU.
- **Inference Latency**: ~9.4 ms per image on local CPU.
- **Total Parameters**: 5.4M (MobileNetV3-Large).

#### E. Leaf Prediction API Endpoint
- **Method & Route**: `POST /api/v1/predict`
- **Request**: Multipart Form-Data with file field `file` (JPEG/PNG/WebP image).
- **Example cURL**:
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/predict" \
     -F "file=@sample_leaf.jpg"
```
- **Response Format**:
```json
{
  "success": true,
  "message": "Crop leaf image analyzed successfully.",
  "crop": "Apple",
  "disease": "Apple Scab",
  "confidence": "94%",
  "confidence_score": 0.9412,
  "status": "Diseased",
  "pathogen": "Venturia inaequalis (Fungus)",
  "symptoms": "Olive-green to dark brown velvety lesions on leaf surfaces...",
  "precautions": [
    "Rake and destroy fallen leaves in autumn",
    "Prune tree canopies to improve airflow and solar penetration"
  ],
  "treatment": "Apply protective copper or sulfur fungicides at green-tip stage.",
  "top_predictions": [
    {
      "class_id": 0,
      "disease": "Apple Scab",
      "crop": "Apple",
      "confidence": "94%",
      "confidence_score": 0.9412
    }
  ],
  "processing_time_ms": 12.4
}
```

---

### 5. Running Automated Tests
```bash
# Run complete test suite (65 comprehensive tests)
py -3.13 -m unittest tests/test_farmer_stakeholder_ecosystem.py tests/test_stakeholder_rbac.py tests/test_rbac.py
```

---

## 👥 Pre-Seeded Demo Accounts & Live SIH Evaluation

The platform automatically provisions pre-configured demo personas with a seeded relational ecosystem:

| Persona | Email | Password | Primary Role & Capabilities |
| :--- | :--- | :--- | :--- |
| **Demo Farmer** | `farmer@agrismart.ai` | `Farmer@123` | 👨‍🌾 Punjab Family Farm (Ludhiana), 4.5 ha. Pre-seeded with Tomato Early Blight diagnosis, 24.5% soil moisture log, and crop recommendation. |
| **Demo Stakeholder** | `stakeholder@agrismart.ai` | `Stakeholder@123` | 🌐 Punjab AgriCorp (Agribusiness/Procurement). Pre-linked to Demo Farmer with active telemetry federation. |
| **Demo Expert** | `expert@agrismart.ai` | `Expert@123` | 👨‍🔬 ICAR Extension Agronomist. Read-only multi-subsystem audit view (`Expert Review`). |
| **Demo Admin** | `admin@agrismart.ai` | `Admin@123` | 🛠️ System Administrator. User management and system diagnostics. |

### 🧪 Live SIH Demonstration Workflow:
1. **Log in as Demo Farmer (`farmer@agrismart.ai`)**:
   - Go to **Disease Detection**: upload a leaf or inspect current health.
   - Go to **Smart Irrigation**: view in-situ soil moisture sensor reading (24.5%).
   - Click **🏢 Organizations**: view **Punjab AgriCorp** as an active connected partner. Notice the button to revoke access.
2. **Log in as Demo Stakeholder (`stakeholder@agrismart.ai`)**:
   - The **Stakeholder Dashboard** opens automatically.
   - **Macro KPIs**: Monitored Acreage reflects real farm acreage (`4.5 ha`), Connected Farmers shows `1`, Monitored Crops shows `Tomato`.
   - Click **👨‍🌾 Connected Farmers**: inspect Ramesh Patel's holding in grid/table view. Click **Inspect Farm Profile & Telemetry** to view the `FarmerDetailModal` displaying the real Early Blight diagnosis, irrigation history, and live weather.
   - Click **⚠️ Risk & Alerts Center**: view the grounded 5-point alert regarding the Tomato Early Blight detection.
   - Click **🤖 Agri Intelligence Copilot**: ask *"Summarize crop health risks across all connected farms"* and inspect the Telemetry Grounding Evidence.
3. **Verify Data Sovereignty & Privacy Barrier**:
   - Disconnect the farmer either from the farmer's **🏢 Organizations** tab or the stakeholder's directory.
   - Immediate effect: Stakeholder dashboard switches to honest empty states with 0 connected farmers. Attempting to query the disconnected farmer's profile returns `403 Forbidden`.

---

## ⚠️ Known Limitations & Disclaimers

1. **Leaf Disease Field Generalization**: Models were trained on the PlantVillage dataset under controlled lighting conditions. Complex shadows, multiple overlapping diseases on a single leaf, or severe motion blur can reduce confidence. Always inspect physically before applying crop protection measures.
2. **Volumetric Irrigation Delivery**: The irrigation classifier determines the binary state (*irrigation required vs. not required*) and priority level based on soil moisture and ambient conditions. It does not measure exact soil hydraulic conductivity or compute liters per hectare.
3. **95-Crop Recommender Synthetic Data**: The 95-crop model is an experimental expansion trained on synthetic physiological envelopes derived from literature. For critical field planting decisions, prioritize the verified 22-crop production model.
4. **Sustainability Score Transparency**: The sustainability index is a rule-based operational guideline reflecting available farm inputs; it is not an ISO-certified carbon lifecycle assessment (LCA).
