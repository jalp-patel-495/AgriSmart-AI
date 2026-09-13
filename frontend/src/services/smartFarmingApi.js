/**
 * AgriSmart AI – Smart Farming & Irrigation API Client
 * Interfaces with FastAPI /api/v1/smart-farming endpoints
 */

const BASE_URL = '';

/**
 * Predict irrigation need using the real 3-feature trained ML model
 * Input features: soil_moisture, temperature, humidity
 */
export async function predictRealIrrigation({ soil_moisture, temperature, humidity }) {
  const res = await fetch(`${BASE_URL}/api/v1/predict/advisory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      soil_moisture: Number(soil_moisture),
      temperature: Number(temperature),
      humidity: Number(humidity),
    }),
  });
  if (!res.ok) {
    let msg = `Irrigation prediction failed with HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.irrigation;
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('agrismart_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }
    }
  } catch (_) {}
  return headers;
}

/**
 * Fetch smart irrigation calculation and recommendation (Legacy compatibility)
 */
export async function getIrrigationAdvisory(payload) {
  const res = await fetch(`${BASE_URL}/api/v1/smart-farming/irrigation-advisory`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `Irrigation request failed with HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Fetch live simulated IoT sensor telemetry & 24h history
 */
export async function getIoTTelemetry(scenario = 'normal') {
  const res = await fetch(`${BASE_URL}/api/v1/smart-farming/iot-telemetry?scenario=${scenario}`);
  if (!res.ok) {
    throw new Error(`IoT Telemetry request failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Request ML crop recommendation based on soil NPK, pH & climate
 */
export async function getCropRecommendation(payload) {
  const res = await fetch(`${BASE_URL}/api/v1/smart-farming/recommend-crop`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `Crop recommendation failed with HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Fetch agro-climatic soil presets
 */
export async function getSoilPresets() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/smart-farming/soil-presets`);
    if (!res.ok) throw new Error('Failed to fetch presets');
    return await res.json();
  } catch (err) {
    console.warn('Fallback soil presets:', err);
    return [
      {
        name: "Indo-Gangetic Alluvial Plain",
        region: "Punjab / Haryana / UP",
        description: "Deep fertile alluvial loam with balanced organic matter, moderate rainfall and strong tubewell irrigation.",
        typical_crops: ["Rice", "Maize", "Wheat", "Cotton"],
        default_n: 85.0,
        default_p: 48.0,
        default_k: 42.0,
        default_ph: 6.8,
        default_temp: 25.5,
        default_humidity: 75.0,
        default_rainfall: 180.0
      }
    ];
  }
}

/**
 * Fetch advisory history logs from database
 */
export async function getAdvisoryHistory() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/smart-farming/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return await res.json();
  } catch (err) {
    console.warn('History fetch error:', err);
    return { irrigation_logs: [], crop_recommendations: [] };
  }
}

/**
 * Fetch dynamic 95 global crop classes catalog and literature profiles
 */
export async function getCropsCatalog() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/smart-farming/crops-catalog`);
    if (!res.ok) throw new Error('Failed to fetch crops catalog');
    return await res.json();
  } catch (err) {
    console.warn('Crops catalog fetch error:', err);
    return [];
  }
}

/**
 * Fetch training-data-derived mean feature values per crop (all 95 crops)
 */
export async function getCropTrainingMeans() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/smart-farming/crop-training-means`);
    if (!res.ok) throw new Error('Failed to fetch crop training means');
    return await res.json();
  } catch (err) {
    console.warn('Crop training means fetch error:', err);
    return {};
  }
}


