import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/authApi';

export default function StakeholderRoleDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchMetrics = async (isBackground = false) => {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }
      try {
        const dashboardData = await authApi.getStakeholderDashboard(undefined, undefined, '30d');
        if (isMounted) {
          setData(dashboardData);
        }
      } catch (err) {
        if (isMounted && !isBackground) {
          console.error('Error fetching stakeholder metrics:', err);
          setError(err.message || 'Unable to retrieve stakeholder intelligence.');
        }
      } finally {
        if (isMounted && !isBackground) {
          setLoading(false);
        }
      }
    };
    fetchMetrics();

    // Auto-update periodically and on window focus when new diagnostic scans are recorded
    const intervalId = setInterval(() => {
      fetchMetrics(true);
    }, 15000);

    const handleFocus = () => {
      fetchMetrics(true);
    };

    const handleScanEvent = () => {
      fetchMetrics(true);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('agrismart:scan_created', handleScanEvent);
    window.addEventListener('storage', handleScanEvent);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('agrismart:scan_created', handleScanEvent);
      window.removeEventListener('storage', handleScanEvent);
    };
  }, []);

  // Extract real backend data - strictly zero fabricated numbers
  const macro = data?.macro_kpis || {};
  const kpis = data?.kpis || {};
  const healthyVsDiseased = data?.healthy_vs_diseased || {};
  const mostAffected = data?.most_affected_crops || [];
  const recentActivities = data?.recent_activity || [];

  // Real KPI values
  const connectedFarmersCount = macro.total_registered_farmers ?? kpis.monitored_farms_count ?? 0;
  const totalScansCount = healthyVsDiseased.total_scans ?? 0;
  const detectedDiseasesCount = healthyVsDiseased.diseased_count ?? macro.active_disease_incidents ?? 0;

  // Genuine Healthy vs Diseased diagnostic ratio logic
  const healthyCount = Number(healthyVsDiseased.healthy_count ?? 0);
  const diseasedCount = Number(healthyVsDiseased.diseased_count ?? 0);
  const totalClassified = healthyVsDiseased.total_classified !== undefined
    ? Number(healthyVsDiseased.total_classified)
    : (healthyCount + diseasedCount);

  let ratioDisplay = '-- : --';
  let ratioSubtitle = 'No classified diagnostic data available';

  if (totalClassified > 0) {
    let hPct;
    if (healthyVsDiseased.healthy_percentage !== undefined && healthyVsDiseased.healthy_percentage !== null) {
      hPct = Math.round(Number(healthyVsDiseased.healthy_percentage));
    } else {
      hPct = Math.round((healthyCount / totalClassified) * 100);
    }
    // Round only for display and ensure percentages represent 100% total
    const dPct = 100 - hPct;
    ratioDisplay = `${hPct}% : ${dPct}%`;
    ratioSubtitle = 'Healthy : Diseased ratio';
  } else if (healthyVsDiseased.ratio_str && healthyVsDiseased.ratio_str !== 'Data unavailable' && healthyVsDiseased.ratio_str !== '-- : --') {
    ratioDisplay = healthyVsDiseased.ratio_str;
    ratioSubtitle = healthyVsDiseased.ratio_subtitle || 'Healthy : Diseased ratio';
  } else if (healthyVsDiseased.ratio_str === '-- : --') {
    ratioDisplay = '-- : --';
    ratioSubtitle = healthyVsDiseased.ratio_subtitle || 'No classified diagnostic data available';
  }

  const rankMedals = ['🥇', '🥈', '🥉'];

  return (
    <div className="role-page-container stakeholder-dashboard-page">
      {/* Page Header */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#38bdf8' }}>Regional Agricultural Command</span>
          <h1 className="page-main-title">🌐 Stakeholder Intelligence Dashboard</h1>
          <p className="page-desc">
            Macro-level agricultural health, crop disease trends, and regional field intelligence.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#0284c7' }}
            onClick={() => navigate('/stakeholder/analytics')}
          >
            📊 View Analytics
          </button>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => navigate('/stakeholder/reports')}
          >
            📄 Reports
          </button>
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '1.75rem' }}>
        {/* Card 1: Connected Farmers */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Connected Farmers</span>
            <span className="kpi-icon-pill blue" title="Registered farm producers">👨‍🌾</span>
          </div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>
            {loading ? '...' : connectedFarmersCount.toLocaleString()}
          </div>
          <div className="kpi-footer text-info">Active agricultural producers</div>
        </div>

        {/* Card 2: Total Crop Scans */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Crop Scans</span>
            <span className="kpi-icon-pill green" title="Leaf diagnostic scans">🔬</span>
          </div>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {loading ? '...' : totalScansCount.toLocaleString()}
          </div>
          <div className="kpi-footer text-success">Monitored leaf inspections</div>
        </div>

        {/* Card 3: Detected Diseases */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Detected Diseases</span>
            <span className="kpi-icon-pill amber" title="Pathogen detections">🦠</span>
          </div>
          <div className="kpi-value" style={{ color: '#f87171' }}>
            {loading ? '...' : detectedDiseasesCount.toLocaleString()}
          </div>
          <div className="kpi-footer text-danger">Active foliar pathogen cases</div>
        </div>

        {/* Card 4: Healthy vs Diseased */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Healthy vs Diseased</span>
            <span className="kpi-icon-pill purple" title="Overall diagnostic health ratio">🌱</span>
          </div>
          <div className="kpi-value" style={{ color: '#a78bfa', fontSize: '1.65rem' }}>
            {loading ? '...' : ratioDisplay}
          </div>
          <div className="kpi-footer text-accent">{ratioSubtitle}</div>
        </div>
      </div>

      {/* Main 2-Column Dashboard Sections */}
      <div className="dashboard-double-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        
        {/* Most Affected Crops Section */}
        <div className="dashboard-panel main-panel" style={{ background: 'rgba(16, 28, 22, 0.8)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
          <div className="panel-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.85rem' }}>
            <div>
              <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                🌾 Most Affected Crops
              </h2>
              <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Incidence ranking based on recorded disease diagnoses
              </p>
            </div>
            <Link
              to="/stakeholder/analytics"
              className="panel-link"
              style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              View Crop Analytics →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: '#94a3b8' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
              <span>Loading crop incidence data...</span>
            </div>
          ) : mostAffected.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🌾</span>
              <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>No crop disease data available.</strong>
              <small style={{ color: '#64748b' }}>Pathogen cases will appear once field scans are recorded for connected farms.</small>
            </div>
          ) : (
            <div className="affected-crops-ranking-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {mostAffected.map((item, idx) => {
                const medal = rankMedals[idx] || `#${idx + 1}`;
                const pct = item.percentage ?? (totalScansCount > 0 ? Math.round((item.cases_count / totalScansCount) * 100) : 0);
                const barColor = idx === 0 ? '#ef4444' : idx === 1 ? '#f59e0b' : idx === 2 ? '#38bdf8' : '#34d399';

                return (
                  <div
                    key={item.crop || idx}
                    className="affected-crop-card"
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '1rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{medal}</span>
                        <div>
                          <strong style={{ fontSize: '0.98rem', color: '#fff', display: 'block' }}>
                            {item.crop}
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            {item.disease_summary || (item.diseases && item.diseases.join(', ')) || 'Pathogen detected'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1rem', color: '#f87171' }}>{pct}%</strong>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.cases_count} {item.cases_count === 1 ? 'case' : 'cases'}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '7px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(5, pct))}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${barColor} 0%, ${barColor}cc 100%)`,
                          borderRadius: '999px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Section */}
        <div className="dashboard-panel side-panel" style={{ background: 'rgba(16, 28, 22, 0.8)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
          <div className="panel-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.85rem' }}>
            <div>
              <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                ⚡ Recent Activity
              </h2>
              <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Chronological ledger from connected agricultural producers
              </p>
            </div>
            <Link
              to="/stakeholder/activity"
              className="panel-link"
              style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              View Full Log →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: '#94a3b8' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
              <span>Loading recent field activity...</span>
            </div>
          ) : recentActivities.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
              <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>No recent activity</strong>
              <small style={{ color: '#64748b' }}>Activity will appear here as field data is recorded.</small>
            </div>
          ) : (
            <div className="activity-timeline-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {recentActivities.slice(0, 6).map((act, i) => {
                const icon = act.icon || (act.type === 'IRRIGATION' ? '💧' : act.type === 'CROP_REC' ? '🌾' : '🔬');
                const badgeColor = act.type === 'IRRIGATION' ? '#38bdf8' : act.type === 'CROP_REC' ? '#fbbf24' : '#34d399';

                return (
                  <div
                    key={act.id || i}
                    className="activity-item-card"
                    style={{
                      display: 'flex',
                      gap: '0.85rem',
                      alignItems: 'flex-start',
                      padding: '0.85rem',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.15rem',
                        flexShrink: 0,
                      }}
                    >
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <strong style={{ fontSize: '0.88rem', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {act.title || (act.crop ? `${act.crop} scan recorded` : 'Field telemetry')}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>
                          {act.timestamp}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                        {act.description}
                      </p>
                      {act.farmer_name && (
                        <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: badgeColor, background: 'rgba(255, 255, 255, 0.04)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                            👨‍🌾 {act.farmer_name}
                          </span>
                          {act.crop && (
                            <span style={{ fontSize: '0.72rem', color: '#cbd5e1', background: 'rgba(255, 255, 255, 0.04)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                              🌱 {act.crop}
                            </span>
                          )}
                        </div>
                      )}
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
