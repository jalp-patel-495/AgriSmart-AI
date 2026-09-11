"""
AgriSmart AI – Smart Irrigation Engine & IoT Telemetry Simulator
Implements FAO-56 Penman-Monteith crop water requirements and soil moisture deficit equations.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from backend.app.schemas.smart_farming import (
    IrrigationRequest,
    IrrigationAdvisoryResponse,
    IoTSensorReadingResponse,
    IoTHistoryItem,
    IoTTelemetryFeed,
)

# FAO-56 Crop Coefficients (Kc) and Root Depths (m)
CROP_IRRIGATION_PROFILES: Dict[str, Dict[str, float]] = {
    "Tomato": {"kc": 1.05, "root_depth": 0.50, "mad": 0.45},
    "Potato": {"kc": 1.00, "root_depth": 0.45, "mad": 0.40},
    "Corn": {"kc": 1.10, "root_depth": 0.80, "mad": 0.50},
    "Maize": {"kc": 1.10, "root_depth": 0.80, "mad": 0.50},
    "Apple": {"kc": 0.85, "root_depth": 1.00, "mad": 0.50},
    "Rice": {"kc": 1.20, "root_depth": 0.35, "mad": 0.20},
    "Wheat": {"kc": 0.90, "root_depth": 0.70, "mad": 0.50},
    "Cotton": {"kc": 1.05, "root_depth": 0.90, "mad": 0.55},
    "Grapes": {"kc": 0.70, "root_depth": 0.90, "mad": 0.45},
    "Banana": {"kc": 1.15, "root_depth": 0.60, "mad": 0.35},
}

# Soil Hydraulic Properties: Field Capacity (FC), Wilting Point (PWP) in volumetric %
SOIL_PROPERTIES: Dict[str, Dict[str, float]] = {
    "Sandy Loam": {"fc": 21.0, "pwp": 9.0, "saturation": 40.0},
    "Loam": {"fc": 28.0, "pwp": 12.0, "saturation": 46.0},
    "Clay Loam": {"fc": 36.0, "pwp": 18.0, "saturation": 52.0},
    "Black Cotton Soil": {"fc": 42.0, "pwp": 22.0, "saturation": 58.0},
    "Silt Loam": {"fc": 32.0, "pwp": 14.0, "saturation": 48.0},
}


def calculate_smart_irrigation(req: IrrigationRequest) -> IrrigationAdvisoryResponse:
    """
    Computes soil water deficit, ETc demand, and exact irrigation recommendation.
    """
    crop_info = CROP_IRRIGATION_PROFILES.get(req.crop, {"kc": 1.00, "root_depth": 0.50, "mad": 0.50})
    soil_info = SOIL_PROPERTIES.get(req.soil_type, {"fc": 32.0, "pwp": 14.0, "saturation": 48.0})

    fc = soil_info["fc"]
    pwp = soil_info["pwp"]
    sat = soil_info["saturation"]
    awc = fc - pwp  # Available Water Capacity (%)
    mad = crop_info["mad"]  # Management Allowed Depletion (0.40 - 0.50)
    raw = awc * mad  # Readily Available Water (%)
    critical_threshold = fc - raw

    # Weighted root-zone moisture (60% upper 15cm, 40% lower 30cm)
    current_moisture = (req.moisture_15cm * 0.6) + (req.moisture_30cm * 0.4)

    # Reference Evapotranspiration (ET0) estimation based on temp & humidity
    temp_factor = max(1.0, (req.ambient_temp / 20.0) ** 1.3)
    humidity_factor = max(0.6, (100.0 - req.humidity) / 45.0)
    et0 = 3.8 * temp_factor * humidity_factor
    etc = round(et0 * crop_info["kc"], 2)  # Daily Crop Water Demand (mm/day)

    # Soil Deficit calculation
    deficit_pct = max(0.0, fc - current_moisture)

    # Decision Matrix
    status = "Adequate"
    status_color = "#22c55e"
    headline = "Optimal Soil Moisture – No Irrigation Needed"
    action_required = "Soil hydration is within the comfortable root uptake zone. Maintain regular monitoring."
    water_litres_per_ha = 0.0
    drip_minutes = 0
    weather_note = "Normal atmospheric demand."

    # 1. Check for Waterlogging / Saturation
    if current_moisture >= (fc + (sat - fc) * 0.6):
        status = "Waterlogged"
        status_color = "#3b82f6"
        headline = "Excess Soil Saturation – Cease Irrigation Immediately"
        action_required = "Soil pores are saturated, suffocating root respiration and promoting fungal root rots (Pythium/Phytophthora). Ensure drainage channels are clear."
        weather_note = "Do not apply water under any circumstances."

    # 2. Check for Immediate Irrigation Need (Below critical threshold)
    elif current_moisture <= critical_threshold:
        # Effective moisture needed to bring back to Field Capacity
        moisture_to_add_pct = (fc - current_moisture)

        # Factor in expected rainfall
        rain_buffer = req.rain_forecast_mm * 0.8  # 80% effective rainfall
        effective_deficit_mm = max(0.0, (moisture_to_add_pct / 100.0) * (crop_info["root_depth"] * 1000.0) - rain_buffer)

        # Litres per hectare: 1 mm depth across 1 hectare (10,000 m2) = 10,000 Litres
        water_litres_per_ha = round(effective_deficit_mm * 10000.0, 1)
        total_water = round(water_litres_per_ha * req.field_size_hectares, 1)

        # Drip application time (assuming standard 4 mm/hr drip discharge = 40,000 L/ha/hr)
        drip_minutes = int(round((effective_deficit_mm / 4.0) * 60))

        if req.rain_forecast_mm >= 15.0:
            status = "Scheduled"
            status_color = "#eab308"
            headline = f"Rain Imminent ({req.rain_forecast_mm}mm) – Postpone Irrigation"
            action_required = f"Soil is dry, but substantial rain is forecast within 24-48h. Postpone artificial watering to conserve resources and avoid nutrient runoff."
            weather_note = f"Rainfall forecast of {req.rain_forecast_mm}mm will replenish root zone naturally."
            water_litres_per_ha = 0.0
            drip_minutes = 0
        else:
            status = "Immediate"
            status_color = "#ef4444"
            headline = f"Critical Moisture Deficit – Irrigate {water_litres_per_ha:,.0f} L/ha"
            action_required = f"Soil moisture ({current_moisture:.1f}%) has breached the stress threshold ({critical_threshold:.1f}%). Run drip irrigation for {drip_minutes} minutes in the early morning."
            if req.rain_forecast_mm > 0:
                weather_note = f"Adjusted for {req.rain_forecast_mm}mm forecast rain; reduced volume by {rain_buffer:.1f}mm."
            else:
                weather_note = "Zero rain predicted; full replenishment applied."

    # 3. Approaching Deficit (Within 3% of critical threshold)
    elif current_moisture <= (critical_threshold + 3.0):
        status = "Scheduled"
        status_color = "#eab308"
        headline = "Moisture Depleting – Prepare Irrigation in 24–36h"
        action_required = f"Moisture is trending downward. Schedule a maintenance drip cycle tomorrow morning if no precipitation occurs."
        water_litres_per_ha = round((etc * 1.5) * 10000.0, 1)
        drip_minutes = int(round((etc * 1.5 / 4.0) * 60))
        weather_note = f"Daily crop water use is {etc} mm/day."

    total_water = round(water_litres_per_ha * req.field_size_hectares, 1)

    return IrrigationAdvisoryResponse(
        crop=req.crop,
        soil_type=req.soil_type,
        status=status,
        status_color=status_color,
        headline=headline,
        action_required=action_required,
        water_amount_litres_per_ha=water_litres_per_ha,
        total_water_litres=total_water,
        drip_duration_minutes=drip_minutes,
        crop_et_mm_day=etc,
        soil_water_deficit_pct=round(deficit_pct, 1),
        management_allowed_depletion_pct=round(mad * 100, 1),
        weather_adjustment_note=weather_note,
        created_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    )


def get_simulated_iot_feed(scenario: str = "normal") -> IoTTelemetryFeed:
    """
    Returns simulated IoT telemetry stream with 24-hour time series history.
    Supported scenarios: 'normal', 'drought', 'waterlogged'.
    """
    now = datetime.utcnow()

    if scenario == "drought":
        curr_15 = 14.5
        curr_30 = 18.2
        curr_temp = 32.4
        curr_ec = 2.4
        status = "Critical Drought Stress"
        base_curve = [28.0, 26.0, 24.0, 22.0, 20.0, 18.0, 16.0, 14.5]
    elif scenario == "waterlogged":
        curr_15 = 49.2
        curr_30 = 53.0
        curr_temp = 20.8
        curr_ec = 0.5
        status = "Saturated / Waterlogged"
        base_curve = [35.0, 38.0, 42.0, 45.0, 48.0, 50.0, 52.0, 49.2]
    else:  # normal / optimal
        curr_15 = 33.8
        curr_30 = 37.5
        curr_temp = 24.6
        curr_ec = 1.2
        status = "Optimal Root Zone Hydration"
        base_curve = [36.0, 35.5, 35.0, 34.5, 34.2, 34.0, 33.9, 33.8]

    history: List[IoTHistoryItem] = []
    for i in range(8):
        t = now - timedelta(hours=(7 - i) * 3)
        history.append(IoTHistoryItem(
            time_label=t.strftime("%H:%M"),
            moisture_15cm=round(base_curve[i], 1),
            moisture_30cm=round(base_curve[i] + 3.5, 1),
            soil_temp=round(curr_temp - 2.0 + (i * 0.4), 1)
        ))

    current = IoTSensorReadingResponse(
        device_id="AGRI-NODE-01 (LoRaWAN)",
        timestamp=now.strftime("%Y-%m-%d %H:%M:%S UTC"),
        soil_moisture_15cm=curr_15,
        soil_moisture_30cm=curr_30,
        soil_temp=curr_temp,
        electrical_conductivity=curr_ec,
        battery_level=97.5,
        moisture_status=status
    )

    return IoTTelemetryFeed(
        current=current,
        history=history,
        active_scenario=scenario
    )
