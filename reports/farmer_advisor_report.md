# AgriSmart AI – Unified Farmer Advisory & Agriculture Decision Engine Report

**System**: AgriSmart AI – Intelligent Agriculture Decision Support  
**Module**: `src/farmer_advisor/`  
**Primary Interface**: `generate_farmer_advice(...)`  
**Status**: Production Ready  

---

## 1. Architectural Overview

The **Farmer AI Advisor** acts as the central synthesis engine of AgriSmart AI. Rather than treating machine learning models as isolated endpoints, the advisor aggregates predictions across four validated machine learning modules into a cohesive, farmer-friendly decision payload:

```text
               Leaf Image / Field Telemetry
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
 ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
 │Disease Model  │ │Irrigation Mod │ │Yield Model    │
 │EfficientNet-B0│ │ Random Forest │ │ XGBoost Reg   │
 └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           ▼
             ┌───────────────────────────┐
             │    Farmer AI Advisor      │
             │ (Deterministic Rule Engine│
             │   & Priority Arbitrator)  │
             └─────────────┬─────────────┘
                           ▼
          Comprehensive Actionable Guidance
           (Status, Priority, Warnings)
```

### Integrated Production Models
1. **Crop Disease Detection**:
   - Architecture: `EfficientNet-B0`
   - Validation Macro-F1: **0.9036** | Accuracy: **0.9115**
   - Role: Identifies foliar pathogens and healthy plant specimens.
2. **Crop Recommendation**:
   - Algorithm: `Random Forest Classifier`
   - Validation Macro-F1: **0.9955** | Accuracy: **0.9955**
   - Role: Matches soil N-P-K, pH, and climate to optimal crop selection.
3. **Smart Irrigation Scheduling**:
   - Algorithm: `Random Forest Classifier`
   - Validation Macro-F1: **0.9748** | Accuracy: **0.9753**
   - Role: Predicts root-zone water stress and activation priority (`HIGH`, `MEDIUM`, `LOW`, `NONE`).
4. **Crop Yield Prediction**:
   - Algorithm: `XGBoost Regressor`
   - Validation RMSE: **149.33** | MAE: **11.08** | $R^2$: **0.9687**
   - Role: Projects expected harvest yield in metric tonnes per hectare (or nuts/ha for coconut).

### Excluded Untrusted Model
- **Crop Stress Detection (Kaggle Dataset)**:
  - Evaluation Macro-F1: **0.5029** (Near random chance due to synthetic feature-target decoupling).
  - **Decision**: Strictly excluded from trusted decision logic to maintain complete agricultural integrity and farmer safety.

---

## 2. Decision Rules & Priority Arbitration

The overall farm operational priority is determined via transparent agronomic rules rather than an opaque secondary model:

| Farm Status | Overall Priority | Trigger Condition |
|---|---|---|
| **Critical Intervention Required** | **CRITICAL** | High-confidence disease detected ($\text{Conf} \ge 65\%$, non-healthy) **AND** Irrigation priority is `HIGH`. |
| **Attention Required** | **HIGH** | High-confidence disease detected **OR** Irrigation priority is `HIGH`. |
| **Routine Monitoring Advised** | **MEDIUM** | Irrigation priority is `MEDIUM` **OR** Moderate disease confidence ($50\% \le \text{Conf} < 65\%$) **OR** Irrigation status is `LOW / REVIEW`. |
| **Optimal / Good Condition** | **LOW** | Healthy crop confirmed ($\text{Conf} \ge 65\%$) **AND** Irrigation not required (`NO / NONE`). |

### Compound Stress Mitigation
When both active disease infection and severe soil moisture deficit occur simultaneously (`CRITICAL` priority), the system issues a prominent compound alert:
> **Compound Stress Alert**: Avoid overhead sprinkler irrigation which disperses fungal spores across wet foliage; initiate immediate root-zone drip irrigation and prune infected lower canopy leaves.

---

## 3. Confidence Handling & Safety Guardrails

### A. Disease Detection Safety
- **Threshold**: Safe actionable threshold is established at **$\ge 65\%$**.
- **Low-Confidence Fallback**: When $\text{Confidence} < 65\%$, the advisor intentionally suppresses specific chemical treatment advice and returns:
  > *"Low confidence prediction. Please capture a clearer leaf image in natural diffuse daylight showing both upper and lower leaf surfaces."*

