# AgriSmart AI – Module G: 🤖 Agentic Advisor Documentation

## 1. Purpose
The **Agentic Advisor** is a deterministic decision-support orchestration layer that combines outputs from existing AgriSmart AI modules. It does not train a new ML model and does not independently establish agricultural facts.

Instead of presenting farmers with isolated, disconnected module results, the Agentic Advisor synthesizes data across all 6 core modules into a single, cohesive farm advisory:
1. Current farm situation & crop status
2. Overall priority level (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `DATA INSUFFICIENT`)
3. Primary agricultural reason
4. 1 to 4 ranked next actions with source attribution and transparent rationales
5. Supporting evidence checklist & missing telemetry declaration
6. Safety guardrails and expert verification disclaimers

---

## 2. Architecture

```
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│  Disease Detection     │  │   Smart Irrigation     │  │  Weather Intelligence  │
│  (Crop, Disease, Conf) │  │  (Status, Prio, Conf)  │  │  (Temp, Rain %, Risk)  │
└───────────┬────────────┘  └───────────┬────────────┘  └───────────┬────────────┘
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        ▼
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│   Crop Recommendation  │  │    Yield Prediction    │  │  Sustainability Score  │
│  (Top-3, Conf, Rec)    │  │  (Projected Tons/Ha)   │  │  (Score, 0-100, Level) │
└───────────┬────────────┘  └───────────┬────────────┘  └───────────┬────────────┘
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │        🤖 Agentic Advisor Engine        │
                   │    Deterministic Decision Orchestrator  │
                   │   (No new ML model • Zero Hallucination)│
                   └────────────────────┬────────────────────┘
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │    Priority + Reason + Ranked Actions   │
                   │  Evidence Checklist + Safety Guardrails │
                   └─────────────────────────────────────────┘
```

---

## 3. Input Modules

| Module | Consumed Fields | Optional / Fallback |
|---|---|---|
| **Disease Detection** | `crop`, `disease`, `confidence` | If confidence $< 65\%$, prompts clearer photo. Marked "Data unavailable" if absent. |
| **Smart Irrigation** | `prediction` (`YES`/`NO`), `priority` (`HIGH`/`MEDIUM`/`LOW`), `confidence` | Evaluates urgency of soil moisture depletion. |
| **Weather Intelligence** | `temperature`, `humidity`, `rain_probability`, `forecast_precipitation`, `weather_risk` | Cross-checks with irrigation needs (rain delay logic). |
| **Crop Recommendation** | `recommended_crop`, `probability`, `top_3` | Identifies target crop and optimal rotation. |
| **Yield Prediction** | `estimated_yield`, `unit` | Compares projected harvest expectations. |
| **Sustainability Score**| `score`, `level`, `water_efficiency`, `resource_use`, `crop_health` | Highlights resource inefficiencies and field conservation. |

---

## 4. Decision Flow (9-Step Process)

1. **Step 1: Check Available Data**: Analyzes incoming telemetry and records which modules provided valid data into `evidence` and which are absent into `missing_data`.
2. **Step 2: Identify Urgent Risks**: Checks for high-confidence disease, urgent irrigation demand, extreme weather, or low sustainability.
3. **Step 3: Prioritize Risks**: Evaluates priority deterministically using hierarchical rules (`CRITICAL` $\to$ `HIGH` $\to$ `MEDIUM` $\to$ `LOW` $\to$ `DATA INSUFFICIENT`).
4. **Step 4: Cross-Check Weather with Irrigation**: If irrigation is `YES` but precipitation is expected ($\ge 50\%$ rain probability or $\ge 5.0\text{ mm}$ forecast), generates action to delay irrigation.
5. **Step 5: Cross-Check Disease Confidence with Crop Health**: If disease confidence is $< 65\%$, suppresses treatment advice and asks for a clearer photo.
6. **Step 6: Check Sustainability Score**: If score $< 50$ or level is `Low`, recommends timing and resource reviews.
7. **Step 7: Generate 1–4 Recommended Actions**: Selects top ranked, non-redundant actions.
8. **Step 8: Explain Why Each Action Was Selected**: Embeds clear, human-understandable `reason` and module `source` for SIH traceability.
9. **Step 9: Compile Final Situation Report**: Formulates the executive summary, individual situation indicators, and disclaimer.

---

## 5. Priority Rules Matrix

The priority engine is completely deterministic and strictly follows this matrix:

- **`CRITICAL`**:
  - High-confidence disease ($\ge 65\%$, non-healthy) **AND** Irrigation priority is `HIGH`.
- **`HIGH`**:
  - High-confidence disease ($\ge 65\%$, non-healthy) **OR** Irrigation priority is `HIGH`.
- **`MEDIUM`**:
  - Irrigation priority `MEDIUM`
  - **OR** Disease confidence between $50\%$ and $< 65\%$ (non-healthy)
  - **OR** Irrigation priority `LOW` / `REVIEW`
  - **OR** Weather risk is `HIGH` / `SEVERE`.
