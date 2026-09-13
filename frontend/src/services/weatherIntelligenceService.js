/**
 * AgriSmart AI – Agrometeorological Weather Intelligence API Client
 * Centralized service for querying POST /api/v1/weather-intelligence
 */

const API_BASE = 'http://127.0.0.1:8000';

export const AGRICULTURAL_PRESETS = [
  {
    name: 'Nashik Agricultural Belt',
    region: 'Maharashtra',
    country: 'India',
    latitude: 19.9975,
    longitude: 73.7898,
    primary_crops: ['Tomato', 'Grape', 'Onion'],
  },
  {
    name: 'Anand Agronomy Region',
    region: 'Gujarat',
    country: 'India',
    latitude: 22.5645,
    longitude: 72.9289,
    primary_crops: ['Tomato', 'Potato', 'Bell Pepper'],
  },
  {
    name: 'Ludhiana Farm Basin',
    region: 'Punjab',
    country: 'India',
    latitude: 30.9010,
    longitude: 75.8573,
    primary_crops: ['Corn', 'Wheat', 'Potato'],
  },
  {
    name: 'Fresno Central Valley',
    region: 'California',
    country: 'USA',
    latitude: 36.7468,
    longitude: -119.7726,
    primary_crops: ['Corn', 'Tomato', 'Peach'],
  },
  {
    name: 'Salinas Valley ("Salad Bowl")',
    region: 'California',
    country: 'USA',
    latitude: 36.6777,
    longitude: -121.6555,
    primary_crops: ['Tomato', 'Bell Pepper', 'Apple'],
  },
  {
    name: 'Yakima Valley Orchards',
    region: 'Washington',
    country: 'USA',
    latitude: 46.6021,
    longitude: -120.5059,
    primary_crops: ['Apple', 'Peach', 'Grape'],
  },
];

/**
 * Returns available demo agricultural basin presets.
 */
export async function getFarmPresets() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/weather/presets`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn('Could not fetch remote presets, using regional presets:', e);
  }
  return AGRICULTURAL_PRESETS;
}

/**
 * Executes agrometeorological intelligence evaluation via POST /api/v1/weather-intelligence.
 * Zero data fabrication: cleanly identifies network errors or unavailable weather.
 */
export async function fetchWeatherIntelligence({
  latitude,
  longitude,
  crop = null,
  soilMoisture = 30.0,
  temperature = null,
  humidity = null,
  disease = null,
  diseaseConfidence = null,
}) {
  const payload = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    crop: crop && crop !== 'All' && crop !== 'All Crops' ? crop : null,
    soil_moisture: soilMoisture !== null && !isNaN(soilMoisture) ? Number(soilMoisture) : null,
    temperature: temperature !== null && !isNaN(temperature) ? Number(temperature) : null,
    humidity: humidity !== null && !isNaN(humidity) ? Number(humidity) : null,
    disease: disease || null,
    disease_confidence: diseaseConfidence !== null && !isNaN(diseaseConfidence) ? Number(diseaseConfidence) : null,
  };

  try {
    const res = await fetch(`${API_BASE}/api/v1/weather-intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (res.status === 422) {
        throw new Error('Invalid geographical coordinates provided. Latitude must be between -90 and 90, Longitude between -180 and 180.');
      }
      throw new Error(`Weather Intelligence service returned HTTP ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('fetchWeatherIntelligence error:', err);
    return {
      status: 'weather_unavailable',
      weather: null,
      weather_risk: null,
      irrigation_prediction: null,
      recommendation: 'Weather data unavailable.',
      reasoning: [err.message || 'Unable to connect to agrometeorological service.'],
      disease_monitoring: null,
      daily_forecast: [],
    };
  }
}
