"""
AgriSmart AI – Agrometeorological Weather Intelligence Service
Integrates Open-Meteo API with crop pathogen epidemiology models.
"""
import math
import time
from typing import Dict, List, Optional, Tuple
import requests

from backend.app.schemas.weather import (
    WeatherCurrent,
    DailyForecastItem,
    WeatherRiskAssessment,
    AgriculturalAdvisory,
    WeatherIntelligenceResponse,
    FarmLocationPreset,
)

# Major Agricultural Farm Hubs for quick selection
FARM_PRESETS: List[FarmLocationPreset] = [
    FarmLocationPreset(
        name="Nashik Agricultural Belt",
        region="Maharashtra",
        country="India",
        latitude=19.9975,
        longitude=73.7898,
        primary_crops=["Tomato", "Grapes", "Onion"]
    ),
    FarmLocationPreset(
        name="Ludhiana Farm Basin",
        region="Punjab",
        country="India",
        latitude=30.9010,
        longitude=75.8573,
        primary_crops=["Corn", "Wheat", "Potato"]
    ),
    FarmLocationPreset(
        name="Anand Agronomy Region",
        region="Gujarat",
        country="India",
        latitude=22.5645,
        longitude=72.9289,
        primary_crops=["Tomato", "Potato", "Tobacco"]
    ),
    FarmLocationPreset(
        name="Salinas Valley ('Salad Bowl')",
        region="California",
        country="USA",
        latitude=36.6777,
        longitude=-121.6555,
        primary_crops=["Tomato", "Vegetables", "Apple"]
    ),
    FarmLocationPreset(
        name="Fresno Central Valley",
        region="California",
        country="USA",
        latitude=36.7468,
        longitude=-119.7726,
        primary_crops=["Corn", "Tomato", "Fruits"]
    ),
    FarmLocationPreset(
        name="Yakima Valley Orchards",
        region="Washington",
        country="USA",
        latitude=46.6021,
        longitude=-120.5059,
        primary_crops=["Apple", "Corn", "Cherries"]
    ),
]

WMO_WEATHER_CODES: Dict[int, Tuple[str, str]] = {
    0: ("Clear Sky", "☀️"),
    1: ("Mainly Clear", "🌤️"),
    2: ("Partly Cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Foggy", "🌫️"),
    48: ("Depositing Rime Fog", "🌫️"),
    51: ("Light Drizzle", "🌦️"),
    53: ("Moderate Drizzle", "🌦️"),
    55: ("Dense Drizzle", "🌧️"),
    61: ("Slight Rain", "🌦️"),
    63: ("Moderate Rain", "🌧️"),
    65: ("Heavy Rain", "🌧️"),
    71: ("Slight Snow", "🌨️"),
    73: ("Moderate Snow", "❄️"),
    75: ("Heavy Snow", "❄️"),
    80: ("Slight Rain Showers", "🌦️"),
    81: ("Moderate Showers", "🌧️"),
    82: ("Violent Rain Showers", "⛈️"),
    95: ("Thunderstorm", "⛈️"),
    96: ("Thunderstorm with Hail", "⛈️"),
    99: ("Heavy Thunderstorm with Hail", "⛈️"),
}


def decode_wmo_code(code: int) -> Tuple[str, str]:
    """Returns (Condition description, Icon emoji) for WMO code."""
    return WMO_WEATHER_CODES.get(code, ("Variable Conditions", "⛅"))


