"""
AgriSmart AI – Multilingual Farmer Advisory Assistant
Provides contextual agronomic advisory in English, Gujarati, and Hindi.
"""
from typing import Dict, Any, Optional
import os


def detect_language(text: str) -> str:
    """
    Detects whether query is in Gujarati, Hindi, or English.
    """
    # Gujarati unicode range: \u0A80 - \u0AFF
    for ch in text:
        if '\u0a80' <= ch <= '\u0aff':
            return "gu"
        # Devanagari (Hindi) unicode range: \u0900 - \u097F
        elif '\u0900' <= ch <= '\u097f':
            return "hi"
    return "en"


def ask_farmer_assistant(
    question: str,
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Context-aware farmer assistant supporting English, Gujarati, and Hindi.
    context: {"crop": "Tomato", "disease": "Early Blight", "soil_moisture": 30.0, "weather": {...}}
    """
    if not question or not question.strip():
        return {
            "status": "error",
            "answer": "Please ask a question regarding your crop, disease, or irrigation schedule.",
            "language": "en"
        }

    lang = detect_language(question)
    crop = (context or {}).get("crop", "Crop")
    disease = (context or {}).get("disease", "None")
    q_lower = question.lower()

    # Contextual knowledge retrieval & responses
    if lang == "gu":
        # Gujarati response
        if "પાણી" in question or "સિંચાઈ" in question:
            ans = f"તમારા {crop} પાક માટે ડ્રિપ પદ્ધતિથી નિયમિત પાણી આપો. પાંદડા પર પાણી છાંટવાનું ટાળો જેથી ફૂગનો ફેલાવો અટકે."
        elif "રોગ" in question or "ઉપચાર" in question:
            ans = f"{crop} પાકમાં {disease} ના લક્ષણો દેખાય ત્યારે ચેપગ્રસ્ત પાંદડા દૂર કરો અને યોગ્ય બાયો-ફંગિસાઇડનો છંટકાવ કરો."
        else:
            ans = f"નમસ્તે ખેડૂત મિત્ર! તમારા {crop} પાકની તંદુરસ્તી જાળવવા હવામાન અને જમીનની ભેજ પર સતત નજર રાખો."

    elif lang == "hi":
        # Hindi response
        if "पानी" in question or "सिंचाई" in question:
            ans = f"आपकी {crop} फसल के लिए ड्रिप सिंचाई सबसे उत्तम है। पत्तियों पर सीधे पानी न डालें ताकि फंगल संक्रमण न फैले।"
        elif "रोग" in question or "इलाज" in question or "दवा" in question:
            ans = f"{crop} में {disease} के नियंत्रण हेतु रोगग्रस्त पत्तियों को तुरंत हटा दें और उचित जैविक फफूंदनाशક का छिड़काव करें।"
        else:
            ans = f"नमस्ते किसान भाई! {crop} फसल के बेहतर उत्पादन के लिए मिट्टी की नमी और मौसम की स्थिति का ध्यान रखें।"

    else:
        # English response
        if any(w in q_lower for w in ["water", "irrigat", "moisture"]):
            ans = f"For your {crop}, implement localized drip irrigation directly at the root zone. Avoid overhead sprinkling to prevent foliar fungal spore germination."
        elif any(w in q_lower for w in ["disease", "cure", "spray", "treatment", "blight", "spots"]):
            ans = f"For managing {disease} on {crop}, remove heavily damaged lower foliage to improve canopy aeration. Disinfect tools and apply preventative copper or organic bio-fungicides."
        elif any(w in q_lower for w in ["fertiliz", "npk", "nutrient", "soil"]):
            ans = f"Ensure balanced nitrogen and potassium supplementation for {crop}. Excessive vegetative nitrogen can increase susceptibility to foliar pathogens."
        else:
            ans = f"Hello Grower! For your {crop} facing {disease}, maintain regular field scouting, optimize moisture schedules, and prioritize preventative biological control."

    return {
        "status": "success",
        "question": question,
        "answer": ans,
        "language": lang,
        "context_applied": {
            "crop": crop,
            "disease": disease
        }
    }
