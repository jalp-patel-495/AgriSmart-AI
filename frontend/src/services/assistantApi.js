/**
 * AgriSmart AI – GenAI Assistant API Client
 * Interfaces with FastAPI /api/v1/assistant endpoints
 */

const BASE_URL = '';

/**
 * Send query to conversational AI assistant with active farm context
 */
export async function sendChatMessage(message, history = [], context = null) {
  const res = await fetch(`${BASE_URL}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      context,
    }),
  });

  if (!res.ok) {
    let msg = `AI Assistant request failed with HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Fetch tailored quick prompt starter chips
 */
export async function getQuickPrompts(crop = 'Tomato', disease = 'Early Blight') {
  try {
    const params = new URLSearchParams({ crop, disease });
    const res = await fetch(`${BASE_URL}/api/v1/assistant/quick-prompts?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch quick prompts');
    return await res.json();
  } catch (err) {
    console.warn('Fallback quick prompts:', err);
    return [
      { prompt: `Why is my ${crop.toLowerCase()} leaf turning brown?`, category: "Diagnostics", icon: "🍂" },
      { prompt: "What should I do after this disease prediction?", category: "Action Plan", icon: "📋" },
      { prompt: `When should I irrigate my ${crop.toLowerCase()} crop?`, category: "Irrigation", icon: "💧" },
      { prompt: `How can I prevent this disease next season?`, category: "Prevention", icon: "🛡️" },
    ];
  }
}
