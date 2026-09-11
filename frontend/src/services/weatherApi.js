/**
 * AgriSmart AI – Weather Intelligence API Client
 * Interfaces with FastAPI /api/v1/weather endpoints
 */

const BASE_URL = '';

/**
 * Fetch presets of major farming regions
 */
export async function getFarmPresets() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/weather/presets`);
    if (!res.ok) throw new Error('Failed to fetch farm presets');
    return await res.json();
  } catch (err) {
    console.warn('Presets fallback:', err);
    return [
      { name: "Nashik Agricultural Belt", region: "Maharashtra", country: "India", latitude: 19.9975, longitude: 73.7898, primary_crops: ["Tomato", "Grapes", "Onion"] },
      { name: "Ludhiana Farm Basin", region: "Punjab", country: "India", latitude: 30.9010, longitude: 75.8573, primary_crops: ["Corn", "Wheat", "Potato"] },
      { name: "Anand Agronomy Region", region: "Gujarat", country: "India", latitude: 22.5645, longitude: 72.9289, primary_crops: ["Tomato", "Potato", "Tobacco"] },
      { name: "Fresno Central Valley", region: "California", country: "USA", latitude: 36.7468, longitude: -119.7726, primary_crops: ["Corn", "Tomato", "Fruits"] },
      { name: "Salinas Valley ('Salad Bowl')", region: "California", country: "USA", latitude: 36.6777, longitude: -121.6555, primary_crops: ["Tomato", "Vegetables", "Apple"] },
      { name: "Yakima Valley Orchards", region: "Washington", country: "USA", latitude: 46.6021, longitude: -120.5059, primary_crops: ["Apple", "Corn", "Cherries"] },
    ];
  }
}

/**
 * Fetch current weather, 7-day forecast, and disease risk assessment
 */
export async function getWeatherIntelligence(lat, lon, locationName = 'Field Station', crop = null, disease = null) {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    location: locationName,
  });
  if (crop) params.append('crop', crop);
  if (disease) params.append('disease', disease);

  const res = await fetch(`${BASE_URL}/api/v1/weather/current?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Weather request failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Fetch tailored recommendations correlating specific crop and disease with coordinates
 */
export async function getWeatherRecommendations(crop, disease, lat, lon) {
  const res = await fetch(`${BASE_URL}/api/v1/weather/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crop, disease, latitude: lat, longitude: lon }),
  });
  if (!res.ok) {
    throw new Error('Failed to retrieve weather recommendations');
  }
  return await res.json();
}
