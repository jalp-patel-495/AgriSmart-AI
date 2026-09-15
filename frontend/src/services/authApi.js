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
  async changePassword(emailOrObj, currentPassword, newPassword) {
    let email = emailOrObj;
    let oldPwd = currentPassword;
    let newPwd = newPassword;
    if (typeof emailOrObj === 'object' && emailOrObj !== null) {
      const user = this.getCurrentUser();
      email = emailOrObj.email || user?.email;
      oldPwd = emailOrObj.old_password || emailOrObj.current_password;
      newPwd = emailOrObj.new_password;
    }
    const res = await fetch(`${API_BASE}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        current_password: oldPwd,
        new_password: newPwd,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to change password.');
    }
    return data;
  },

  /**
   * Fetches latest profile data for current user.
   */
  async getMe() {
    const res = await fetch(`${API_BASE}/me`, {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch user profile.');
    }
    const currentUser = this.getCurrentUser() || {};
    const updatedUser = { ...currentUser, ...data };
    this.saveUser(updatedUser);
    return updatedUser;
  },

  /**
   * Uploads user profile photo.
   */
  async uploadProfilePhoto(file) {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const user = this.getCurrentUser();
    if (user && user.token) {
      headers['Authorization'] = `Bearer ${user.token}`;
    }

    const res = await fetch(`${API_BASE}/profile-photo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to upload photo.');
    }

    const currentUser = this.getCurrentUser() || {};
    const updatedUser = { ...currentUser, ...data };
    this.saveUser(updatedUser);
    return updatedUser;
  },

  /**
   * Helper to return authenticated headers containing Bearer token.
   */
  getAuthHeaders() {
    const user = this.getCurrentUser();
    const headers = { 'Content-Type': 'application/json' };
    if (user && user.token) {
      headers['Authorization'] = `Bearer ${user.token}`;
    }
    return headers;
  },

  /**
   * Expert Review API: Fetches aggregated real farm telemetry.
   * Restricted to AGRICULTURAL_EXPERT and ADMIN.
   */
  async getExpertReviewData() {
    const res = await fetch('/api/v1/expert/review-data', {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch expert review data.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Admin API: Fetches all registered users with role and status.
   * Restricted to ADMIN role only.
   */
  async getUsers(searchQuery = '', roleFilter = '') {
    const params = new URLSearchParams();
    if (searchQuery) params.append('q', searchQuery);
    if (roleFilter) params.append('role', roleFilter);
    const url = `/api/v1/admin/users${params.toString() ? `?${params.toString()}` : ''}`;

    const res = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Access forbidden: Admin privilege required.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Admin API: Modifies the role of a user.
   * Restricted to ADMIN role only.
   */
  async updateUserRole(userId, newRole) {
    const res = await fetch(`/api/v1/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to update user role.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Admin API: Activates or deactivates a user account.
   * Restricted to ADMIN role only.
   */
  async updateUserStatus(userId, isActive) {
    const res = await fetch(`/api/v1/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ is_active: isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to update user status.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Admin API: Fetches real status of project AI models and services.
   * Restricted to ADMIN role only.
   */
  async getSystemMonitoring() {
    const res = await fetch('/api/v1/admin/system-monitoring', {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Access forbidden: Admin privilege required.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Fetches dashboard overview metrics.
   * Restricted to AGRICULTURAL_STAKEHOLDER and ADMIN.
   */
  async getStakeholderDashboard() {
    const res = await fetch('/api/v1/stakeholder/dashboard', {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch stakeholder dashboard.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Fetches crop suitability and recommendation distribution.
   */
  async getStakeholderCropIntelligence() {
    const res = await fetch('/api/v1/stakeholder/crop-intelligence', {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch crop intelligence.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Fetches disease intelligence and pathogenetic risks.
   */
  async getStakeholderDiseaseIntelligence(crop = '') {
    const url = crop ? `/api/v1/stakeholder/disease-intelligence?crop=${encodeURIComponent(crop)}` : '/api/v1/stakeholder/disease-intelligence';
    const res = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch disease intelligence.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Fetches cross-subsystem risk synthesis.
   */
  async getStakeholderRisks() {
    const res = await fetch('/api/v1/stakeholder/risks', {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch agricultural risks.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Fetches regional and multi-farm visibility.
   */
  async getStakeholderRegionalIntelligence(region = '') {
    const url = region ? `/api/v1/stakeholder/regional-intelligence?region=${encodeURIComponent(region)}` : '/api/v1/stakeholder/regional-intelligence';
    const res = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch regional intelligence.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Interacts with grounded Agri Intelligence Copilot.
   */
  async queryStakeholderCopilot(query, context = null) {
    const res = await fetch('/api/v1/stakeholder/copilot', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ query, context }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to consult copilot.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: List actively connected farmers with genuine agricultural telemetry.
   */
  async getConnectedFarmers(search = '', crop = '', risk = '') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (crop) params.append('crop', crop);
    if (risk) params.append('risk', risk);
    const url = `/api/v1/stakeholder/farmers${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch connected farmers.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Fetch dedicated agricultural profile for a connected farmer.
   */
  async getFarmerAgriculturalProfile(farmerId) {
    const res = await fetch(`/api/v1/stakeholder/farmers/${farmerId}`, {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch farmer agricultural profile.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: List pending farmer connection requests.
   */
  async getPendingConnectionRequests() {
    const res = await fetch('/api/v1/stakeholder/pending-requests', {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch pending connection requests.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Approve a pending farmer connection request.
   */
  async approveConnectionRequest(connectionId, notes = '') {
    const res = await fetch(`/api/v1/stakeholder/connections/${connectionId}/approve`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to approve connection request.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Reject a pending farmer connection request.
   */
  async rejectConnectionRequest(connectionId, notes = '') {
    const res = await fetch(`/api/v1/stakeholder/connections/${connectionId}/reject`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to reject connection request.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Disconnect an active farmer from organization network.
   */
  async removeFarmerConnection(connectionId) {
    const res = await fetch(`/api/v1/stakeholder/connections/${connectionId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to remove farmer connection.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Farmer API: Fetch connected organizations and discoverable stakeholders.
   */
  async getFarmerStakeholderConnections() {
    const res = await fetch('/api/v1/farmer/stakeholder-connections', {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch connected organizations.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Farmer API: Submit a connection request to an agricultural organization.
   */
  async createFarmerStakeholderConnection(stakeholderId, notes = '') {
    const res = await fetch('/api/v1/farmer/stakeholder-connections', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ stakeholder_id: stakeholderId, notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to submit connection request.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Farmer API: Disconnect from an agricultural organization or cancel pending request.
   */
  async cancelFarmerConnection(relationshipId) {
    const res = await fetch(`/api/v1/farmer/stakeholder-connections/${relationshipId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to cancel connection.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Fetch agronomic crop statistics across connected farms.
   */
  async getStakeholderCropStatistics() {
    const res = await fetch('/api/v1/stakeholder/crop-statistics', {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch crop statistics.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Stakeholder API: Fetch chronological activity ledger from connected farm nodes.
   */
  async getStakeholderActivity(limit = 50) {
    const res = await fetch(`/api/v1/stakeholder/activity?limit=${limit}`, {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.detail || 'Failed to fetch activity ledger.');
      err.status = res.status;
      throw err;
    }
    return data;
  },
};


