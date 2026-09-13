# Bonus Module D: Indicative Sustainability Score Report
**AgriSmart AI — Intelligent Agricultural Advisory & Farm Diagnostic Platform**

---

## 1. Module Objective

The **Indicative Sustainability Score** is an explainable, deterministic, and farmer-friendly evaluation metric that rates a farm's immediate agronomic sustainability on a transparent scale from **0 to 100**.

### Key Principles & Guardrails
- **Explainability & Transparency**: Every point earned or deducted is derived from explicit, deterministic mathematical rules without opaque weights or retrained neural networks.
- **Strict Realism & Empirical Grounding**: The system uses only verified user inputs, active field telemetry, and validated AI module inferences. It does **not** invent water volumes, litres per hectare, evapotranspiration (ET), carbon equivalents, or fictional IoT sensor readings.
- **Zero Hallucination of Missing Data**: When telemetry or diagnostic data is incomplete, missing components are explicitly flagged as *"Data unavailable"* and excluded from calculation with mathematically rigorous normalization.
- **Non-Prescriptive Guidance**: Resource indicators reflect distance from standard literature profiles rather than rigid agronomic prescriptions.

---

## 2. Data Sources

The sustainability engine aggregates live outputs and user inputs across four primary AgriSmart AI sub-systems:

| Sub-System | Harvested Telemetry & Inputs | Role in Sustainability |
|---|---|---|
| **Smart Irrigation Engine** | `irrigation_prediction` ('YES' / 'NO'), `irrigation_priority` ('HIGH' / 'NONE'), `soil_moisture` (%) | Evaluates water demand vs. delivery necessity |
| **Agrometeorological Intelligence** | `rain_probability` (0–100%), `forecast_precipitation` (mm), `weather_risk` ('LOW' / 'MODERATE' / 'HIGH') | Provides atmospheric context for irrigation conservation |
| **Leaf Disease Diagnostics** | `disease` (class label / 'Healthy'), `disease_confidence` (0.0–1.0) | Evaluates foliar integrity and infection presence |
| **Soil & Crop Recommendation** | `crop` (species), `nitrogen`, `phosphorus`, `potassium` (kg/ha) | Benchmarks soil macronutrients against published crop profiles |

---

## 3. Exact Formula

The total sustainability score is composed of three additive components totaling **100 maximum points**:

$$\text{Sustainability Score} = \text{Water Efficiency (40 pts)} + \text{Resource Use (30 pts)} + \text{Crop Health (30 pts)}$$

| Component | Weight | Max Points | Evaluation Basis |
|---|:---:|:---:|---|
| **A. Water Efficiency** | 40% | 40 | Irrigation requirement matched against rainfall forecast |
| **B. Resource Use** | 30% | 30 | Deviation of N-P-K inputs from published crop profile |
| **C. Crop Health** | 30% | 30 | Diagnostic confidence and plant pathogen status |
| **Total** | **100%** | **100** | **Sum of components (bounded strictly between 0 and 100)** |

---

## 4. Water Efficiency Calculation (Max 40 Points)

Water Efficiency evaluates whether water is being conserved by avoiding unnecessary irrigation and timing irrigation cycles around natural rainfall events.

### Deterministic Rules:
1. **Irrigation NOT Required + Favorable Rainfall / Weather ($\ge 30\%$ rain prob, precipitation $> 0$ mm, or 'LOW' risk)**:
   $$\text{Score} = 40 \text{ points}$$
   *Explanation*: Optimal water stewardship. Soil moisture is adequate and upcoming precipitation further preserves freshwater reserves.
2. **Irrigation NOT Required + Normal Weather**:
   $$\text{Score} = 35 \text{ points}$$
   *Explanation*: Efficient water management. Soil moisture is adequate under baseline weather conditions.
3. **Irrigation Required + Rain Likely ($\ge 50\%$ rain prob or forecast precipitation $\ge 5$ mm)**:
   $$\text{Score} = 25 \text{ points}$$
   *Explanation*: Irrigation is currently indicated, but upcoming rainfall offers an opportunity to delay application and avoid wastage.
