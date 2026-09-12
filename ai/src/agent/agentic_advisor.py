"""
AgriSmart AI – Agentic Agricultural Advisor
Synthesizes Disease Detection, Weather Telemetry, Irrigation, and Sustainability
into prioritized agronomic action plans.
"""
from typing import Dict, Any, List


def agriculture_advisor(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Holistic reasoning engine combining all farm intelligence streams:
    data = {
        "disease_prediction": {"disease": "Early Blight", "crop": "Tomato", "confidence": 0.94},
        "weather": {"humidity": 82.0, "rain_probability": 15.0, "temperature": 27.0},
        "soil": {"moisture": 28.0, "ph": 6.5},
        "sustainability_score": 78.0
    }
    """
    disease_info = data.get("disease_prediction", {})
    weather = data.get("weather", {})
    soil = data.get("soil", {})

    disease = disease_info.get("disease", "None")
    crop = disease_info.get("crop", "Crop")
    conf = float(disease_info.get("confidence", 0.0))

    humidity = float(weather.get("humidity", 60.0))
    rain_prob = float(weather.get("rain_probability", 0.0))
    soil_moisture = float(soil.get("moisture", 40.0))

    actions: List[str] = []

    # Priority determination
    if "blight" in disease.lower() or ("healthy" not in disease.lower() and conf > 0.80):
        priority = "CRITICAL_ACTION_REQUIRED"
        recommendation = f"Immediate containment of {disease} on {crop}"
        reason = f"High diagnostic confidence ({int(conf*100)}%) of active foliar pathology under conducive ambient humidity ({humidity}%)."
        actions.append(f"Prune lower infected leaves showing symptoms of {disease}.")
        actions.append("Avoid overhead wetting during irrigation to impede spore motility.")
        actions.append("Sanitize all cutting tools with alcohol before moving between plots.")
    elif soil_moisture < 30.0 and rain_prob < 30.0:
        priority = "HIGH_IRRIGATION_DEFICIT"
        recommendation = f"Initiate Root-Zone Drip Irrigation for {crop}"
        reason = f"Soil moisture depleted to {soil_moisture}% with negligible rain probability ({rain_prob}%)."
        actions.append("Schedule 2.5 hours of localized drip hydration in early morning.")
    elif humidity > 80.0:
        priority = "PREVENTATIVE_ALERT"
        recommendation = "Canopy Ventilation & Pathogen Scouting"
        reason = "Extended high humidity creates micro-environment favorable to fungal germination."
        actions.append("Scout lower canopy for circular target spots or yellowing halos.")
    else:
        priority = "ROUTINE_OPTIMIZATION"
        recommendation = f"Maintain standard seasonal management for {crop}"
        reason = "No acute foliar pathogens or severe moisture deficits detected."
        actions.append("Continue regular scouting and periodic soil nutrient testing.")

    return {
        "priority": priority,
        "recommendation": recommendation,
        "reason": reason,
        "confidence": conf if conf > 0 else 0.90,
        "actions": actions,
        "crop_context": crop,
        "active_disease": disease
    }
