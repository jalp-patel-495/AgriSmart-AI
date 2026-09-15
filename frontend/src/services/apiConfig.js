/**
 * AgriSmart AI – Centralized API Base URL Configuration
 * Seamlessly resolves localhost development proxy vs. live cloud production backend.
 */
export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '' 
    : 'https://agrismart-backend-5o48.onrender.com');

export default API_BASE_URL;