4. **Irrigation Required + Rain Unlikely ($< 50\%$ rain prob)**:
   $$\text{Score} = 20 \text{ points}$$
   *Explanation*: Irrigation is required under dry weather conditions. Timely application is needed to prevent crop water stress.
5. **Missing Irrigation Data**:
   $$\text{Score} = \text{None (Marked as 'Data unavailable')}$$
   *Strict Guardrail*: Water volume, litres/hectare, or ET values are **never** fabricated.

---

## 5. Resource Use Calculation (Max 30 Points)

Resource Use benchmarks submitted soil Nitrogen (N), Phosphorus (P), and Potassium (K) levels against literature-typical crop nutrient profiles sourced from `global_crops.csv` and agricultural extension guidelines.

### Relative Deviation Metric:
Given user inputs $(N, P, K)$ and crop reference targets $(N_{\text{ref}}, P_{\text{ref}}, K_{\text{ref}})$:
$$\delta_N = \frac{|N - N_{\text{ref}}|}{\max(N_{\text{ref}}, 20)}, \quad \delta_P = \frac{|P - P_{\text{ref}}|}{\max(P_{\text{ref}}, 15)}, \quad \delta_K = \frac{|K - K_{\text{ref}}|}{\max(K_{\text{ref}}, 15)}$$
$$\bar{\delta}_{\text{NPK}} = \frac{\delta_N + \delta_P + \delta_K}{3}$$

### Deterministic Scoring:
- **Within Profile Range ($\bar{\delta}_{\text{NPK}} \le 0.35$)**:
  $$\text{Score} = 30 \text{ points}$$
- **Moderately Outside Profile Range ($0.35 < \bar{\delta}_{\text{NPK}} \le 0.75$)**:
  $$\text{Score} = 20 \text{ points}$$
- **Strongly Outside Profile Range ($\bar{\delta}_{\text{NPK}} > 0.75$)**:
  $$\text{Score} = 10 \text{ points}$$
- **Missing NPK Inputs**:
  $$\text{Score} = \text{None (Marked as 'Data unavailable')}$$

> [!NOTE]
> *Transparency Label*: These values are explicitly displayed as **approximate profile-based indicators**, not agronomic prescriptions.

---

## 6. Crop Health Calculation (Max 30 Points)

Crop Health leverages the deep learning computer vision model's leaf diagnosis. To maintain safety, only diagnoses meeting or exceeding the **65% confidence threshold** are scored.

### Deterministic Rules:
1. **Healthy foliage with confidence $\ge 65\%$**:
   $$\text{Score} = 30 \text{ points}$$
2. **Disease detected with confidence $\ge 65\%$**:
   $$\text{Score} = 10 \text{ points}$$
3. **Confidence $< 65\%$ or Missing Diagnosis**:
   $$\text{Score} = \text{None (Marked as 'Data unavailable')}$$
   *Safety Rule*: Low-confidence predictions are never treated as confirmed diagnoses, preventing unwarranted point deductions or false reassurance.

---

## 7. Missing-Data Handling & Normalization

When one or two components cannot be evaluated due to missing farm telemetry or unconfirmed diagnostics:
1. The missing component is clearly displayed as `"Data unavailable"` (no fake zeros or fabricated defaults).
2. The score is computed using the **available points** and normalized to a 100-point scale:

$$\text{Sustainability Score} = \left\lfloor \frac{\sum \text{Earned Points (Available Components)}}{\sum \text{Max Points (Available Components)}} \times 100 + 0.5 \right\rfloor$$

### Example:
- Water Efficiency: 40 / 40
- Resource Use: Data unavailable (Missing NPK)
- Crop Health: 30 / 30
- $\text{Available Earned} = 40 + 30 = 70$
- $\text{Available Max} = 40 + 30 = 70$
- $\text{Normalized Score} = \frac{70}{70} \times 100 = 100 / 100$
- Prominent UI Badge: **"Based on available data"**

