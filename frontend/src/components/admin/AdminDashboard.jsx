import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { roleApi } from '../../services/roleApi';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roleApi.getAdminDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      setError(err.message || 'Unable to retrieve administrative metrics from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const totalUsers = stats?.total_users ?? 0;
  const farmersCount = stats?.farmers_count ?? 0;
  const expertsCount = stats?.experts_count ?? 0;
  const stakeholdersCount = stats?.stakeholders_count ?? 0;
  const adminsCount = stats?.admins_count ?? 0;
  const totalScans = stats?.total_scans ?? 0;
  const totalDiseases = stats?.total_diseases ?? 0;
  const rawModelStatus = stats?.ai_model_status;
  const isOperational = rawModelStatus && (rawModelStatus.toLowerCase().includes('ready') || rawModelStatus.toLowerCase().includes('operational'));
  const engineStatusDisplay = isOperational ? 'Operational' : (rawModelStatus || 'Unavailable');
  const recentActivity = stats?.recent_activity || [];

  // Percentage calculations for role distribution progress bars
  const totalForDistribution = Math.max(1, totalUsers);
  const farmerPct = Math.round((farmersCount / totalForDistribution) * 100);
  const expertPct = Math.round((expertsCount / totalForDistribution) * 100);
  const stakeholderPct = Math.round((stakeholdersCount / totalForDistribution) * 100);
  const adminPct = Math.round((adminsCount / totalForDistribution) * 100);

  return (
    <div className="role-page-container admin-dashboard-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#f87171' }}>Platform Operations Command</span>
          <h1 className="page-main-title">⚙️ Platform Operations Command</h1>
          <h2 style={{ fontSize: '1.05rem', color: '#94a3b8', margin: '0.25rem 0 0.5rem 0', fontWeight: 500 }}>
            AgriSmart AI Administrative Dashboard
          </h2>
          <p className="page-desc" style={{ margin: 0 }}>
            Manage platform access, monitor AI infrastructure, and maintain system governance.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#dc2626' }}
            onClick={() => navigate('/admin/users')}
          >
            👥 Manage Users
          </button>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => navigate('/admin/ai-model')}
          >
            🧠 AI Model Specs
          </button>
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {error}</span>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={fetchStats}
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '1.75rem' }}>
        {/* Card 1: Total Platform Users */}
        <div className="kpi-metric-card" style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
          <div className="kpi-top">
            <span className="kpi-label">Total Platform Users</span>
            <span className="kpi-icon-pill blue">👥</span>
          </div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>
            {loading ? '...' : totalUsers.toLocaleString()}
          </div>
          <div className="kpi-footer text-info">
            {loading ? 'Querying database...' : `${farmersCount} Farmers • ${expertsCount} Experts • ${stakeholdersCount} Stakeholders`}
          </div>
        </div>

        {/* Card 2: Total Diagnostic Scans */}
        <div className="kpi-metric-card" style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
          <div className="kpi-top">
            <span className="kpi-label">Total Diagnostic Scans</span>
            <span className="kpi-icon-pill green">🔬</span>
          </div>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {loading ? '...' : totalScans.toLocaleString()}
          </div>
          <div className="kpi-footer text-success">
            {loading ? 'Querying database...' : 'Total field observations recorded'}
          </div>
        </div>

        {/* Card 3: Disease / Pathology Classes */}
        <div className="kpi-metric-card" style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
          <div className="kpi-top">
            <span className="kpi-label">Disease / Pathology Classes</span>
            <span className="kpi-icon-pill amber">🦠</span>
          </div>
          <div className="kpi-value" style={{ color: '#fbbf24' }}>
            {loading ? '...' : totalDiseases.toLocaleString()}
          </div>
          <div className="kpi-footer text-warning">
            {loading ? 'Querying database...' : 'Active pathogen catalog classes'}
          </div>
        </div>

        {/* Card 4: AI Engine Status */}
        <div className="kpi-metric-card" style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
          <div className="kpi-top">
            <span className="kpi-label">AI Engine Status</span>
            <span className="kpi-icon-pill purple">⚡</span>
          </div>
          <div className="kpi-value" style={{ color: isOperational ? '#34d399' : '#f87171' }}>
            {loading ? '...' : engineStatusDisplay}
          </div>
          <div className="kpi-footer text-accent">
            {loading ? 'Verifying model artifact...' : (isOperational ? 'Neural inference service online' : 'Service offline or unverified')}
          </div>
        </div>
      </div>

      {/* Main 2-Column Section: User Distribution & System Audit Activity */}
      <div className="dashboard-double-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        
        {/* LEFT: Ecosystem User Distribution */}
        <div
          className="dashboard-panel main-panel"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="panel-header-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1.25rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              paddingBottom: '0.75rem',
            }}
          >
            <div>
              <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                📊 Ecosystem User Distribution
              </h2>
              <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Active registered accounts by role authorization tier
              </p>
            </div>
            <Link to="/admin/users" className="panel-link" style={{ fontSize: '0.82rem', color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>
              Manage Users →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: '#94a3b8' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
              <span>Loading user distribution metrics...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Farmers */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.88rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>👨‍🌾</span> <strong>Farmers</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 700 }}>
                    {farmersCount} <small style={{ color: '#64748b', fontWeight: 400 }}>({farmerPct}%)</small>
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${farmerPct}%`, height: '100%', background: '#34d399', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Agricultural Experts */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.88rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🧑‍🔬</span> <strong>Agricultural Experts</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 700 }}>
                    {expertsCount} <small style={{ color: '#64748b', fontWeight: 400 }}>({expertPct}%)</small>
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${expertPct}%`, height: '100%', background: '#c084fc', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Stakeholders */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.88rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🌐</span> <strong>Stakeholders</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700 }}>
                    {stakeholdersCount} <small style={{ color: '#64748b', fontWeight: 400 }}>({stakeholderPct}%)</small>
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${stakeholderPct}%`, height: '100%', background: '#38bdf8', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Administrators */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.88rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>⚙️</span> <strong>Administrators</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#f87171', fontWeight: 700 }}>
                    {adminsCount} <small style={{ color: '#64748b', fontWeight: 400 }}>({adminPct}%)</small>
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${adminPct}%`, height: '100%', background: '#f87171', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', padding: '0.85rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.78rem', color: '#94a3b8' }}>
                🔒 Strict RBAC enforced: Platform security boundaries isolate Farmer, Expert, Stakeholder, and Admin capabilities.
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: System Audit Activity */}
        <div
          className="dashboard-panel side-panel"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="panel-header-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1.25rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              paddingBottom: '0.75rem',
            }}
          >
            <div>
              <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                ⚡ System Audit Activity
              </h2>
              <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Latest verified system actions and diagnostic events
              </p>
            </div>
            <Link to="/admin/activity" className="panel-link" style={{ fontSize: '0.82rem', color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>
              View Full Logs →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: '#94a3b8' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
              <span>Loading audit activity...</span>
            </div>
          ) : recentActivity.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚡</span>
              <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>No Recent System Activity</strong>
              <small style={{ color: '#64748b' }}>Platform events will appear here when operational actions occur.</small>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {recentActivity.map((act, idx) => {
                const category = act.type === 'diagnosis' ? 'AI INFERENCE' : (act.type === 'user' ? 'USER MGMT' : 'SYSTEM');
                const outcome = act.status || 'Completed';
                const isFailed = outcome.toLowerCase().includes('fail') || outcome.toLowerCase().includes('error');
                const isHealthy = outcome.toLowerCase().includes('healthy') || outcome.toLowerCase().includes('active') || outcome.toLowerCase().includes('success') || outcome.toLowerCase().includes('completed');

                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', color: act.type === 'diagnosis' ? '#34d399' : '#38bdf8' }}>
                        ⚡ {category}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          background: isFailed ? 'rgba(239, 68, 68, 0.15)' : (isHealthy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)'),
                          color: isFailed ? '#f87171' : (isHealthy ? '#34d399' : '#fbbf24'),
                          border: isFailed ? '1px solid rgba(239, 68, 68, 0.3)' : (isHealthy ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)'),
                        }}
                      >
                        ● {outcome}
                      </span>
                    </div>
                    <strong style={{ color: '#fff', fontSize: '0.88rem', display: 'block', marginBottom: '0.2rem' }}>
                      {act.title}
                    </strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
                      <span>Actor: <strong style={{ color: '#cbd5e1' }}>{act.description}</strong></span>
                      <span style={{ color: '#64748b' }}>{act.timestamp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
