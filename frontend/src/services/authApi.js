/**
 * AgriSmart AI – Authentication API Service
 * Handles user signup, login, demo-login, session persistence in localStorage, and logout.
 */

const STORAGE_KEY = 'agrismart_user';
const API_BASE = '/api/v1/auth';

export const authApi = {
  /**
   * Retrieves the currently authenticated user from localStorage.
   */
  getCurrentUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('Error reading user session:', e);
      return null;
    }
  },

  /**
   * Persists user profile and token into localStorage.
   */
  saveUser(user) {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  /**
   * Clears the current user session (Sign Out).
   */
  logout() {
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * User Signup / Registration.
   */
  async signup(userData) {
    const res = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Registration failed. Please check your details.');
    }

    this.saveUser(data);
    return data;
  },

  /**
   * User Login.
   */
  async login(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Invalid email or password.');
    }

    this.saveUser(data);
    return data;
  },

  /**
   * Instant Demo Login for quick testing.
   */
  async demoLogin(role = 'farmer') {
    const res = await fetch(`${API_BASE}/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Demo login failed.');
    }

    this.saveUser(data);
    return data;
  },

  /**
   * Updates user profile (full_name, farm_name, farm_location, preferred_crop).
   */
  async updateProfile(profileData) {
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to update profile.');
    }

    // Update stored user details while preserving token
    const currentUser = this.getCurrentUser() || {};
    const updatedUser = { ...currentUser, ...data };
    this.saveUser(updatedUser);
    return updatedUser;
  },

  /**
   * Changes user password.
   */
  async changePassword(email, currentPassword, newPassword) {
    const res = await fetch(`${API_BASE}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to change password.');
    }

    return data;
  },
};