- **`LOW`**:
  - Healthy disease result ($\ge 65\%$) **AND** Irrigation prediction is `NO` or `NONE`.
- **`DATA INSUFFICIENT`**:
  - Insufficient actionable data (e.g. all modules empty or no actionable disease/irrigation data).

---

## 6. Action Generation & Traceability Examples

Every action returned by the advisor includes `priority`, `action`, `reason`, and `source`:

```json
{
  "priority": 1,
  "action": "Inspect affected plants and consider appropriate disease management.",
  "reason": "High-confidence disease detected (Early Blight at 92.4%).",
  "source": "Disease Detection"
}
```

```json
{
  "priority": 2,
  "action": "Consider delaying irrigation because rainfall is expected.",
  "reason": "Rain probability is high (85%) and irrigation is currently predicted as YES.",
  "source": "Weather Intelligence + Smart Irrigation"
}
```

```json
{
  "priority": 3,
  "action": "Upload a clearer leaf image for a more reliable assessment.",
  "reason": "Disease detection confidence is below 65% (54.2%). Avoid unverified treatments.",
  "source": "Disease Detection"
}
```

---

## 7. Safety Rules & Guardrails
1. **Low Disease Confidence ($< 65\%$)**: Never provides a definitive treatment; explicitly requests a clearer leaf image.
2. **Zero Chemical Dosage**: Strictly forbids generating pesticide dosages (e.g., "2 ml/L", "500 g/ha") or chemical concentrations.
3. **Zero Exact Water Litres**: Never outputs unsupported exact water litres (e.g., "1200 litres/ha", "5000 L"); uses qualitative scheduling terms.
4. **Zero Guaranteed Yield**: Prohibits guaranteed harvest claims.
5. **Explicit Missing Data**: Never fabricates missing sensor or weather data. Unreported inputs are returned as `"Data unavailable"`.

---

## 8. Example API Request & Response

### Request: `POST /api/v1/agentic-advisor`
```json
{
  "disease": {
    "crop": "Tomato",
    "disease": "Early Blight",
    "confidence": 0.924
  },
  "irrigation": {
    "prediction": "YES",
    "priority": "HIGH",
    "confidence": "95.0%"
  },
  "weather": {
    "temperature": 27.5,
    "humidity": 70.0,
    "rain_probability": 85.0,
    "forecast_precipitation": 14.0,
    "weather_risk": "HIGH"
  },
  "sustainability": {
    "score": 45.0,
    "level": "Low"
  }
}
```

### Response: `HTTP 200 OK`
```json
{
  "priority": "CRITICAL",
  "summary": "CRITICAL: Urgent multi-risk situation. High-confidence crop disease detected alongside HIGH irrigation need. Inspect affected plants and verify soil conditions immediately.",
  "situation": {
    "crop": "Tomato",
    "disease_status": "Early Blight (92.4% confidence)",
    "irrigation_status": "Irrigation Required (HIGH Priority)",
    "weather_risk": "High (27.5°C, 85% rain)",
    "sustainability": "45/100 (Low)"
  },
  "actions": [
    {
      "priority": 1,
      "action": "Inspect affected plants and consider appropriate disease management.",
      "reason": "High-confidence disease detected (Early Blight at 92.4%).",
      "source": "Disease Detection"
    },
    {
      "priority": 2,
      "action": "Consider delaying irrigation because rainfall is expected.",
      "reason": "Rain probability is high (85%) and irrigation is currently predicted as YES.",
      "source": "Weather Intelligence + Smart Irrigation"
    },
    {
      "priority": 3,
      "action": "Review weather conditions before performing field operations.",
      "reason": "Weather Intelligence reports HIGH weather risk (Heavy rain chance (85.0%)).",
      "source": "Weather Intelligence"
    },
    {
      "priority": 4,
      "action": "Review irrigation timing and resource usage.",
      "reason": "Overall sustainability score is LOW (45/100).",
      "source": "Sustainability Score"
    }
  ],
  "evidence": [
    "Disease Detection",
    "Smart Irrigation",
    "Weather Intelligence",
    "Sustainability Score"
  ],
  "missing_data": [
    "Crop Recommendation",
    "Yield Prediction"
  ],
  "safety_note": "AI-generated decision support. Verify important agricultural decisions with local conditions or an agricultural expert."
}
```

---

## 9. Limitations
1. **Advisory Nature**: The Agentic Advisor provides decision support based solely on digital sensor and AI model inputs. It is not an in-person agronomist inspection.
2. **Local Variation**: Micro-climates, soil physical anomalies, and regional pest strains should always be cross-referenced with local agricultural extension officers before costly interventions.
3. **Sensor Quality**: High accuracy depends on accurate leaf imagery and calibrated soil moisture telemetry.
