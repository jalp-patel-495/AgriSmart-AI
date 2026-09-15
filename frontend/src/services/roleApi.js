/**
 * AgriSmart AI – Unified Role API Service
 * Connects frontend views to backend RBAC endpoints for Farmer, Stakeholder, Expert, and Admin roles.
 */
import { authApi } from './authApi';

const getHeaders = () => authApi.getAuthHeaders();

export const roleApi = {
  // ================= FARMER APIS =================
  async getFarmerDashboardStats() {
    const res = await fetch('/api/v1/farmer/dashboard-stats', { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch farmer stats.');
    return data;
  },

  async getFarmerDiagnoses(crop = '', status = '', limit = 50) {
    const params = new URLSearchParams();
    if (crop) params.append('crop', crop);
    if (status) params.append('status', status);
    params.append('limit', limit);

    const res = await fetch(`/api/v1/farmer/diagnoses?${params.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch diagnoses history.');
    return data;
  },

  async getFarmerDiagnosisDetail(id) {
    const res = await fetch(`/api/v1/farmer/diagnoses/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch diagnosis detail.');
    return data.diagnosis;
  },

  async getFarmerCrops() {
    const res = await fetch('/api/v1/farmer/crops', { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch farmer crops.');
    return data;
  },

  // ================= EXPERT APIS =================
  async getExpertDashboardStats() {
    const res = await fetch('/api/v1/expert/dashboard-stats', { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch expert stats.');
    return data;
  },

  async getExpertCases(status = 'ALL', crop = '') {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    if (crop) params.append('crop', crop);

    const res = await fetch(`/api/v1/expert/cases?${params.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch expert cases.');
    return data.cases || [];
  },

  async getExpertCaseDetail(id) {
    const res = await fetch(`/api/v1/expert/cases/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch case detail.');
    return data.case;
  },

  async submitExpertReview(caseId, reviewData) {
    const res = await fetch(`/api/v1/expert/cases/${caseId}/review`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(reviewData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to submit review.');
    return data;
  },

  async getTreatments(crop = '') {
    const params = new URLSearchParams();
    if (crop) params.append('crop', crop);
    const res = await fetch(`/api/v1/expert/treatments?${params.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch treatments.');
    return data.treatments || [];
  },

  async addTreatment(treatmentData) {
    const res = await fetch('/api/v1/expert/treatments', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(treatmentData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to add treatment.');
    return data;
  },

  async updateTreatment(id, treatmentData) {
    const res = await fetch(`/api/v1/expert/treatments/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(treatmentData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to update treatment.');
    return data;
  },

  async deleteTreatment(id) {
    const res = await fetch(`/api/v1/expert/treatments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to delete treatment.');
    return data;
  },

  // ================= ADMIN APIS =================
  async getAdminDashboardStats() {
    const res = await fetch('/api/v1/admin/dashboard-stats', { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch admin stats.');
    return data;
  },

  async getAdminUsers(q = '', role = '') {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (role) params.append('role', role);

    const res = await fetch(`/api/v1/admin/users?${params.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch users.');
    return data.users || [];
  },

  async createAdminUser(userData) {
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to create user.');
    return data;
  },

  async deleteAdminUser(id) {
    const res = await fetch(`/api/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to delete user.');
    return data;
  },

  async updateUserRole(id, role) {
    const res = await fetch(`/api/v1/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to update role.');
    return data;
  },

  async updateUserStatus(id, isActive) {
    const res = await fetch(`/api/v1/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ is_active: isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to update status.');
    return data;
  },

  async getCrops(q = '') {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    const res = await fetch(`/api/v1/admin/crops?${params.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch crops.');
    return data.crops || [];
  },

  async addCrop(cropData) {
    const res = await fetch('/api/v1/admin/crops', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(cropData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to add crop.');
    return data;
  },

  async updateCrop(id, cropData) {
    const res = await fetch(`/api/v1/admin/crops/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(cropData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to update crop.');
    return data;
  },

  async deleteCrop(id) {
    const res = await fetch(`/api/v1/admin/crops/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to delete crop.');
    return data;
  },

  async getDiseases(crop = '', q = '') {
    const params = new URLSearchParams();
    if (crop) params.append('crop', crop);
    if (q) params.append('q', q);
    const res = await fetch(`/api/v1/admin/diseases?${params.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch diseases.');
    return data.diseases || [];
  },

  async addDisease(diseaseData) {
    const res = await fetch('/api/v1/admin/diseases', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(diseaseData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to add disease.');
    return data;
  },

  async updateDisease(id, diseaseData) {
    const res = await fetch(`/api/v1/admin/diseases/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(diseaseData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to update disease.');
    return data;
  },

  async deleteDisease(id) {
    const res = await fetch(`/api/v1/admin/diseases/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to delete disease.');
    return data;
  },

  async getDatasetInfo() {
    const res = await fetch('/api/v1/admin/dataset-info', { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch dataset info.');
    return data;
  },

  async getSystemMonitoring() {
    const res = await fetch('/api/v1/admin/system-monitoring', { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch system monitoring.');
    return data;
  },
};