def fetch_open_meteo_weather(lat: float, lon: float) -> Dict:
    """
    Fetches real-time weather and 7-day forecast from Open-Meteo API.
    Zero-key, open-access, reliable agrometeorological service.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,is_day",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
        "timezone": "auto"
    }

    try:
        response = requests.get(url, params=params, timeout=6)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[!] Weather API connection error: {e}. Zero fake data fallback policy enforced.")
        raise RuntimeError("Weather data unavailable") from e


def compute_disease_risk(
    temp: float,
    humidity: float,
    rain: float,
    wind: float,
    precip_prob: int = 0
) -> WeatherRiskAssessment:
    """
    Computes disease propagation risk using agronomic pathogen models.
    """
    factors: List[str] = []
    vulnerable: List[str] = []

    # 1. Fungal Blight Risk (Late Blight, Early Blight, Apple Scab)
    # Optimum: 15°C - 26°C with >75% humidity and leaf wetness
    blight_score = 0
    if humidity >= 80:
        blight_score += 45
        factors.append(f"Elevated Relative Humidity ({humidity}% > 80%) promotes fungal spore germination")
    elif humidity >= 65:
        blight_score += 25
        factors.append(f"Moderate Humidity ({humidity}%) provides moisture for fungal incubation")
    else:
        blight_score += 5

    if 15.0 <= temp <= 27.0:
        blight_score += 30
        factors.append(f"Ambient Temperature ({temp:.1f}°C) is in optimal fungal development zone (15-27°C)")
    elif 10.0 <= temp <= 32.0:
        blight_score += 15

    if rain > 0.5 or precip_prob >= 60:
        blight_score += 25
        factors.append(f"Rainfall & Surface Wetness ({rain}mm, {precip_prob}% prob) enables rapid zoospore motile dispersal")
        vulnerable.append("Oomycete Blights (Potato/Tomato Late Blight)")
        vulnerable.append("Alternaria Fungi (Tomato/Potato Early Blight)")

    # 2. Bacterial Spot Risk (Xanthomonas)
    # Optimum: Warm temp >24°C + rain splash + wind > 10 km/h
    bacterial_score = 0
    if temp >= 24.0:
        bacterial_score += 35
    if rain > 0.0:
        bacterial_score += 35
        if wind >= 10.0:
            bacterial_score += 30
            factors.append(f"Wind-driven rain ({wind:.1f} km/h) actively splashes bacterial pathogens into plant stomata")
            vulnerable.append("Bacterial Spot (Tomato/Pepper Xanthomonas)")
    elif humidity >= 85:
        bacterial_score += 25

    # 3. Rust Risk (Puccinia)
    # Optimum: 16°C - 24°C + prolonged leaf moisture
    rust_score = 0
    if 16.0 <= temp <= 24.0 and humidity >= 70:
        rust_score = 75
        vulnerable.append("Rust Fungi (Corn Common Rust)")
    elif humidity >= 65:
        rust_score = 45
    else:
        rust_score = 15

    # Overall Composite Risk
    composite_score = int(min(100, max(blight_score, bacterial_score, rust_score)))

    if composite_score >= 75:
        risk_level = "Severe" if (rain > 1.0 and humidity >= 80) else "High"
        summary = "CRITICAL: High humidity and moisture present acute conditions for fungal blight and bacterial outbreaks."
    elif composite_score >= 45:
        risk_level = "Moderate"
        summary = "MODERATE: Ambient conditions moderately favorable for spore propagation. Regular scouting recommended."
    else:
        risk_level = "Low"
        summary = "LOW: Dry and mild conditions suppress pathogen germination. Low disease propagation pressure."

    def classify(score: int) -> str:
        if score >= 75:
            return "Severe" if score > 85 else "High"
        if score >= 45:
            return "Moderate"
        return "Low"

    return WeatherRiskAssessment(
        overall_risk_level=risk_level,
        overall_risk_score=composite_score,
        summary=summary,
        contributing_factors=factors[:4],
        vulnerable_pathogen_types=list(set(vulnerable)) if vulnerable else ["General Foliar Pathogens"],
        blight_risk=classify(blight_score),
        bacterial_risk=classify(bacterial_score),
        rust_risk=classify(rust_score)
    )


def generate_agricultural_advisories(
    temp: float,
    humidity: float,
    rain: float,
    wind: float,
    precip_prob: int,
    crop: Optional[str] = None,
    disease: Optional[str] = None
) -> List[AgriculturalAdvisory]:
    """
    Generates tailored, actionable farmer advisories based on weather variables.
    """
    advisories: List[AgriculturalAdvisory] = []

    # 1. Irrigation Advisory
    if rain > 2.0 or precip_prob >= 70:
        advisories.append(AgriculturalAdvisory(
            category="Irrigation",
            title="Cease Overhead & Surface Irrigation",
            action=f"Upcoming rainfall ({rain}mm recorded / {precip_prob}% probability) provides sufficient root zone saturation. Cease irrigation to avoid waterlogging and root-zone hypoxia.",
            urgency="Warning",
            icon="🚫💧"
        ))
    elif humidity >= 78:
        advisories.append(AgriculturalAdvisory(
            category="Irrigation",
            title="Switch to Sub-Canopy Drip Hydration",
            action=f"High ambient humidity ({humidity}%) prevents rapid canopy drying. Avoid overhead sprinklers. Use drip lines only during early morning hours to keep foliage dry.",
            urgency="Advisory",
            icon="💧"
        ))
    elif temp > 33.0 and humidity < 40:
        advisories.append(AgriculturalAdvisory(
            category="Irrigation",
            title="Increase Drip Irrigation Volume",
            action=f"High temperature ({temp:.1f}°C) and low humidity ({humidity}%) trigger elevated evapotranspiration. Increase drip cycles to prevent crop heat shock.",
            urgency="Advisory",
            icon="☀️💧"
        ))
    else:
        advisories.append(AgriculturalAdvisory(
            category="Irrigation",
            title="Normal Irrigation Schedule",
            action="Soil moisture replenishment balanced with evaporation. Maintain regular drip hydration cycles.",
            urgency="Safe",
            icon="✅💧"
        ))

    # 2. Spraying Window Advisory (Fungicides / Protectants)
    if rain > 0.2 or precip_prob >= 50:
        advisories.append(AgriculturalAdvisory(
            category="Spraying",
            title="Unfavorable Spray Window (Rain Imminent)",
            action=f"Do NOT apply foliar fungicides or pesticides. Rain within 6-12 hours ({precip_prob}% chance) will wash off chemical barrier before adherence occurs.",
            urgency="Critical",
            icon="🌧️⚠️"
        ))
    elif wind >= 18.0:
        advisories.append(AgriculturalAdvisory(
            category="Spraying",
            title="Spray Drift Warning (>18 km/h)",
            action=f"Wind speed ({wind:.1f} km/h) exceeds safe spraying thresholds. Chemical droplets will drift off-target. Postpone spraying until early evening calm.",
            urgency="Warning",
            icon="💨⚠️"
        ))
    elif humidity >= 75 and rain == 0 and wind < 15:
        advisories.append(AgriculturalAdvisory(
            category="Spraying",
            title="Critical Preventive Protective Spray Window",
            action="Foliage is dry and winds are calm, but high humidity is accelerating spore germination. Apply protective copper or bio-fungicide now before rain arrives.",
            urgency="Warning",
            icon="🛡️🧪"
        ))
    else:
        advisories.append(AgriculturalAdvisory(
            category="Spraying",
            title="Optimal Foliar Application Window",
            action=f"Calm winds ({wind:.1f} km/h) and low rain risk ({precip_prob}%) provide an ideal window for nutrient or protectant foliar sprays.",
            urgency="Safe",
            icon="✅🧪"
        ))

    # 3. Field Scouting & Cultural Practices
    if humidity >= 80 or rain > 1.0:
        crop_name = crop or "Field"
        advisories.append(AgriculturalAdvisory(
            category="Scouting",
            title=f"Intensify {crop_name} Canopy Scouting",
            action="Inspect the lowest, shaded leaves and dense interior rows. Look for water-soaked lesions, target rings (Early Blight), and fuzzy white sporulation (Late Blight).",
            urgency="Warning",
            icon="🔍🍃"
        ))
    else:
        advisories.append(AgriculturalAdvisory(
            category="Scouting",
            title="Standard Bi-Weekly Field Scouting",
            action="Inspect random 10-meter row transects. Record any new chlorosis or leaf spot lesions.",
            urgency="Safe",
            icon="📋🌱"
        ))

    # 4. Crop/Disease Specific Context
    if disease and disease != "None (Healthy)":
        advisories.append(AgriculturalAdvisory(
            category="General",
            title=f"Targeted Alert for Diagnosed {disease}",
            action=f"Your diagnosed {disease} in {crop or 'crop'} has elevated contagion under current humidity ({humidity}%). Prune infected foliage into sealed bags immediately and sanitize shears with 70% alcohol.",
            urgency="Critical",
            icon="🚨🌿"
        ))

    return advisories


def get_weather_intelligence(
    lat: float,
    lon: float,
    location_name: Optional[str] = None,
    crop: Optional[str] = None,
    disease: Optional[str] = None
) -> WeatherIntelligenceResponse:
    """
    Main aggregator function: fetches weather, calculates agrometeorological risks,
    and returns daily forecast with actionable recommendations.
    """
    raw_data = fetch_open_meteo_weather(lat, lon)
    current_raw = raw_data.get("current", {})
    daily_raw = raw_data.get("daily", {})

    temp = current_raw.get("temperature_2m", 25.0)
    humidity = int(current_raw.get("relative_humidity_2m", 65))
    precip = current_raw.get("precipitation", 0.0)
    rain = current_raw.get("rain", 0.0)
    w_code = current_raw.get("weather_code", 0)
    wind = current_raw.get("wind_speed_10m", 8.0)
    is_day = current_raw.get("is_day", 1)

    cond_text, cond_icon = decode_wmo_code(w_code)

    current = WeatherCurrent(
        time=current_raw.get("time", time.strftime("%Y-%m-%dT%H:00")),
        temperature_c=temp,
        relative_humidity_pct=humidity,
        precipitation_mm=precip,
        rain_mm=rain,
        weather_code=w_code,
        weather_condition=cond_text,
        weather_icon=cond_icon,
        wind_speed_kmh=wind,
        is_day=is_day
    )

    # 7-day Daily Forecast Items
    daily_forecast: List[DailyForecastItem] = []
    dates = daily_raw.get("time", [])
    max_temps = daily_raw.get("temperature_2m_max", [])
    min_temps = daily_raw.get("temperature_2m_min", [])
    precip_sums = daily_raw.get("precipitation_sum", [])
    precip_probs = daily_raw.get("precipitation_probability_max", [])
    codes = daily_raw.get("weather_code", [])

    for i in range(len(dates)):
        d_date = dates[i]
        d_max = max_temps[i] if i < len(max_temps) else temp + 2
        d_min = min_temps[i] if i < len(min_temps) else temp - 5
        d_precip = precip_sums[i] if i < len(precip_sums) else 0.0
        d_prob = int(precip_probs[i]) if i < len(precip_probs) else 20
        d_code = codes[i] if i < len(codes) else 1
        d_text, d_icon = decode_wmo_code(d_code)

        # Estimate daily risk score based on forecast
        d_risk_score = min(100, int((d_prob * 0.6) + (15 if d_precip > 1.0 else 0) + (20 if d_max > 22 and d_min < 28 else 0)))
        if d_risk_score >= 70:
            d_risk_level = "High"
        elif d_risk_score >= 40:
            d_risk_level = "Moderate"
        else:
            d_risk_level = "Low"

        daily_forecast.append(DailyForecastItem(
            date=d_date,
            temperature_max_c=d_max,
            temperature_min_c=d_min,
            precipitation_sum_mm=d_precip,
            precipitation_probability_pct=d_prob,
            weather_code=d_code,
            weather_condition=d_text,
            weather_icon=d_icon,
            disease_risk_level=d_risk_level,
            disease_risk_score=d_risk_score
        ))

    today_precip_prob = daily_forecast[0].precipitation_probability_pct if daily_forecast else 30

    risk_assessment = compute_disease_risk(
        temp=temp,
        humidity=humidity,
        rain=rain,
        wind=wind,
        precip_prob=today_precip_prob
    )

    advisories = generate_agricultural_advisories(
        temp=temp,
        humidity=humidity,
        rain=rain,
        wind=wind,
        precip_prob=today_precip_prob,
        crop=crop,
        disease=disease
    )

    loc_str = location_name or f"Field Station ({lat:.2f}°, {lon:.2f}°)"

    return WeatherIntelligenceResponse(
        location=loc_str,
        latitude=lat,
        longitude=lon,
        current=current,
        risk_assessment=risk_assessment,
        advisories=advisories,
        daily_forecast=daily_forecast
    )
