"""
Deterministic Priority Engine, Safety Filters, and Action Rules
for Module G: 🤖 Agentic Advisor.

Strictly follows agricultural safety guidelines:
- Zero chemical / pesticide dosage recommendations
- Zero exact water volume / litres recommendations
- Zero guaranteed yield claims
- Mandatory source attribution and explainable reasoning
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from .schemas import (
    DiseaseDetectionInput,
    SmartIrrigationInput,
    WeatherIntelligenceInput,
    CropRecommendationInput,
    YieldPredictionInput,
    SustainabilityScoreInput,
    ActionItem,
)


def parse_confidence(val: Optional[Any]) -> Optional[float]:
    """Normalizes confidence to 0.0 - 100.0 percentage."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        # If <= 1.0, treat as ratio 0-1
        if 0.0 <= val <= 1.0:
            return float(val * 100.0)
        return float(val)
    if isinstance(val, str):
        cleaned = val.replace('%', '').strip()
        try:
            num = float(cleaned)
            if 0.0 <= num <= 1.0:
                return float(num * 100.0)
            return float(num)
        except ValueError:
            return None
    return None


def is_disease_healthy(disease_str: Optional[str]) -> bool:
    """Checks if the disease prediction indicates a healthy plant."""
    if not disease_str:
        return False
    d = disease_str.lower().strip()
    return "healthy" in d or "none" in d or d == "normal"


