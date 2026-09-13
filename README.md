# AgriSmart AI – Intelligent Crop Health & Sustainable Agriculture Decision Platform

AgriSmart AI is an end-to-end intelligent agricultural diagnosis and advisory system built for the Smart India Hackathon (SIH 2026). It combines computer vision leaf diagnostics, multi-crop suitability recommendations, smart irrigation decision modeling, live agrometeorological intelligence, deterministic sustainability scoring, and agentic multi-signal arbitration into a unified farmer-first platform.

---

## 🌾 System Architecture & Modules

### 1. Core Module: Crop Disease Diagnostics
- **Architecture**: EfficientNet-B0 transfer learning model trained on 21,749 verified agricultural leaf specimens (PlantVillage dataset, CC-BY-SA-3.0).
- **Scope**: **19 classes across 7 staple crops**:
  - **Apple** (Apple Scab, Black Rot, Healthy)
  - **Bell Pepper** (Bacterial Spot, Healthy)
  - **Corn** (Common Rust, Northern Leaf Blight, Healthy)
  - **Grape** (Black Rot, Healthy)
  - **Peach** (Bacterial Spot, Healthy)
  - **Potato** (Early Blight, Late Blight, Healthy)
  - **Tomato** (Bacterial Spot, Early Blight, Late Blight, Healthy)
- **Performance**: **93.68% Validation Accuracy**, **0.9190 Validation Macro-F1**, 35.95 ms inference latency.
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

### 9. Enterprise Security: 4-Tier Role-Based Access Control (RBAC)
- **Role Hierarchy**: Strict 4-tier access structure:
  1. `FARMER` (Default): Access to all 9 farming AI operational modules. Zero duplicate or new pages.
  2. `AGRICULTURAL_EXPERT`: Access to all farming features + `👨‍🔬 Expert Review` (read-only audit of multi-subsystem field telemetries).
  3. `AGRICULTURAL_STAKEHOLDER`: Dedicated macro-level agricultural intelligence command center for agribusinesses, FPOs, processors, insurers, banks, and policy makers:
     - **Macro KPIs**: Monitored farms, represented hectares, health index, water stress, aggregate ESG score, active early warnings.
     - **Crop Intelligence**: Variety adoption distributions, regional NPK soil profiles, yield forecasts.
     - **Phytosanitary & Disease Risk**: District-level infection tracking, high-risk pathogen clusters, quarantine watchlists.
     - **Water Stress Index**: Basin-wide moisture profiling, irrigation demand trends.
     - **Weather & Climate Risk**: Extreme weather exposure, 7-day risk projections, drought/flood exposure indices.
     - **ESG & Sustainability**: 3-pillar sustainability scores, water efficiency ratings, N-P-K nutrient stewardship indices.
     - **Early Warning Alerts**: Prioritized action warnings across disease outbreaks, water deficits, and weather shocks.
     - **AI Policy & Procurement Copilot**: Natural language analytical assistant synthesizing regional telemetry.
     - **Zero Fabricated Data Guarantee**: All figures originate from verified database records and live services; honest empty states ("No recorded observations") when telemetry is unobserved.
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

### 4. Running Automated Tests
```bash
# Run complete test suite (73 tests)
python -m pytest tests/
```

---

## ⚠️ Known Limitations & Disclaimers

1. **Leaf Disease Field Generalization**: Models were trained on the PlantVillage dataset under controlled lighting conditions. Complex shadows, multiple overlapping diseases on a single leaf, or severe motion blur can reduce confidence. Always inspect physically before applying crop protection measures.
2. **Volumetric Irrigation Delivery**: The irrigation classifier determines the binary state (*irrigation required vs. not required*) and priority level based on soil moisture and ambient conditions. It does not measure exact soil hydraulic conductivity or compute liters per hectare.
3. **95-Crop Recommender Synthetic Data**: The 95-crop model is an experimental expansion trained on synthetic physiological envelopes derived from literature. For critical field planting decisions, prioritize the verified 22-crop production model.
4. **Sustainability Score Transparency**: The sustainability index is a rule-based operational guideline reflecting available farm inputs; it is not an ISO-certified carbon lifecycle assessment (LCA).
