/**
 * AgriSmart AI – Frontend API Service
 * Handles communication with the FastAPI backend service (/api/v1/predict and /api/v1/health)
 */

const BASE_URL = '';

/**
 * Health check to verify backend status.
 */
export async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${BASE_URL}/api/v1/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Health check failed with HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('[AgriSmart API] Backend unreachable:', error.message);
    return { status: 'offline', error: error.message };
  }
}

/**
 * Sends image file to FastAPI /api/v1/predict endpoint.
 * @param {File|Blob} file - Crop leaf image
 * @returns {Promise<Object>} Diagnostic result payload
 */
export async function predictCropDisease(file) {
  const formData = new FormData();
  // Ensure a valid filename is supplied even if blob is passed from camera
  const filename = file.name || 'field_leaf_capture.jpg';
  formData.append('file', file, filename);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for field connectivity

  const headers = {};
  try {
    const rawUser = localStorage.getItem('agrismart_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed && parsed.token) {
        headers['Authorization'] = `Bearer ${parsed.token}`;
      }
    }
  } catch (_) {}

  try {
    const response = await fetch(`${BASE_URL}/api/v1/predict`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = `Server returned status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) errorDetail = errorJson.detail;
      } catch (_) {}
      throw new Error(errorDetail);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Inference request timed out. Please verify your connection or try a smaller image.');
    }
    throw error;
  }
}