def evaluate_priority(
    disease: Optional[DiseaseDetectionInput],
    irrigation: Optional[SmartIrrigationInput],
    weather: Optional[WeatherIntelligenceInput] = None,
    sustainability: Optional[SustainabilityScoreInput] = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Evaluates priority level using deterministic rules:
    - CRITICAL: High-confidence disease (>=65%) AND Irrigation priority is HIGH
    - HIGH: High-confidence disease (>=65%) OR Irrigation priority HIGH
    - MEDIUM: Irrigation priority MEDIUM OR Disease confidence between 50% and <65% OR Irrigation priority LOW/REVIEW
    - LOW: Healthy disease result (>=65%) AND Irrigation prediction is NO/NONE
    - DATA INSUFFICIENT: Insufficient actionable data
    """
    context: Dict[str, Any] = {
        "disease_conf": None,
        "is_healthy": False,
        "is_high_conf_disease": False,
        "is_med_conf_disease": False,
        "is_healthy_high_conf": False,
        "irrigation_prio": None,
        "irrigation_pred": None,
        "weather_risk": None,
        "has_actionable_data": False,
    }

    # 1. Parse Disease
    if disease and (disease.disease or disease.confidence is not None):
        conf = parse_confidence(disease.confidence)
        context["disease_conf"] = conf
        is_healthy = is_disease_healthy(disease.disease)
        context["is_healthy"] = is_healthy

        if conf is not None:
            if not is_healthy and conf >= 65.0:
                context["is_high_conf_disease"] = True
                context["has_actionable_data"] = True
            elif not is_healthy and 50.0 <= conf < 65.0:
                context["is_med_conf_disease"] = True
                context["has_actionable_data"] = True
            elif is_healthy and conf >= 65.0:
                context["is_healthy_high_conf"] = True
                context["has_actionable_data"] = True
            elif not is_healthy and conf < 50.0:
                context["has_actionable_data"] = True

    # 2. Parse Irrigation
    if irrigation and (irrigation.priority or irrigation.prediction):
        prio = str(irrigation.priority).upper().strip() if irrigation.priority else "NONE"
        pred = str(irrigation.prediction).upper().strip() if irrigation.prediction else "NONE"
        context["irrigation_prio"] = prio
        context["irrigation_pred"] = pred

        if prio in ["HIGH", "MEDIUM", "LOW", "REVIEW"] or pred in ["YES", "NO"]:
            context["has_actionable_data"] = True

    # 3. Parse Weather
    if weather and weather.weather_risk:
        w_risk = str(weather.weather_risk).upper().strip()
        context["weather_risk"] = w_risk
        if w_risk in ["HIGH", "SEVERE"]:
            context["has_actionable_data"] = True

    # 4. Check for DATA INSUFFICIENT
    if not context["has_actionable_data"]:
        return "DATA INSUFFICIENT", context

    # 5. Evaluate Priority Engine Hierarchically
    is_high_disease = context["is_high_conf_disease"]
    irr_prio = context["irrigation_prio"]
    irr_pred = context["irrigation_pred"]
    is_med_disease = context["is_med_conf_disease"]
    is_healthy_high = context["is_healthy_high_conf"]

    # Rule 1: CRITICAL
    # High-confidence disease (>=65%) AND Irrigation priority is HIGH
    if is_high_disease and irr_prio == "HIGH":
        return "CRITICAL", context

    # Rule 2: HIGH
    # High-confidence disease >=65% OR Irrigation priority HIGH
    if is_high_disease or irr_prio == "HIGH":
        return "HIGH", context

    # Rule 3: MEDIUM
    # Irrigation priority MEDIUM OR Disease confidence between 50% and <65% OR Irrigation priority LOW/REVIEW
    if (
        irr_prio == "MEDIUM"
        or is_med_disease
        or irr_prio in ["LOW", "REVIEW"]
        or context["weather_risk"] in ["HIGH", "SEVERE"]
    ):
        return "MEDIUM", context

    # Rule 4: LOW
    # Healthy disease result >=65% AND Irrigation prediction is NO/NONE
    if is_healthy_high and irr_pred in ["NO", "NONE"] and irr_prio not in ["HIGH", "MEDIUM"]:
        return "LOW", context

    # If healthy disease with undefined irrigation, or low-confidence disease without irrigation
    if is_healthy_high and irr_pred is None:
        return "LOW", context

    if not is_high_disease and not is_med_disease and irr_prio == "NONE" and irr_pred in ["NO", "NONE"]:
        return "LOW", context

    return "DATA INSUFFICIENT", context


def sanitize_action_text(text: str) -> str:
    """
    Safety Guardrail: Ensures no chemical dosages, exact water litres,
    or guaranteed treatment/yield are present in the text.
    """
    # Remove exact water litres (e.g., '1500 litres', '250 L', '12.5 litres/ha')
    text = re.sub(r'\b\d+(\.\d+)?\s*(litres?|liters?|L|l/ha|litres/ha)\b', 'indicated irrigation amount', text, flags=re.IGNORECASE)
    # Remove chemical dosage patterns (e.g., '2.5 ml/L', '500 g/ha', '2 kg/acre')
    text = re.sub(r'\b\d+(\.\d+)?\s*(ml/L|g/ha|kg/ha|kg/acre|ppm)\b', 'recommended label dosage', text, flags=re.IGNORECASE)
    # Remove guarantee words
    text = re.sub(r'\bguaranteed\b', 'estimated', text, flags=re.IGNORECASE)
    return text.strip()


def generate_recommended_actions(
    disease: Optional[DiseaseDetectionInput],
    irrigation: Optional[SmartIrrigationInput],
    weather: Optional[WeatherIntelligenceInput],
    sustainability: Optional[SustainabilityScoreInput],
    crop_rec: Optional[CropRecommendationInput],
    yield_pred: Optional[YieldPredictionInput],
    priority: str,
    context: Dict[str, Any],
) -> List[ActionItem]:
    """
    Generates 1 to 4 actionable, explainable recommendations with source attribution.
    """
    candidate_actions: List[Dict[str, Any]] = []

    # --- Rule A: Disease Recommendations ---
    if disease and disease.disease:
        conf = context.get("disease_conf")
        is_healthy = context.get("is_healthy", False)

        if not is_healthy:
            if conf is not None and conf >= 65.0:
                candidate_actions.append({
                    "score": 100,
                    "action": "Inspect affected plants and consider appropriate disease management.",
                    "reason": f"High-confidence disease detected ({disease.disease} at {conf:.1f}%).",
                    "source": "Disease Detection",
                })
            elif conf is not None and conf < 65.0:
                candidate_actions.append({
                    "score": 85,
                    "action": "Upload a clearer leaf image for a more reliable assessment.",
                    "reason": f"Disease detection confidence is below 65% ({conf:.1f}%). Avoid unverified treatments.",
                    "source": "Disease Detection",
                })
            else:
                candidate_actions.append({
                    "score": 75,
                    "action": "Inspect foliage for disease symptoms and verify with localized field scouting.",
                    "reason": f"Potential symptom detected ({disease.disease}).",
                    "source": "Disease Detection",
                })

    # --- Rule B: Smart Irrigation & Weather Cross-Check ---
    irr_pred = context.get("irrigation_pred")
    irr_prio = context.get("irrigation_prio")
    rain_prob = weather.rain_probability if weather and weather.rain_probability is not None else None
    forecast_precip = weather.forecast_precipitation if weather and weather.forecast_precipitation is not None else None

    is_rain_expected = (rain_prob is not None and rain_prob >= 50.0) or (forecast_precip is not None and forecast_precip >= 5.0)

    if irr_pred == "YES":
        if is_rain_expected:
            candidate_actions.append({
                "score": 95,
                "action": "Consider delaying irrigation because rainfall is expected.",
                "reason": f"Rain probability is high ({rain_prob or 0:.0f}%) and irrigation is currently predicted as YES.",
                "source": "Weather Intelligence + Smart Irrigation",
            })
        elif irr_prio == "HIGH":
            candidate_actions.append({
                "score": 90,
                "action": "Check soil moisture and irrigation conditions before the next irrigation cycle.",
                "reason": "Irrigation model predicted YES with HIGH priority.",
                "source": "Smart Irrigation",
            })
        else:
            candidate_actions.append({
                "score": 80,
                "action": "Schedule regular irrigation according to current soil moisture depletion.",
                "reason": "The irrigation model predicts irrigation is required.",
                "source": "Smart Irrigation",
            })
    elif irr_pred == "NO":
        if context.get("is_healthy_high_conf") and priority == "LOW":
            candidate_actions.append({
                "score": 60,
                "action": "Current AI indicators do not show an urgent irrigation or disease action.",
                "reason": "Plant is diagnosed as healthy and the irrigation model predicts that irrigation is not currently required under the provided conditions.",
                "source": "Disease Detection + Smart Irrigation",
            })
        else:
            candidate_actions.append({
                "score": 65,
                "action": "No irrigation action is currently indicated by the irrigation model.",
                "reason": "The irrigation model predicts that irrigation is not currently required under the provided conditions.",
                "source": "Smart Irrigation",
            })

    # --- Rule C: Weather Risk ---
    if weather and weather.weather_risk:
        w_risk = str(weather.weather_risk).upper().strip()
        if w_risk in ["HIGH", "SEVERE"]:
            detail = []
            if weather.temperature is not None and weather.temperature > 38.0:
                detail.append(f"Extreme heat ({weather.temperature}°C)")
            if weather.rain_probability is not None and weather.rain_probability > 70.0:
                detail.append(f"Heavy rain chance ({weather.rain_probability}%)")
            detail_str = ", ".join(detail) if detail else f"Adverse conditions ({w_risk})"

            candidate_actions.append({
                "score": 88,
                "action": "Review weather conditions before performing field operations.",
                "reason": f"Weather Intelligence reports HIGH weather risk ({detail_str}).",
                "source": "Weather Intelligence",
            })

    # --- Rule D: Sustainability Score ---
    if sustainability and sustainability.score is not None:
        score = sustainability.score
        level = sustainability.level or ("Low" if score < 50 else ("Moderate" if score < 75 else "High"))
        if score < 50 or level.lower() == "low":
            candidate_actions.append({
                "score": 70,
                "action": "Review irrigation timing and resource usage.",
                "reason": f"Overall sustainability score is LOW ({score:.0f}/100).",
                "source": "Sustainability Score",
            })

    # --- Rule E: Fallback for Data Insufficient ---
    if not candidate_actions:
        if priority == "DATA INSUFFICIENT":
            candidate_actions.append({
                "score": 50,
                "action": "Provide crop leaf images, soil moisture readings, or weather data.",
                "reason": "Insufficient module telemetry to generate high-confidence field actions.",
                "source": "System Telemetry Check",
            })
        else:
            candidate_actions.append({
                "score": 50,
                "action": "Continue regular field observation and crop monitoring.",
                "reason": "All available parameters are within normal baseline thresholds.",
                "source": "Decision Support Engine",
            })

    # Sort candidate actions by score descending, select top 1 to 4 actions
    candidate_actions.sort(key=lambda x: x["score"], reverse=True)
    selected = candidate_actions[:4]

    # Convert to ActionItem with 1-based sequential priority and sanitization
    output_actions: List[ActionItem] = []
    for rank, item in enumerate(selected, 1):
        output_actions.append(
            ActionItem(
                priority=rank,
                action=sanitize_action_text(item["action"]),
                reason=item["reason"],
                source=item["source"],
            )
        )

    return output_actions
