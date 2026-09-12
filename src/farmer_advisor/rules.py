"""
AgriSmart AI – Farmer Advisory Rules & Decision Engine
Implements deterministic, transparent agronomic decision rules, safety boundaries,
and priority arbitration combining disease, irrigation, yield, and crop recommendation.
"""
from typing import Dict, Any, List, Tuple, Optional

# Safe confidence threshold for disease detection
DISEASE_SAFE_CONFIDENCE_THRESHOLD = 0.65

# Practical agronomic disease management knowledgebase (cultural, preventive, non-dosage)
DISEASE_AGRONOMIC_GUIDANCE: Dict[str, Dict[str, Any]] = {
    "Early Blight": {
        "type": "Fungal (Alternaria solani)",
        "guidance": "Prune lower infected leaves showing concentric 'target-board' rings. Avoid overhead watering to minimize leaf wetness duration. Mulch soil around plant base to prevent soil-splash spore dispersal.",
        "action": "Sanitation and preventative canopy airflow enhancement."
    },
    "Late Blight": {
        "type": "Oomycete (Phytophthora infestans)",
        "guidance": "Highly aggressive in cool, humid conditions. Immediately remove and destroy severely infected foliage (do not compost). Ensure rapid foliage drying and inspect neighboring rows daily.",
        "action": "Immediate field quarantine and containment."
    },
    "Common Rust": {
        "type": "Fungal (Puccinia sorghi)",
        "guidance": "Rust pustules deplete photosynthetic capacity. Monitor lesion spread on upper leaf whorls. Avoid excess nitrogen fertilization which promotes lush, susceptible leaf tissue.",
        "action": "Canopy monitoring and balanced nutrition."
    },
    "Black Rot": {
        "type": "Fungal (Botryosphaeria obtusa)",
        "guidance": "Prune out mummified fruit, dead wood, and cankers during dry weather. Sterilize pruning shears with 70% alcohol between cuts.",
        "action": "Sanitation and wood sanitation."
    },
    "Apple Scab": {
        "type": "Fungal (Venturia inaequalis)",
        "guidance": "Rake and destroy fallen leaves in autumn to eliminate overwintering fungal ascospores. Prune inner branches to improve sunlight penetration and air movement.",
        "action": "Orchard floor sanitation and aeration."
    },
    "Bacterial Spot": {
        "type": "Bacterial (Xanthomonas)",
        "guidance": "Avoid field operations while foliage is wet to prevent mechanical spreading of bacterial ooze. Sanitize stakes, cages, and equipment.",
        "action": "Prevent mechanical moisture transfer."
    },
    "Leaf Mold": {
        "type": "Fungal (Passalora fulva)",
        "guidance": "Typically thrives in high humidity (>85%). Increase greenhouse or row ventilation, reduce plant density, and ensure early morning watering.",
        "action": "Humidity reduction and ventilation."
    },
    "Yellow Leaf Curl Virus": {
        "type": "Viral (Begomovirus)",
        "guidance": "Transmitted by sweetpotato whiteflies (Bemisia tabaci). Install yellow sticky traps for vector monitoring. Remove and bag infected stunted plants immediately.",
        "action": "Vector control and rogueing of infected hosts."
    }
}


