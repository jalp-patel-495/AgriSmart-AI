"""
Module G: 🤖 Agentic Advisor Orchestration Engine
Implements the 9-step deterministic agentic workflow to synthesize multi-module
telemetry into prioritized, explainable farm actions without retraining or LLM hallucinations.
"""
from typing import List, Dict, Any, Optional
from .schemas import (
    AgenticAdvisorRequest,
    AgenticAdvisorResponse,
    SituationStatus,
    ActionItem,
)
from .rules import (
    parse_confidence,
    is_disease_healthy,
    evaluate_priority,
    generate_recommended_actions,
)


class AgenticAdvisor:
    """
    Deterministic Decision-Support Orchestrator.
    Combines Disease Detection, Smart Irrigation, Weather Intelligence,
    Crop Recommendation, Yield Prediction, and Sustainability Score.
    """

    def evaluate(self, req: AgenticAdvisorRequest) -> AgenticAdvisorResponse:
        disease = req.disease
        irrigation = req.irrigation
        weather = req.weather
        crop_rec = req.crop_recommendation
        yield_pred = req.yield_prediction
        sustainability = req.sustainability

        # =====================================================================
        # STEP 1: Check Available Data & Compile Evidence / Missing Data
        # =====================================================================
        evidence: List[str] = []
        missing_data: List[str] = []

        # Disease Detection
        has_disease = bool(disease and (disease.disease or disease.confidence is not None))
        if has_disease:
            evidence.append("Disease Detection")
        else:
            missing_data.append("Disease Detection")

        # Smart Irrigation
        has_irrigation = bool(irrigation and (irrigation.prediction or irrigation.priority))
        if has_irrigation:
            evidence.append("Smart Irrigation")
        else:
            missing_data.append("Smart Irrigation")

        # Weather Intelligence
        has_weather = bool(weather and (weather.temperature is not None or weather.rain_probability is not None or weather.weather_risk))
        if has_weather:
            evidence.append("Weather Intelligence")
        else:
            missing_data.append("Weather Intelligence")

        # Crop Recommendation
        has_crop_rec = bool(crop_rec and crop_rec.recommended_crop)
        if has_crop_rec:
            evidence.append("Crop Recommendation")
        else:
            missing_data.append("Crop Recommendation")

        # Yield Prediction
        has_yield = bool(yield_pred and yield_pred.estimated_yield is not None)
        if has_yield:
            evidence.append("Yield Prediction")
        else:
            missing_data.append("Yield Prediction")

        # Sustainability Score
        has_sustainability = bool(sustainability and sustainability.score is not None)
        if has_sustainability:
            evidence.append("Sustainability Score")
        else:
            missing_data.append("Sustainability Score")

        # =====================================================================
        # STEP 2 & 3: Prioritize Risks using Priority Engine
        # =====================================================================
        priority, context = evaluate_priority(
            disease=disease,
            irrigation=irrigation,
            weather=weather,
            sustainability=sustainability,
        )

        # =====================================================================
        # STEP 4, 5, 6, 7 & 8: Cross-Check & Generate 1-4 Ranked Actions
        # =====================================================================
        actions: List[ActionItem] = generate_recommended_actions(
            disease=disease,
            irrigation=irrigation,
            weather=weather,
            sustainability=sustainability,
            crop_rec=crop_rec,
            yield_pred=yield_pred,
            priority=priority,
            context=context,
        )

        # =====================================================================
        # STEP 9: Build Situation Status and Summary
        # =====================================================================
        # Determine Crop Name
        crop_name = "Data unavailable"
        if disease and disease.crop:
            crop_name = disease.crop
        elif crop_rec and crop_rec.recommended_crop:
            crop_name = crop_rec.recommended_crop

        # Determine Disease Status
        disease_status = "Data unavailable"
        if disease and disease.disease:
            conf = context.get("disease_conf")
            conf_str = f" ({conf:.1f}% confidence)" if conf is not None else ""
            if context.get("is_healthy"):
                disease_status = f"Healthy{conf_str}"
            else:
                prefix = "Low-confidence " if (conf is not None and conf < 65.0) else ""
                disease_status = f"{prefix}{disease.disease}{conf_str}"

        # Determine Irrigation Status
        irrigation_status = "Data unavailable"
        if irrigation and (irrigation.prediction or irrigation.priority):
            pred = context.get("irrigation_pred", "NONE")
            prio = context.get("irrigation_prio", "NONE")
            if pred == "YES":
                irrigation_status = f"Irrigation Required ({prio} Priority)"
            elif pred == "NO":
                irrigation_status = "Adequate (No Irrigation Needed)"
            elif prio != "NONE":
                irrigation_status = f"Status: {prio} Priority"

        # Determine Weather Risk
        weather_risk_status = "Data unavailable"
        if weather and weather.weather_risk:
            w_risk = weather.weather_risk
            temp_str = f"{weather.temperature:.1f}°C" if weather.temperature is not None else ""
            rain_str = f"{weather.rain_probability:.0f}% rain" if weather.rain_probability is not None else ""
            details = [x for x in [temp_str, rain_str] if x]
            det_joined = f" ({', '.join(details)})" if details else ""
            weather_risk_status = f"{w_risk.capitalize()}{det_joined}"
        elif weather and weather.temperature is not None:
            weather_risk_status = f"Normal ({weather.temperature:.1f}°C)"

        # Determine Sustainability Status
        sustainability_status = "Data unavailable"
        if sustainability and sustainability.score is not None:
            s_lvl = sustainability.level or ("High" if sustainability.score >= 75 else ("Moderate" if sustainability.score >= 50 else "Low"))
            sustainability_status = f"{sustainability.score:.0f}/100 ({s_lvl})"

        situation = SituationStatus(
            crop=crop_name,
            disease_status=disease_status,
            irrigation_status=irrigation_status,
            weather_risk=weather_risk_status,
            sustainability=sustainability_status,
        )

        # Formulate Executive Summary
        if priority == "CRITICAL":
            summary = "CRITICAL: Urgent multi-risk situation. High-confidence crop disease detected alongside HIGH irrigation need. Inspect affected plants and verify soil conditions immediately."
        elif priority == "HIGH":
            reasons = []
            if context.get("is_high_conf_disease"):
                reasons.append("high-confidence crop disease")
            if context.get("irrigation_prio") == "HIGH":
                reasons.append("high irrigation urgency")
            reason_str = " and ".join(reasons) if reasons else "high-priority field condition"
            summary = f"HIGH: Prompt field action recommended due to {reason_str}."
        elif priority == "MEDIUM":
            summary = "MEDIUM: Moderate agricultural attention required. Review irrigation timing or re-assess diagnostic images as recommended below."
        elif priority == "LOW":
            summary = "LOW: Current farm conditions are stable. AI models indicate healthy crop foliage and adequate soil moisture."
        else:
            summary = "DATA INSUFFICIENT: Incomplete sensor or diagnostic data. Please provide leaf images, soil moisture readings, or weather data for a comprehensive advisory."

        return AgenticAdvisorResponse(
            priority=priority,
            summary=summary,
            situation=situation,
            actions=actions,
            evidence=evidence,
            missing_data=missing_data,
            safety_note=(
                "AI-generated decision support. Verify important agricultural decisions with local conditions or an agricultural expert."
            ),
        )


# Global singleton instance for service calls
agentic_advisor_engine = AgenticAdvisor()
