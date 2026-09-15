import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { roleApi } from '../../services/roleApi';
import { authApi } from '../../services/authApi';

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentDiagnoses, setRecentDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentUser = authApi.getCurrentUser() || {};

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const statsData = await roleApi.getFarmerDashboardStats();
        setStats(statsData);
        const historyData = await roleApi.getFarmerDiagnoses('', '', 6);
        setRecentDiagnoses(historyData.records || []);
      } catch (err) {
        console.error('Failed to load farmer dashboard:', err);
        setError(err.message || 'Unable to load real-time farmer metrics.');
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  return (
    <div className="role-dashboard-wrapper">
      {/* Welcome Hero Banner */}
      <div className="farmer-welcome-hero">
        <div className="hero-content">
          <div className="hero-badge">🌾 Farm Health Center</div>
          <h1 className="hero-title">
            Welcome back, {currentUser.full_name || 'Farmer'}!
          </h1>
          <p className="hero-subtitle">
            {currentUser.farm_name ? `Farm: ${currentUser.farm_name}` : 'Family Homestead Farm'} •{' '}
            {currentUser.farm_location || 'Central Agricultural Zone'}
          </p>
          <div className="hero-quick-actions">
            <button
              className="btn-quick-scan"
              onClick={() => navigate('/farmer/disease-detection')}
            >
              <span className="scan-icon">🔬</span>
              <span>Scan Leaf Now</span>
            </button>
            <button
              className="btn-quick-scan"
              style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
              onClick={() => navigate('/farmer/irrigation')}
            >
              <span>💧 Smart Irrigation</span>
            </button>
            <button
              className="btn-quick-history"
              onClick={() => navigate('/farmer/disease-history')}
            >
              <span>📋 View Disease History</span>
            </button>
            <button
              className="btn-quick-weather"
              onClick={() => navigate('/farmer/weather')}
            >
              <span>🌦️ Weather</span>
            </button>
          </div>
        </div>
        <div className="hero-badge-decoration">
          <div className="eco-shield-badge">
            <span className="shield-icon">🛡️</span>
            <div>
              <strong>PlantVillage AI</strong>
              <small>38 Plant Classes Monitored</small>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="role-error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => window.location.reload()} className="btn-retry-small">Retry</button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="kpi-cards-grid">
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Leaf Scans</span>
            <span className="kpi-icon-pill blue">📸</span>
          </div>
          <div className="kpi-value">{loading ? '...' : (stats?.total_scans ?? 0)}</div>
          <div className="kpi-footer text-info">All-time diagnostic queries</div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Healthy Plants</span>
            <span className="kpi-icon-pill green">🌿</span>
          </div>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {loading ? '...' : (stats?.healthy_plants ?? 0)}
          </div>
          <div className="kpi-footer text-success">
            {stats?.total_scans ? `${Math.round(((stats?.healthy_plants || 0) / stats.total_scans) * 100)}% of scans` : 'Optimal vitality'}
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Diseased Plants</span>
            <span className="kpi-icon-pill amber">⚠️</span>
          </div>
          <div className="kpi-value" style={{ color: '#f87171' }}>
            {loading ? '...' : (stats?.diseased_plants ?? 0)}
          </div>
          <div className="kpi-footer text-warning">Requires treatment action</div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">AI Model Accuracy</span>
            <span className="kpi-icon-pill purple">🧠</span>
          </div>
          <div className="kpi-value" style={{ color: '#a78bfa' }}>
            {loading ? '...' : (stats?.accuracy_benchmark || '99.58%')}
          </div>
          <div className="kpi-footer text-accent">ResNet/ViT Ensemble</div>
        </div>
      </div>

      {/* Main Sections: Recent Diagnoses & Quick Farm Context */}
      <div className="dashboard-double-columns">
        {/* Recent Diagnoses Table */}
        <div className="dashboard-panel main-panel">
          <div className="panel-header-row">
            <div>
              <h2 className="panel-title">Recent Diagnoses</h2>
              <p className="panel-desc">Latest leaf inspections analyzed by the AI engine</p>
            </div>
            <Link to="/farmer/disease-history" className="panel-link">
              View All History →
            </Link>
          </div>

          {loading ? (
            <div className="loading-state-box">
              <div className="spinner"></div>
              <span>Fetching farm inspection records...</span>
            </div>
          ) : recentDiagnoses.length === 0 ? (
            <div className="empty-state-box">
              <span className="empty-icon">🍃</span>
              <h3>No Leaf Scans Yet</h3>
              <p>Upload or capture a leaf photo to diagnose crop health and receive treatment advice.</p>
              <button
                className="btn-primary-action"
                onClick={() => navigate('/farmer/disease-detection')}
              >
                🔬 Scan First Leaf
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="role-data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Crop</th>
                    <th>Diagnosis / Disease</th>
                    <th>Confidence</th>
                    <th>Health Status</th>
                    <th>Expert Review</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDiagnoses.map((record) => {
                    const isHealthy = record.is_healthy;
                    const dateFormatted = record.created_at
                      ? new Date(record.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Recently';

                    return (
                      <tr key={record.id}>
                        <td className="text-muted">{dateFormatted}</td>
                        <td>
                          <strong>{record.crop}</strong>
                        </td>
                        <td>
                          <span className={isHealthy ? 'diagnosis-healthy' : 'diagnosis-diseased'}>
                            {record.disease}
                          </span>
                        </td>
                        <td>
                          <span className="confidence-pill">
                            {typeof record.confidence === 'number'
                              ? `${Math.round(record.confidence <= 1 ? record.confidence * 100 : record.confidence)}%`
                              : `${record.confidence}%`}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${isHealthy ? 'healthy' : 'diseased'}`}>
                            {isHealthy ? '🌿 Healthy' : '⚠️ Diseased'}
                          </span>
                        </td>
                        <td>
                          {record.expert_status === 'CONFIRMED' ? (
                            <span className="expert-pill confirmed">✔️ Verified</span>
                          ) : record.expert_status === 'REJECTED' ? (
                            <span className="expert-pill rejected">✖ Rejected</span>
                          ) : (
                            <span className="expert-pill pending">⏳ In Review</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-table-action"
                            onClick={() => navigate('/farmer/disease-history')}
                            title="Inspect details and treatments"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side Panel: Farm Advisory & Quick Health Checklist */}
        <div className="dashboard-panel side-panel">
          <div className="panel-header-row">
            <div>
              <h2 className="panel-title">Field Care Advisory</h2>
              <p className="panel-desc">Seasonal crop tips</p>
            </div>
          </div>

          <div className="field-advisory-cards">
            <div className="advisory-card alert">
              <span className="advis-icon">🌧️</span>
              <div>
                <strong>High Moisture Precaution</strong>
                <p>Prevent fungal spore dispersal in Tomato and Potato crops by ensuring adequate soil drainage.</p>
              </div>
            </div>

            <div className="advisory-card success">
              <span className="advis-icon">🌱</span>
              <div>
                <strong>Crop Rotation Guidance</strong>
                <p>Rotate Solanaceae (Tomato, Potato, Pepper) with Legumes to replenish soil nitrogen levels naturally.</p>
              </div>
            </div>

            <div className="advisory-card info">
              <span className="advis-icon">💊</span>
              <div>
                <strong>Certified Treatment Library</strong>
                <p>Access dosage guidelines and organic spray alternatives verified by agronomists.</p>
                <Link to="/farmer/treatments" className="advis-link">
                  Open Treatment Catalog →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
