/**
 * AgriSmart AI – Agentic Advisor API Client (Module G)
 * Interfaces with FastAPI POST /api/v1/agentic-advisor
 */

const BASE_URL = '';

/**
 * Calls the deterministic Agentic Advisor decision support engine
 * @param {Object} payload - { disease, irrigation, weather, crop_recommendation, yield_prediction, sustainability }
 * @returns {Promise<Object|null>} - AgenticAdvisorResponse
 */
export async function fetchAgenticAdvisor(payload) {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/agentic-advisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let msg = `Agentic Advisor request failed with HTTP ${res.status}`;
      try {
        const err = await res.json();
        if (err.detail) msg = err.detail;
      } catch (_) {}
      throw new Error(msg);
    }

    return await res.json();
  } catch (err) {
    console.warn('Agentic Advisor fetch error:', err);
    return null;
  }
}