def evaluate_disease_advisory(disease_result: Optional[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """
    Evaluates disease prediction with strict safety boundaries.
    Returns:
        (sanitized_disease_info, recommendations, warnings)
    """
    recs: List[str] = []
    warnings: List[str] = []

    if not disease_result:
        return {
            "name": "Data unavailable",
            "confidence": 0.0,
            "status": "not_provided"
        }, recs, warnings

    name = disease_result.get("disease", disease_result.get("name", "Unknown"))
    conf = float(disease_result.get("confidence", 0.0))
    crop_name = disease_result.get("crop", "Crop")

    sanitized = {
        "name": name,
        "confidence": round(conf, 4),
        "status": "evaluated"
    }

    # Low confidence handling (< 0.65)
    if conf < DISEASE_SAFE_CONFIDENCE_THRESHOLD:
        recs.append("Low confidence prediction. Please capture a clearer leaf image in natural diffuse daylight showing both upper and lower leaf surfaces.")
        warnings.append(f"Disease detection confidence ({conf:.1%}) is below the safe actionable threshold ({DISEASE_SAFE_CONFIDENCE_THRESHOLD:.0%}). Avoid applying chemical fungicides until verified.")
        return sanitized, recs, warnings

    # Healthy crop handling
    if "healthy" in name.lower():
        recs.append(f"{crop_name} foliage appears healthy with no visible active pathogens detected. Maintain regular weekly scouting and balanced fertilization.")
        return sanitized, recs, warnings

    # High confidence diseased crop handling
    matched_info = None
    for k, v in DISEASE_AGRONOMIC_GUIDANCE.items():
        if k.lower() in name.lower():
            matched_info = v
            break

    if matched_info:
        recs.append(f"Disease Identified ({name} - {matched_info['type']}): {matched_info['guidance']}")
    else:
        recs.append(f"Disease Identified ({name}): Prune and isolate infected foliage. Avoid overhead sprinkler irrigation to minimize spore germination.")

    # Safety disclaimer regarding chemical dosages
    recs.append("For chemical treatment, bio-pesticides, or specific dosage schedules, consult a local certified agricultural extension officer or agronomist.")

    return sanitized, recs, warnings


def evaluate_irrigation_advisory(irrigation_result: Optional[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """
    Evaluates irrigation model outputs and maps transparent priority actions.
    """
    recs: List[str] = []
    warnings: List[str] = []

    if not irrigation_result:
        return {
            "required": False,
            "priority": "Data unavailable",
            "confidence": 0.0
        }, recs, warnings

    req = bool(irrigation_result.get("irrigation_required", False) or str(irrigation_result.get("prediction", "")).upper() == "YES")
    prio = str(irrigation_result.get("priority", "NONE")).upper()
    conf = float(irrigation_result.get("confidence", 1.0))

    sanitized = {
        "required": req,
        "priority": prio,
        "confidence": round(conf, 4)
    }

    if req and prio == "HIGH":
        recs.append("The irrigation model predicts that irrigation is required under the provided conditions (High Priority). Initiate an irrigation cycle (preferably drip in early morning) to alleviate moisture deficit.")
        warnings.append("High moisture deficit: The irrigation model predicts that irrigation is required under the provided conditions to avoid crop water stress.")
    elif req and prio == "MEDIUM":
        recs.append("The irrigation model predicts that irrigation is required under the provided conditions (Medium Priority). Schedule a maintenance irrigation cycle within the next 24 to 36 hours.")
    elif prio in ["LOW", "REVIEW"] or (req and conf < 0.65):
        recs.append("Monitor soil moisture and weather: Marginal moisture variance detected. Check field probes and review rainfall forecasts before applying artificial irrigation.")
    else:
        recs.append("Optimal soil moisture: The irrigation model predicts that irrigation is not required under the provided conditions. Conserve water.")

    # Safety note: no exact volume without water-quantity model
    recs.append("Exact volumetric water delivery: Data unavailable (apply calibrated drip cycles tailored to field soil type).")

    return sanitized, recs, warnings


def evaluate_yield_advisory(yield_result: Optional[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Generates realistic estimated yield guidance without fake confidence intervals.
    """
    recs: List[str] = []

    if not yield_result or "predicted_yield" not in yield_result:
        return {
            "estimated": "Data unavailable",
            "unit": "Tonnes/Ha"
        }, recs

    val = float(yield_result["predicted_yield"])
    unit = str(yield_result.get("unit", "Tonnes/Ha"))

    sanitized = {
        "estimated": round(val, 2),
        "unit": unit
    }

    recs.append(f"Estimated yield expectation is {val:.2f} {unit} based on regional historical performance and seasonal conditions.")
    recs.append("Note: Estimated yield is an agronomic projection; actual harvest will vary with weather extremes, pest incidence, and timely field management.")

    return sanitized, recs


def evaluate_crop_recommendation_advisory(crop_rec_result: Optional[Dict[str, Any]]) -> Tuple[Optional[str], List[str], List[str]]:
    """
    Evaluates crop recommendation and flags low-confidence choices.
    """
    recs: List[str] = []
    warnings: List[str] = []

    if not crop_rec_result or "recommended_crop" not in crop_rec_result:
        return None, recs, warnings

    crop = str(crop_rec_result["recommended_crop"])
    conf = float(crop_rec_result.get("confidence", 0.0))

    if conf >= 0.60:
        recs.append(f"Recommended crop choice: {crop.capitalize()} is highly suitable for your soil N-P-K nutrient balance and climatic profile ({conf:.1%} model confidence).")
    else:
        recs.append(f"Exploratory crop recommendation: {crop.capitalize()} showed marginal compatibility ({conf:.1%} confidence). Verify with local soil test laboratory before large-scale planting.")
        warnings.append(f"Crop recommendation confidence is moderate ({conf:.1%}). Ensure seed variety is adapted to your local agro-climatic zone.")

    return crop, recs, warnings


def compute_overall_priority(
    disease_info: Dict[str, Any],
    irrigation_info: Dict[str, Any]
) -> Tuple[str, str]:
    """
    Computes overall farm status and priority using transparent rule-based logic.

    Rules:
    - CRITICAL: High-confidence disease detected (non-healthy) AND Irrigation priority == HIGH.
    - HIGH: High-confidence disease detected OR Irrigation priority == HIGH.
    - MEDIUM: Irrigation priority == MEDIUM OR disease confidence moderate (0.50 - 0.65).
    - LOW: Healthy crop AND irrigation not required.
    """
    dis_name = str(disease_info.get("name", "")).lower()
    dis_conf = float(disease_info.get("confidence", 0.0))
    is_diseased = ("healthy" not in dis_name) and (dis_name != "data unavailable") and (dis_name != "unknown")
    is_high_conf_disease = is_diseased and (dis_conf >= DISEASE_SAFE_CONFIDENCE_THRESHOLD)

    irr_prio = str(irrigation_info.get("priority", "NONE")).upper()
    is_high_irr = irr_prio == "HIGH"
    is_med_irr = irr_prio == "MEDIUM"

    if is_high_conf_disease and is_high_irr:
        return "Critical Intervention Required", "CRITICAL"
    elif is_high_conf_disease or is_high_irr:
        return "Attention Required", "HIGH"
    elif is_med_irr or (is_diseased and dis_conf >= 0.50) or irr_prio in ["LOW", "REVIEW"]:
        return "Routine Monitoring Advised", "MEDIUM"
    else:
        return "Optimal / Good Condition", "LOW"