### B. Prevention of Fabricated Dosages
- The system **never** invents chemical pesticide dosages, fertilizer application rates, exact volumetric irrigation litres, or weather forecasts.
- Missing values are explicitly flagged as `"Data unavailable"`.
- For chemical interventions, the advisor instructs the farmer to consult a local certified agricultural extension officer or agronomist.

### C. Yield Projection Phrasing
- Projections are consistently phrased as **"Estimated yield"** rather than "Guaranteed yield", acknowledging uncontrollable environmental variables.

---

## 4. Input & Output Specification

### Input Schema
```python
generate_farmer_advice(
    crop="Tomato",                                  # Optional override
    disease_result={...},                           # Output from disease model
    irrigation_result={...},                        # Output from irrigation model
    yield_result={...},                             # Output from yield model
    crop_rec_result={...},                          # Output from crop recommendation
    environmental_info={"soil_moisture": 22.0, ...} # Actual measured observations
)
```

### Verified Output Structure
```json
{
    "farm_status": "Critical Intervention Required",
    "overall_priority": "CRITICAL",
    "crop": "Tomato",
    "disease": {
        "name": "Early Blight",
        "confidence": 0.92
    },
    "irrigation": {
        "required": true,
        "priority": "HIGH",
        "confidence": 0.91
    },
    "yield": {
        "estimated": 3.2,
        "unit": "Tonnes/Ha"
    },
    "recommendations": [
        "Disease Identified (Early Blight - Fungal (Alternaria solani)): Prune lower infected leaves showing concentric 'target-board' rings. Avoid overhead watering to minimize leaf wetness duration. Mulch soil around plant base to prevent soil-splash spore dispersal.",
        "For chemical treatment, bio-pesticides, or specific dosage schedules, consult a local certified agricultural extension officer or agronomist.",
        "Urgent irrigation required: Soil moisture has depleted past the critical root uptake threshold. Initiate irrigation cycle (preferably drip in early morning) to prevent moisture stress.",
        "Exact volumetric water delivery: Data unavailable (apply calibrated drip cycles tailored to field soil type).",
        "Estimated yield expectation is 3.20 Tonnes/Ha based on regional historical performance and seasonal conditions.",
        "Note: Estimated yield is an agronomic projection; actual harvest will vary with weather extremes, pest incidence, and timely field management.",
        "Field Telemetry Verified: Soil Moisture: 22.0%, Temperature: 29.5°C, Humidity: 78.0%."
    ],
    "warnings": [
        "COMPOUND STRESS ALERT: High fungal/pathogen infection detected simultaneously with critical soil moisture depletion. Avoid overhead irrigation which spreads spores; prioritize immediate drip irrigation and leaf sanitation.",
        "High moisture deficit: Crop is entering water stress which can cause permanent wilting, blossom drop, or yield loss if unaddressed."
    ],
    "status": "success"
}
```

---

## 5. Test Suite Verification

Comprehensive test suite implemented at [tests/test_farmer_advisor.py](file:///j:/AGRISMART_AI/tests/test_farmer_advisor.py):

| Test Case | Scenario Tested | Outcome |
|---|---|---|
| `test_01_healthy_crop` | Healthy crop with adequate soil moisture | **PASS** (`LOW` priority, Optimal status) |
| `test_02_diseased_crop` | High-confidence diseased crop (Apple Scab) | **PASS** (`HIGH` priority, Sanitation recs) |
| `test_03_high_irrigation_requirement` | Severe soil moisture deficit | **PASS** (`HIGH` priority, Urgent drip rec) |
| `test_04_low_irrigation_requirement` | Adequate soil moisture | **PASS** (Water conservation advice) |
| `test_05_low_disease_confidence` | Disease confidence below $65\%$ | **PASS** (Re-capture prompt, no chemicals) |
| `test_06_missing_optional_inputs` | Completely empty input arguments | **PASS** (`Data unavailable`, 0 crashes) |
| `test_07_combined_disease_and_irrigation` | Simultaneous infection + high deficit | **PASS** (`CRITICAL` priority & Compound alert) |

**Result**: 7/7 tests passed in 0.002s.
