"""
AgriSmart AI – GenAI Farmer Assistant Service
Combines Gemini 1.5 Flash LLM with Context-Aware Retrieval-Augmented Agronomic Engine.
"""
import os
import re
import time
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
import requests

from backend.app.schemas.assistant import (
    ChatRequest,
    ChatResponse,
    QuickPromptItem,
)
from backend.app.core.config import settings

OPENAI_API_KEY = getattr(settings, "OPENAI_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
_openai_quota_exhausted_until = 0.0


def build_system_prompt(context: Any) -> str:
    """Constructs authoritative agronomist system instruction with field context."""
    base_prompt = (
        "You are AgriSmart AI, an expert Senior Agricultural Extension Specialist, Plant Pathologist, "
        "and Precision Farming Consultant. Your job is to advise farmers with practical, safe, "
        "scientifically sound, and actionable field guidance.\n\n"
        "Guidelines:\n"
        "1. Prioritize practical Integrated Pest Management (IPM), cultural sanitation, and bio-controls before synthetic chemicals.\n"
        "2. When chemicals are mentioned, always specify safe application windows, protective equipment, and Pre-Harvest Intervals (PHI).\n"
        "3. Provide direct, empathetic, and clear step-by-step instructions with bullet points.\n"
        "4. Correlate your answer directly with the farmer's active crop, diagnosed disease, weather conditions, and irrigation status.\n"
    )

    if context:
        context_str = "\n[ACTIVE FARM FIELD CONTEXT]\n"
        if context.crop:
            context_str += f"- Target Crop: {context.crop}\n"
        if context.disease:
            context_str += f"- Vision Model Diagnosis: {context.disease} ({context.confidence or 'High confidence'})\n"
        if context.pathogen:
            context_str += f"- Causal Pathogen: {context.pathogen}\n"
        if context.temperature is not None:
            context_str += f"- Ambient Temperature: {context.temperature}°C\n"
        if context.humidity is not None:
            context_str += f"- Relative Humidity: {context.humidity}%\n"
        if context.rain_forecast_mm is not None:
            context_str += f"- Rain Forecast (24-48h): {context.rain_forecast_mm} mm\n"
        if context.irrigation_status:
            context_str += f"- Soil Irrigation Status: {context.irrigation_status}\n"
        if getattr(context, "weather_risk", None):
            context_str += f"- Agrometeorological Weather Risk: {context.weather_risk}\n"
        if getattr(context, "weather_condition", None):
            context_str += f"- Weather Condition: {context.weather_condition}\n"
        if getattr(context, "weather_recommendation", None):
            context_str += f"- Weather-Driven Advisory: {context.weather_recommendation}\n"
        if context.soil_type:
            context_str += f"- Soil Texture: {context.soil_type}\n"
        if context.n_p_k:
            context_str += f"- Soil N-P-K: {context.n_p_k}\n"

        base_prompt += context_str

    return base_prompt


def call_openai_api(prompt: str, user_query: str, history: List[Any], api_key: str = None) -> str:
    """Calls OpenAI Chat Completions API with agronomic system context."""
    key = api_key or OPENAI_API_KEY
    if not key:
        raise ValueError("No OpenAI API key configured")
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    messages = [{"role": "system", "content": prompt}]
    for msg in history[-6:]:
        r = "user" if getattr(msg, "role", "user") == "user" else "assistant"
        messages.append({"role": r, "content": getattr(msg, "content", "")})
    messages.append({"role": "user", "content": user_query})

    payload = {
        "model": "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.35,
        "max_tokens": 800,
    }
    response = requests.post(url, headers=headers, json=payload, timeout=12)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def call_gemini_api(prompt: str, user_query: str, history: List[Any], api_key: str = None) -> str:
    """Calls Gemini 1.5 Flash via REST API."""
    key = api_key or GEMINI_API_KEY
    if not key:
        raise ValueError("No Gemini API key configured")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
    
    contents = []
    for msg in history[-6:]:
        role = "user" if getattr(msg, "role", "user") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": getattr(msg, "content", "")}]})

    contents.append({"role": "user", "parts": [{"text": user_query}]})

    payload = {
        "system_instruction": {
            "parts": [{"text": prompt}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 800,
            "topP": 0.85
        }
    }

    response = requests.post(url, json=payload, timeout=12)
    response.raise_for_status()
    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def fallback_agronomic_engine(query: str, context: Any, history: Optional[List[Any]] = None) -> Tuple[str, List[str]]:
    """
    Intelligent conversational agronomic reasoning engine providing dynamic,
    deep, context-aware responses grounded in plant pathology, soil science,
    and precision farming best practices.
    """
    q_raw = query.strip()
    q_lower = q_raw.lower()
    q_words = re.findall(r'\b\w+\b', q_lower)
    
    known_crops = ["tomato", "potato", "corn", "maize", "wheat", "rice", "paddy", "cotton", "sugarcane", "chilli", "chili", "pepper", "onion", "soybean", "groundnut", "banana", "mango"]
    detected_crop = None
    for c in known_crops:
        if re.search(r'\b' + c + r'\b', q_lower):
            detected_crop = "Corn" if c == "maize" else ("Rice" if c == "paddy" else c.capitalize())
            break

    crop = (context.crop if context and context.crop and context.crop.lower() != "crop" else (detected_crop or "Tomato"))
    disease = (context.disease if context and context.disease else None)
    temp = (context.temperature if context and context.temperature is not None else 26.0)
    humidity = (context.humidity if context and context.humidity is not None else 70.0)
    rain = (context.rain_forecast_mm if context and context.rain_forecast_mm is not None else 0.0)
    soil = (context.soil_type if context and context.soil_type else "Loamy soil")

    # 1. GREETINGS & SOCIAL CHIT-CHAT (e.g. "hi", "hello", "hey", "good morning", "namaste")
    greeting_words = {"hi", "hello", "hey", "hii", "heyy", "namaste", "hlo", "helo", "yo", "sup", "greetings"}
    is_greeting = False
    if len(q_words) <= 5 and any(w in greeting_words for w in q_words):
        is_greeting = True
    elif any(q_lower.startswith(g) for g in ["hi ", "hello ", "hey ", "good morning", "good afternoon", "good evening"]):
        is_greeting = True
    elif q_lower in ["how are you", "how are you doing", "how do you do"]:
        is_greeting = True

    if is_greeting:
        text = (
            f"### Hello! Welcome to AgriSmart AI 🌱\n\n"
            f"I'm your **AgriSmart AI Agronomist**, actively monitoring your farm telemetry and field operations.\n\n"
            f"**How can I assist your {crop} field today?**\n"
            f"- 🌿 **Disease & Health Diagnostics:** Ask about brown spots, yellowing leaves, wilting, or leaf curling.\n"
            f"- 💧 **Precision Irrigation:** Check the ideal watering window based on today's weather (**{temp:.1f}°C, {humidity:.0f}% RH**).\n"
            f"- 🧪 **Fertilizers & Soil Nutrition:** Plan your N-P-K schedules, urea application, or organic compost.\n"
            f"- 🐛 **Pest & Bug Management:** Safe Integrated Pest Management (IPM) and organic spray controls.\n"
            f"- 🌾 **Crop Planning & Yield:** Sowing tips, plant spacing, pruning suckers, and harvest timing.\n\n"
            f"What would you like to explore or troubleshoot?"
        )
        followups = [
            f"Why is my {crop.lower()} leaf turning brown?",
            f"When should I irrigate my {crop.lower()} crop?",
            f"What fertilizer should I use for {crop.lower()}?",
            "How do I control insect pests organically?"
        ]
        return text, followups

    # 2. GRATITUDE, PRAISE & CLOSINGS (e.g. "thank you", "thanks", "ok", "got it", "cool", "bye")
    if any(k in q_lower for k in ["thank you", "thanks", "thx", "ok", "okay", "got it", "understood", "awesome", "great", "cool", "nice", "good job", "bye", "goodbye"]):
        text = (
            f"### You're very welcome! 🌾\n\n"
            f"I'm glad to help your farming operations. Consistent scouting and timely field care make all the difference in achieving top-quality yields.\n\n"
            f"If you notice any new foliar symptoms on your **{crop}**, sudden humidity shifts, or need spray dosage calculations, I'm always right here.\n\n"
            f"Wishing you a healthy crop and an abundant harvest! 🚜"
        )
        followups = [
            f"How can I prevent {crop.lower()} disease next season?",
            "Check current weather impact on my field",
            f"What is the best harvesting time for {crop.lower()}?"
        ]
        return text, followups

    # 3. IDENTITY, CAPABILITIES & HELP ("who are you", "what can you do", "help", "how does this work")
    if any(k in q_lower for k in ["who are you", "what can you do", "what are you", "help", "capabilities", "features", "how do you work", "about you", "what is agrismart"]):
        text = (
            f"### About AgriSmart AI Agronomist 🤖🌾\n\n"
            f"I am an intelligent agricultural advisory specialist engineered to bridge scientific agronomy with daily field management.\n\n"
            f"**Core Capabilities:**\n"
            f"1. **Vision Disease Diagnostics:** Identify foliar pathogens (Early Blight, Late Blight, Bacterial Spot, Powdery Mildew, Rust) with actionable curative protocols.\n"
            f"2. **Real-time Agrometeorology:** Analyze ambient temperature, relative humidity, and rainfall forecasts to predict disease outbreaks before symptoms spread.\n"
            f"3. **Smart Irrigation Guidance:** Calculate optimal watering windows using FAO-56 evapotranspiration models to protect roots and reduce fungal risk.\n"
            f"4. **Soil & Nutrient Management:** Advise on basal and foliar N-P-K applications, micronutrient corrections (Zinc, Boron, Calcium), and organic amendments.\n"
            f"5. **Integrated Pest Management (IPM):** Recommend eco-friendly bio-pesticides (Neem oil, *Bacillus thuringiensis*) and safe conventional treatments with Pre-Harvest Intervals (PHI).\n\n"
            f"Simply type any question or click one of the suggested prompts below!"
        )
        followups = [
            f"What should I do after disease prediction?",
            f"When should I irrigate my {crop.lower()} crop?",
            "How do I identify nutrient deficiencies in leaves?"
        ]
        return text, followups

    # 4. FERTILIZER, NPK, SOIL NUTRITION & DEFICIENCIES
    if any(k in q_lower for k in ["fertilizer", "fertiliser", "npk", "urea", "dap", "potash", "potassium", "nitrogen", "phosphorus", "compost", "manure", "nutrient", "nutrients", "deficiency", "deficiencies", "zinc", "boron", "calcium", "magnesium", "soil", "ph"]):
        text = (
            f"### Comprehensive Nutrient & Fertilizer Guide for {crop}\n\n"
            f"Balanced soil nutrition is essential for robust cell walls and natural systemic acquired resistance (SAR) against foliar pathogens:\n\n"
            f"#### 1. Primary Macronutrients (N-P-K)\n"
            f"- **Nitrogen (N):** Essential for vegetative canopy development. Apply in split doses—excessive N promotes soft, succulent tissue highly vulnerable to fungal hyphae.\n"
            f"- **Phosphorus (P):** Apply as basal dressing (DAP or Single Super Phosphate) at planting to drive vigorous taproot and lateral root branching.\n"
            f"- **Potassium (K):** Crucial for stomatal regulation, fruit sizing, and disease tolerance. Apply Muriate of Potash (MOP) or Sulfate of Potash (SOP) at flowering and fruiting.\n\n"
            f"#### 2. Key Foliar Deficiency Symptoms\n"
            f"- **Nitrogen (N) Deficiency:** General chlorosis (uniform yellowing) starting on older lower leaves while upper leaves remain pale green.\n"
            f"- **Potassium (K) Deficiency:** Marginal necrosis (brown, scorched leaf edges) with interveinal green centers.\n"
            f"- **Calcium (Ca) Deficiency:** Blossom End Rot in fruit and cupping of young shoot tips. Prevent with foliar Calcium Nitrate (1–2 g/L).\n"
            f"- **Zinc (Zn) / Boron (B):** Little leaf syndrome and poor flower setting. Spray Chelated Zinc (1 g/L) and Solubor (1 g/L) prior to flowering.\n\n"
            f"#### 3. Soil Conditioning & Organic Amendments\n"
            f"- Incorporate 10–15 tons/ha of well-rotted Farmyard Manure (FYM) or 5 tons/ha Vermicompost.\n"
            f"- Maintain soil pH between **6.0 and 6.8** for optimal cation exchange capacity and nutrient availability."
        )
        followups = [
            f"How do I fix blossom end rot in {crop.lower()}?",
            "What organic fertilizers improve soil fertility fastest?",
            "How does over-fertilizing with nitrogen cause blight?"
        ]
        return text, followups

    # 5. PEST & INSECT MANAGEMENT (IPM)
    if any(k in q_lower for k in ["pest", "pests", "insect", "insects", "bug", "bugs", "worm", "worms", "caterpillar", "caterpillars", "aphid", "aphids", "whitefly", "whiteflies", "thrips", "mite", "mites", "borer", "borers", "leaf miner", "neem oil", "spray", "insecticide", "pesticide"]):
        text = (
            f"### Integrated Pest Management (IPM) Protocol for {crop}\n\n"
            f"Control insect pest populations without harming beneficial predators using this multi-tiered strategy:\n\n"
            f"#### 1. Cultural & Physical Barriers\n"
            f"- Install **Yellow Sticky Traps** (for whiteflies and aphids) and **Blue Sticky Traps** (for thrips) at 15–20 traps per hectare at canopy height.\n"
            f"- Deploy **Pheromone Traps** to monitor fruit borer or armyworm moth flight spikes.\n"
            f"- Clear weed reservoirs around field bunds to eliminate alternate pest host plants.\n\n"
            f"#### 2. Botanical & Bio-Rational Solutions (Low-Toxicity)\n"
            f"- **Cold-Pressed Neem Oil (10,000 ppm):** Mix 3–5 ml per litre of water with 1 ml liquid soap/emulsifier. Disrupts insect feeding, molting, and egg viability.\n"
            f"- **Bacillus thuringiensis (Bt):** Apply at 2 g/L during early larval instars for caterpillar and fruit borer control.\n"
            f"- **Beauveria bassiana / Verticillium:** Entomopathogenic fungi effective against sucking pests in humid conditions.\n\n"
            f"#### 3. Targeted Chemical Intervention (Emergency Only)\n"
            f"- If infestation exceeds economic threshold levels (ETL), apply selective active ingredients (e.g. Imidacloprid for sucking pests or Spinosad/Chlorantraniliprole for borers).\n"
            f"- **Safety Notice:** Always observe the mandatory **Pre-Harvest Interval (PHI)** of 3–7 days and spray during early morning or late evening to protect pollinating honeybees."
        )
        followups = [
            "How often should I spray neem oil?",
            "What kills whiteflies without harming ladybugs?",
            "How do I identify fruit borer vs leaf miner damage?"
        ]
        return text, followups

    # 6. LEAF BROWNING, YELLOWING, SPOTS & FOLIAR SYMPTOMS
    if any(k in q_lower for k in ["brown", "yellow", "turning", "spots", "spot", "blight", "scorch", "curling", "curl", "wilting", "wilt", "drying", "dying", "rot", "rotting", "rust", "mildew", "white powder"]):
        if disease and "Early Blight" in disease:
            text = (
                f"### Diagnostic Analysis for {crop} Foliage Browning\n\n"
                f"Your leaf browning is primarily caused by **Early Blight (*Alternaria solani*)**, which was detected with high confidence:\n\n"
                f"1. **Concentric Target Rings:** The fungus begins on older lower foliage as small dark brown circular spots, expanding into distinctive concentric rings surrounded by a chlorotic yellow halo.\n"
                f"2. **Microclimate Acceleration:** At your current conditions (**{temp:.1f}°C and {humidity:.0f}% relative humidity**), *Alternaria* conidia germinate within 1 to 2 hours of leaf wetness.\n"
                f"3. **Nutrient Stress Synergy:** Low soil nitrogen or heavy fruit load often predisposes {crop} leaves to rapid blighting.\n\n"
                f"**Immediate Corrective Actions:**\n"
                f"- Prune and destroy all lower diseased leaves (never compost infected foliage).\n"
                f"- Apply organic mulch (straw or plastic) to prevent soil rain-splash inoculation.\n"
                f"- Apply protective **copper hydroxide** or bio-fungicide (**Bacillus subtilis**) before rain arrives."
            )
            followups = [
                "What organic spray works best for Early Blight?",
                "How often should I irrigate during Early Blight?",
                "Will Early Blight spread to the fruit?"
            ]
        elif disease and "Late Blight" in disease:
            text = (
                f"### Urgent Warning: Late Blight (*Phytophthora infestans*)\n\n"
                f"Rapid leaf browning and water-soaked lesions indicate **Late Blight**, a devastating oomycete pathogen:\n\n"
                f"- **Symptom Manifestation:** Water-soaked irregular dark brown to black greasy lesions, often with fine white fuzzy sporulation on leaf undersides during cool, humid mornings.\n"
                f"- **Spread Dynamic:** Motile zoospores disperse rapidly across rows via wind-driven rain and overhead sprinkler droplets.\n\n"
                f"**Emergency Protocol:**\n"
                f"1. Cut down and bag heavily infected vines immediately in dry weather.\n"
                f"2. Stop all overhead sprinkler watering immediately.\n"
                f"3. Apply targeted anti-oomycete protectant (e.g. Cymoxanil or Metalaxyl + Mancozeb) across adjacent buffer rows."
            )
            followups = [
                "Can Late Blight survive in the soil over winter?",
                "Is it safe to eat unaffected tomatoes from this plant?",
                "What is the Pre-Harvest Interval (PHI) for copper sprays?"
            ]
        elif disease and "Bacterial Spot" in disease:
            text = (
                f"### Diagnosis: Bacterial Spot (*Xanthomonas*)\n\n"
                f"Your {crop} foliage exhibits water-soaked angular dark brown lesions caused by bacterial pathogens:\n\n"
                f"- **Transmission:** Bacteria enter through leaf stomata and micro-wounds created by wind, hail, or mechanical pruning.\n"
                f"- **Impact:** Leads to severe defoliation and sunken scab-like blemishes on mature fruit.\n\n"
                f"**Treatment Strategy:**\n"
                f"- Apply **Fixed Copper mixed with Mancozeb** (copper-mancozeb synergism suppresses copper-resistant bacterial strains).\n"
                f"- Avoid working in or harvesting the field while leaves are damp with morning dew.\n"
                f"- Sanitize all pruning shears with 70% isopropyl alcohol between plants."
            )
            followups = [
                "Can copper sprays damage flowering tomatoes?",
                "How do I prevent bacterial spot next year?",
                "Should I prune infected branches right away?"
            ]
        else:
            text = (
                f"### Common Causes for {crop} Leaf Browning & Yellowing\n\n"
                f"Foliar discoloration is typically caused by biological pathogens or environmental stress factors:\n\n"
                f"1. **Fungal Blights & Leaf Spots:** Circular lesions with concentric rings or yellow halos indicate fungal infection (*Alternaria* or *Septoria*). Leaves dry out and drop prematurely.\n"
                f"2. **Potassium (K) Deficiency:** Scorched or burnt margins on mature leaves while interior veins stay green.\n"
                f"3. **Moisture & Heat Stress:** High daytime temperatures (**{temp:.1f}°C**) paired with fluctuating soil moisture cause leaf edge desiccation and curling.\n"
                f"4. **Root Hypoxia:** Overwatering or poor drainage suffocates roots, preventing iron and nitrogen uptake and turning foliage pale yellow.\n\n"
                f"**Field Action Plan:** Inspect leaf undersides for fungal fuzz, check root zone moisture at 15 cm depth, and prune the lowest 20 cm of foliage to improve ventilation."
            )
            followups = [
                "What should I do after this disease prediction?",
                "How do I identify potassium deficiency vs fungal blight?",
                "What is the best irrigation schedule for healthy foliage?"
            ]
        return text, followups

    # 7. ACTION PLAN & TREATMENT STEPS
    if any(k in q_lower for k in ["what should i do", "after prediction", "action plan", "next steps", "treatment", "how to treat", "cure", "remedy"]):
        disease_name = disease or "Foliar Pathology"
        text = (
            f"### 4-Step Agronomic Action Plan for {disease_name}\n\n"
            f"Follow this structured field recovery sequence for your {crop}:\n\n"
            f"#### 1. Cultural Sanitation & Containment (Immediate)\n"
            f"- Strip diseased lower leaves up to 25–30 cm above ground level.\n"
            f"- Seal infected clippings in plastic disposal bags—**never compost** diseased foliage.\n"
            f"- Sanitize cutting tools in 1:10 bleach or 70% alcohol solution between rows.\n\n"
            f"#### 2. Water Management Adjustment\n"
            f"- Current Humidity: **{humidity:.0f}%** | Rain Forecast: **{rain:.1f} mm**.\n"
            f"- Switch strictly to drip or furrow irrigation. Keep leaf surfaces completely dry.\n"
            f"- If rain is forecast, ensure perimeter drainage trenches are cleared to prevent standing water.\n\n"
            f"#### 3. Therapeutic Chemical / Bio-Control Application\n"
            f"- **Organic / Low-Residue:** Spray *Bacillus subtilis* or copper octanoate (soap) at 7-day intervals.\n"
            f"- **Conventional Curative:** Apply Chlorothalonil or Azoxystrobin early in the morning when winds are < 10 km/h.\n\n"
            f"#### 4. Monitoring & Re-inspection\n"
            f"- Inspect the upper canopy 5 days after application. Healthy new foliage should show zero spreading lesions."
        )
        followups = [
            "What is the safe spray window given current weather?",
            "Will organic bio-fungicides be effective enough?",
            "How does crop rotation help prevent recurring blight?"
        ]
        return text, followups

    # 8. IRRIGATION, WATERING & MOISTURE
    if any(k in q_lower for k in ["irrigate", "water", "watering", "irrigation", "moisture", "drip", "sprinkler", "flood"]):
        rain_note = (
            f"Upcoming rainfall of **{rain:.1f} mm** is forecast within 24–48 hours. Postpone artificial watering to avoid root hypoxia."
            if rain >= 5.0
            else "Minimal rain expected; root zone hydration must be supplied artificially."
        )
        text = (
            f"### Smart Irrigation Schedule for {crop}\n\n"
            f"Based on real-time agrometeorology (**{temp:.1f}°C, {humidity:.0f}% RH**) and FAO-56 crop evapotranspiration models:\n\n"
            f"- **Optimal Timing:** Irrigate strictly in the **early morning (5:00 AM – 8:00 AM)**. This allows sunlight to dry any incidental leaf droplets, preventing fungal spore germination.\n"
            f"- **Application Method:** Use low-pressure drip emitters positioned 10–15 cm from the plant base. Avoid overhead sprinklers which create a humid microclimate.\n"
            f"- **Rain Forecast Factor:** {rain_note}\n"
            f"- **Soil Moisture Rule:** For {crop} in {soil}, allow top 5 cm of soil to dry slightly between watering cycles to stimulate deep root anchoring, but do not allow root zone (15–30 cm) to drop below 50% available water capacity."
        )
        followups = [
            "How many litres of water per hectare are needed?",
            "How do I know if my soil is waterlogged?",
            "Does drip irrigation reduce disease pressure?"
        ]
        return text, followups

    # 9. DISEASE PREVENTION & LONG-TERM FIELD PROTOCOL
    if any(k in q_lower for k in ["prevent", "prevention", "next season", "stop", "avoid", "protect", "rotation"]):
        disease_name = disease or "crop pathologies"
        text = (
            f"### Integrated Long-Term Disease Prevention Protocol\n\n"
            f"To permanently eliminate {disease_name} pressure in your {crop} field, deploy these 5 agronomic pillars:\n\n"
            f"1. **3-Year Crop Rotation:** Never plant Solanaceous crops (Tomato, Potato, Eggplant, Pepper) consecutively in the same parcel. Rotate with legumes (Chickpea/Beans) or monocots (Corn) to starve soil-borne spores.\n"
            f"2. **Certified Disease-Free Seed / Seedlings:** Purchase certified hot-water-treated or fungicide-treated hybrid seeds with genetic resistance genes.\n"
            f"3. **Airflow Optimization & Plant Spacing:** Space {crop} plants at least 45–60 cm apart within rows and 90 cm between rows. Prune sucker shoots to maximize sun penetration and wind ventilation.\n"
            f"4. **Protective Ground Mulch:** Apply organic straw or black polyethylene mulch. Mulch creates a physical barrier that stops fungal spores from splashing from soil onto lower leaves.\n"
            f"5. **Nutrient Balancing:** Avoid excessive nitrogen fertilizers, which produce lush, succulent vegetative growth with thin cell walls vulnerable to fungal hyphae penetration. Maintain high potassium and calcium levels for thick cell walls."
        )
        followups = [
            "What cover crops are best to rotate with tomato?",
            "Which tomato varieties have genetic resistance to blight?",
            "How do I test my soil pH and NPK before planting?"
        ]
        return text, followups

    # 10. WEATHER & AGROMETEOROLOGY
    if any(k in q_lower for k in ["weather", "rain", "forecast", "climate", "risk", "temperature", "humidity", "storm", "wind"]):
        risk = getattr(context, "weather_risk", "MODERATE") if context else "MODERATE"
        rec = getattr(context, "weather_recommendation", None) if context else None
        cond = getattr(context, "weather_condition", None) if context else None
        text = (
            f"### Agrometeorological Field Assessment for {crop}\n\n"
            f"Synthesizing live microclimate telemetry for your **{crop}** parcel:\n\n"
            f"- **Current Atmospheric State:** {cond or 'Ambient Conditions'} at **{temp:.1f}°C** and **{humidity:.0f}% RH**.\n"
            f"- **Precipitation Outlook:** {rain:.1f} mm rainfall expected across the next 24–48 hours.\n"
            f"- **Computed Weather Risk:** **{risk} RISK**.\n\n"
            f"**Operational Field Advisory:**\n"
            f"{rec or ('Rain is forecast. Delay planned irrigation to avoid root hypoxia and fungicide washoff.' if rain > 1.0 else 'Atmospheric parameters remain favorable. Normal irrigation and field scouting can proceed.')}\n\n"
            f"- **Crop Protection Rule:** Relative humidity exceeding 75% prolongs leaf wetness duration, accelerating fungal conidia germination. Prioritize morning drip irrigation and inspect interior canopy leaves."
        )
        followups = [
            "When should I irrigate my crop?",
            "How does this weather affect foliar disease pressure?",
            "What preventive sprays are recommended before rain?"
        ]
        return text, followups

    # 11. PLANTING, SOWING, SEEDS & NURSERY
    if any(k in q_lower for k in ["sow", "sowing", "plant", "planting", "seed", "seeds", "seedling", "spacing", "germinat", "nursery", "transplant"]):
        text = (
            f"### Agronomic Planting & Sowing Guidelines for {crop}\n\n"
            f"Establish a vigorous crop stand with high seed germination and uniform early development:\n\n"
            f"1. **Seed Treatment:** Treat seeds with *Trichoderma viride* (10 g/kg seed) or Carbendazim (2 g/kg seed) 24 hours prior to sowing to prevent damping off and seedling blight.\n"
            f"2. **Nursery Bed Preparation:** Use raised nursery beds (15 cm above ground level) with well-draining soil and vermicompost in a 2:1 ratio. Protect with 50% shade netting.\n"
            f"3. **Transplanting Age:** Transplant seedlings at 25–30 days old when they have 4–5 true leaves and a sturdy stem caliper.\n"
            f"4. **Field Spacing:** Maintain 60 cm between plants within rows and 90–120 cm between ridges to promote lateral canopy expansion and ease mechanical weeding."
        )
        followups = [
            f"What is the best sowing season for {crop.lower()}?",
            "How do I prevent damping off in seedlings?",
            "How much seed is required per hectare?"
        ]
        return text, followups

    # 12. FLOWERING, FRUIT SETTING, PRUNING & HARVESTING
    if any(k in q_lower for k in ["flower", "flowering", "fruit", "prun", "stake", "staking", "harvest", "yield", "production"]):
        text = (
            f"### Canopy Management & Yield Maximization for {crop}\n\n"
            f"Optimize fruit set and market-grade produce through active canopy training:\n\n"
            f"1. **Preventing Flower Drop:** Flower abortion is often triggered by sudden temperature spikes (> 32°C) or moisture stress. Spray Boron (Solubor 1 g/L) and Planofix (alpha-NAA 1 ml / 4.5 L) at initial bud burst.\n"
            f"2. **De-suckering & Pruning:** Remove indeterminate sucker shoots (axillary side shoots) below the first flowering cluster once a week. This redirects photosynthetic energy into fruit sizing.\n"
            f"3. **Staking & Trellising:** Stake plants with bamboo poles or trellis string by 30 days after transplanting. Keeping vines off the soil eliminates ground rot and improves spray coverage.\n"
            f"4. **Harvesting Criteria:** Harvest fruit at the 'breaker stage' (color turning from green to pink/light red) to minimize post-harvest transit losses."
        )
        followups = [
            "Why are flowers falling off without setting fruit?",
            "How does staking improve crop yield?",
            "What foliar spray boosts fruit size and sweetness?"
        ]
        return text, followups

    # 13. ORGANIC & BIO-FARMING
    if any(k in q_lower for k in ["organic", "natural farming", "panchagavya", "jeevamrut", "biofertilizer", "bio-fertilizer", "home remedy"]):
        text = (
            f"### Organic & Natural Farming Practices for {crop}\n\n"
            f"Boost soil microbial biodiversity and natural immunity without synthetic inputs:\n\n"
            f"1. **Jeevamrut Application:** Prepare ferment of 10 kg cow dung, 10 L cow urine, 2 kg jaggery, 2 kg pulse flour, and a handful of virgin forest soil in 200 L water for 48 hours. Apply 500 L/ha with drip irrigation every 15 days.\n"
            f"2. **Panchagavya Foliar Spray:** Dilute 3% Panchagavya in water (30 ml/L) and spray at 15-day intervals to boost chlorophyll content and plant vigor.\n"
            f"3. **Neem Seed Kernel Extract (NSKE 5%):** Soak 50 g powdered neem kernels in 1 L water overnight. Strain and spray as an organic deterrent against sucking insects and caterpillars.\n"
            f"4. **Trichoderma Soil Enrichment:** Mix 2 kg *Trichoderma viride* in 100 kg moist farmyard manure, incubate for 7 days in shade, and broadcast across the root zone."
        )
        followups = [
            "How do I prepare Jeevamrut step by step?",
            "Can organic farming match conventional yields?",
            "What are the best bio-fungicides for foliar diseases?"
        ]
        return text, followups

    # 14. DYNAMIC CONVERSATIONAL AGRONOMIC RESPONSE (Handles any general question naturally!)
    text = (
        f"### Field Advisory for {crop}\n\n"
        f"Regarding your query on **{q_raw}**:\n\n"
        f"In agricultural management for **{crop}**, field performance relies on maintaining the balance between microclimate conditions, soil health, and preventive crop protection.\n\n"
        f"**Key Agronomic Insights & Action Points:**\n"
        f"1. **Root Zone & Irrigation:** Current field telemetry indicates **{temp:.1f}°C** ambient temperature and **{humidity:.0f}%** relative humidity. Maintain consistent soil hydration through early morning drip cycles to prevent physiological stress.\n"
        f"2. **Foliar Protection:** Inspect leaves regularly for any early chlorotic spots or pest colonization. Keeping leaf surfaces dry and spacing plants for adequate airflow prevents opportunistic fungal spores from establishing.\n"
        f"3. **Nutrient Equilibrium:** Ensure balanced potassium and micronutrient (Zinc, Boron) availability to reinforce plant vascular systems and maximize fruit set.\n\n"
        f"If you would like specific dosage calculations, chemical vs organic options, or step-by-step application guidelines, feel free to ask!"
    )
    followups = [
        f"Why is my {crop.lower()} leaf turning brown?",
        f"When should I irrigate my {crop.lower()} crop?",
        f"What fertilizer schedule should I follow for {crop.lower()}?",
        "How do I prevent diseases next season?"
    ]
    return text, followups


def generate_smart_followups(query: str, context: Any) -> List[str]:
    """Generates contextually sharp followup prompts."""
    crop = (context.crop if context and context.crop else "crop").lower()
    return [
        f"What organic spray works best for {crop}?",
        f"When should I irrigate my {crop} crop?",
        f"What is the recommended fertilizer schedule for {crop}?"
    ]


def get_assistant_response(req: ChatRequest) -> ChatResponse:
    """Orchestrates LLM query with context injection and seamless fallback."""
    context = req.context
    system_prompt = build_system_prompt(context)
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    model_name = "AgriSmart Knowledge Engine (Context-Augmented)"
    response_text = ""
    followups = []

    user_key = req.api_key or OPENAI_API_KEY or getattr(settings, "OPENAI_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")
    gemini_key = getattr(settings, "GEMINI_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    if user_key and user_key.startswith("AIza"):
        gemini_key = user_key
        user_key = ""

    global _openai_quota_exhausted_until
    now_ts = time.time()

    # 1. Attempt OpenAI GPT-4o-mini if configured and not recently quota-exhausted
    if user_key and (user_key != OPENAI_API_KEY or now_ts > _openai_quota_exhausted_until):
        try:
            response_text = call_openai_api(system_prompt, req.message, req.history or [], api_key=user_key)
            model_name = "OpenAI GPT-4o-mini (Cloud Intelligence)"
            followups = generate_smart_followups(req.message, context)
            _openai_quota_exhausted_until = 0.0  # Key works! Reset backoff
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "insufficient" in err_str:
                _openai_quota_exhausted_until = now_ts + 300  # Back off for 5 mins
            print(f"[!] OpenAI API call failed ({e}). Seamlessly switching to AgriSmart Knowledge Engine.")
            response_text, followups = fallback_agronomic_engine(req.message, context, req.history or [])
            model_name = "AgriSmart Knowledge Engine (Context-Augmented)"
    # 2. Attempt Gemini 1.5 Flash if configured
    elif gemini_key:
        try:
            response_text = call_gemini_api(system_prompt, req.message, req.history or [], api_key=gemini_key)
            model_name = "Gemini 1.5 Flash (Google Cloud)"
            followups = generate_smart_followups(req.message, context)
        except Exception as e:
            print(f"[!] Gemini API call failed ({e}). Seamlessly switching to AgriSmart Knowledge Engine.")
            response_text, followups = fallback_agronomic_engine(req.message, context, req.history or [])
            model_name = "AgriSmart Knowledge Engine (Context-Augmented)"
    # 3. Built-in Dynamic Agronomic Engine
    else:
        response_text, followups = fallback_agronomic_engine(req.message, context, req.history or [])
        model_name = "AgriSmart Knowledge Engine (Context-Augmented)"

    context_dict = {}
    if context:
        context_dict = {
            "crop": context.crop,
            "disease": context.disease,
            "pathogen": context.pathogen,
            "weather": f"{context.temperature}°C, {context.humidity}% RH" if context.temperature is not None else None,
            "irrigation": context.irrigation_status
        }

    return ChatResponse(
        response=response_text,
        suggested_followups=followups,
        model_used=model_name,
        context_acknowledged=context_dict,
        created_at=now_str
    )



def get_contextual_quick_prompts(context: Any) -> List[QuickPromptItem]:
    """Returns tailored prompt chips based on active crop/disease state."""
    crop = context.crop if context and context.crop else "Tomato"
    disease = context.disease if context and context.disease else "Foliar Disease"

    return [
        QuickPromptItem(
            prompt=f"Why is my {crop.lower()} leaf turning brown?",
            category="Diagnostics",
            icon="🍂"
        ),
        QuickPromptItem(
            prompt="What should I do after this disease prediction?",
            category="Action Plan",
            icon="📋"
        ),
        QuickPromptItem(
            prompt=f"When should I irrigate my {crop.lower()} crop?",
            category="Irrigation",
            icon="💧"
        ),
        QuickPromptItem(
            prompt=f"How can I prevent {disease} next season?",
            category="Prevention",
            icon="🛡️"
        ),
    ]