If all 3 components are missing:
- $\text{Sustainability Score} = \text{null}$
- $\text{Level} = \text{"Data Unavailable"}$
- $\text{Status} = \text{"Data unavailable — please provide irrigation, NPK soil nutrients, or leaf diagnosis to generate score."}$

---

## 8. Score Levels & Visual Indicators

| Score Range | Visual Badge | Status Label | Meaning |
|:---:|:---:|---|---|
| **80 – 100** | 🟢 | **Excellent** | Optimal water conservation, balanced nutrient levels, and clean crop foliage |
| **60 – 79** | 🟡 | **Good** | Solid sustainability practices with minor potential optimizations |
| **40 – 59** | 🟠 | **Moderate** | Significant opportunities to improve irrigation timing or nutrient balance |
| **0 – 39** | 🔴 | **Needs Improvement** | Active disease stress, inefficient water usage, or severe nutrient imbalance |
| **N/A** | ⚪ | **Data Unavailable** | Insufficient field data to compute an indicative score |

---

## 9. Improvement Rules & Guardrails

Improvement suggestions are generated **only** when a component scores low:

| Trigger Condition | Generated Actionable Suggestion |
|---|---|
| **Low Water Efficiency ($\le 25$ pts)** | *"Review irrigation timing and consider forecast rainfall before irrigating."* |
| **Low Resource Use ($\le 20$ pts)** | *"Review NPK inputs against the selected crop profile."* |
| **Low Crop Health ($\le 10$ pts)** | *"Monitor crop health and inspect affected leaves."* |
| **All Components High ($\ge 80$ overall)** | *"Maintain current balanced irrigation, nutrient management, and crop monitoring."* |

### Prohibited Content (Enforced):
- ❌ No chemical pesticide or fungicide dosage prescriptions.
- ❌ No fabricated irrigation volume in litres or litres/hectare.
- ❌ No unsupported fertilizer application rates.

---

## 10. API Specification

### Endpoint
`POST /api/v1/sustainability-score`

### Request Payload Example
```json
{
  "crop": "Tomato",
  "soil_moisture": 25,
  "temperature": 30,
  "humidity": 70,
  "nitrogen": 80,
  "phosphorus": 40,
  "potassium": 40,
  "rainfall": 100,
  "irrigation_prediction": "NO",
  "irrigation_priority": "NONE",
  "disease": "Healthy",
  "disease_confidence": 0.91,
  "rain_probability": 30,
  "weather_risk": "LOW"
}
```

### Response Payload Example
```json
{
  "status": "success",
  "sustainability_score": 90,
  "level": "Excellent",
  "components": {
    "water_efficiency": 40,
    "resource_use": 20,
    "crop_health": 30
  },
  "component_details": {
    "water_efficiency": {
      "score": 40,
      "max_points": 40,
      "status": "available",
      "description": "Optimal water efficiency: Irrigation not required and favorable atmospheric/rain conditions."
    },
    "resource_use": {
      "score": 20,
      "max_points": 30,
      "status": "available",
      "description": "NPK inputs (80-40-40) are moderately outside literature profile range for Tomato (target: 120-80-60 kg/ha). Approximate profile-based indicator, not an agronomic prescription."
    },
    "crop_health": {
      "score": 30,
      "max_points": 30,
      "status": "available",
      "description": "Healthy crop tissue confirmed with high diagnostic confidence (91.0%)."
    }
  },
  "available_data": true,
  "is_normalized": false,
  "data_note": "Score based on complete farm data (all 3 components evaluated).",
  "suggestions": [
    "Review NPK inputs against the selected crop profile."
  ],
  "disclaimer": "Indicative score based on available project data. Not a certified environmental assessment."
}
```

---

## 11. Frontend Integration

