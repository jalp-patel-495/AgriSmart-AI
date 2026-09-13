/**
 * AgriSmart AI – Sustainability Score API Client (Bonus Module D)
 * Interfaces with FastAPI POST /api/v1/sustainability-score
 */

const BASE_URL = '';

/**
 * Computes deterministic sustainability score based on real farm conditions
 * @param {Object} payload - { crop, soil_moisture, temperature, humidity, nitrogen, phosphorus, potassium, rainfall, irrigation_prediction, irrigation_priority, disease, disease_confidence, rain_probability, weather_risk, forecast_precipitation }
 */
export async function fetchSustainabilityScore(payload) {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/sustainability-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let msg = `Sustainability score request failed with HTTP ${res.status}`;
      try {
        const err = await res.json();
        if (err.detail) msg = err.detail;
      } catch (_) {}
      throw new Error(msg);
    }

    return await res.json();
  } catch (err) {
    console.warn('Sustainability API fetch error:', err);
    return null;
  }
}