The Sustainability Score is embedded directly in the **existing Dashboard** (`Dashboard.jsx`), preserving AgriSmart AI's dark green aesthetics:

1. **Compact Dashboard Section (`#sustainability-section`)**:
   - Placed prominently between the Farm Overview Cards and Quick Actions.
   - Displays the main score (`XX / 100`), level badge (`🟢 Excellent`, `🟡 Good`, etc.), and `"Based on available data"` tag when partial data is used.
   - Three progress bars for **Water Efficiency**, **Resource Use**, and **Crop Health**.
   - Actionable suggestions box (`💡 Improvement Suggestions`).
   - `[View Details →]` interactive action button.
2. **Detail View Modal**:
   - Opens on clicking `[View Details]`.
   - Displays the exact score formula ($40\% - 30\% - 30\%$).
   - Detailed component breakdown cards with qualitative descriptions.
   - Prominent transparency disclaimer: *"Indicative score based on available project data. Not a certified environmental assessment."*

---

## 12. Test Results

The implementation was validated using both `pytest` and Python's built-in `unittest` runner across all 12 mandatory scenarios in `tests/test_sustainability_score.py`:

| # | Test Scenario | Verified Outcomes | Result |
|:---:|---|---|:---:|
| **1** | Healthy crop + no irrigation required | Water=40, Resource=30, Health=30 $\to$ Score: 100 (Excellent) | **PASS** |
| **2** | Irrigation required + no rain | Water=20, Resource=30, Health=30 $\to$ Score: 80, Suggestion: "Review irrigation timing" | **PASS** |
| **3** | Irrigation required + rain likely | Water=25, Resource=30, Health=30 $\to$ Score: 85 (Excellent) | **PASS** |
| **4** | High-confidence disease detected | Water=35, Resource=30, Health=10 $\to$ Score: 75, Suggestion: "Monitor crop health" | **PASS** |
| **5** | Low-confidence disease ($< 65\%$) | Health=None (unavailable), Normalized $65/70 \to 93 / 100$ | **PASS** |
| **6** | Missing NPK data | Resource=None, Normalized $70/70 \to 100 / 100$, Flagged normalized | **PASS** |
| **7** | Missing weather context | Baseline Water=35 evaluated cleanly without crash $\to$ Score: 95 | **PASS** |
| **8** | Missing disease result | Health=None, Water=35, Resource=30 $\to$ Normalized $65/70 \to 93 / 100$ | **PASS** |
| **9** | Missing irrigation result | Water=None, Resource=30, Health=30 $\to$ Normalized $60/60 \to 100 / 100$ | **PASS** |
| **10**| Complete real-world data | Evaluated all 3 components, triggered NPK review suggestion | **PASS** |
| **11**| Single available component | Evaluated available component, normalized cleanly to $100 / 100$ | **PASS** |
| **12**| Boundary & stress tests | Verified worst-case ($40/100$), best-case ($100/100$), empty input ($None$) | **PASS** |

### Regression Suite Status
All existing test suites were executed with zero failures:
- `tests/test_weather_intelligence.py`: **9 / 9 PASSED**
- `tests/test_farmer_advisor.py`: **7 / 7 PASSED**
- `tests/test_new_crops_integration.py`: **8 / 8 PASSED**
- `tests/test_ai_integration.py`: **10 / 10 PASSED**

---

## 13. Limitations & Disclaimers

> [!CAUTION]
> **Regulatory and Scientific Limitation Notice**
> The AgriSmart AI Sustainability Score is an **indicative, heuristic metric** calculated from available localized telemetry and machine-learning inferences.
> - It is **not** an accredited life-cycle assessment (LCA).
> - It is **not** a certified carbon footprint or environmental impact measurement (such as ISO 14040/44 or GHG Protocol).
> - Resource Use scores reflect conformity with general agricultural extension ranges and do not substitute for certified agronomist soil chemical testing or localized soil health cards.
> - Farmers should consult local agronomy extension agents for site-specific fertilizer schedules and chemical treatments.
