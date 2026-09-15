import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { roleApi } from '../../services/roleApi';

export default function AdminSystemActivity() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roleApi.getAdminDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load system activity:', err);
      setError('Unable to load operational activity stream.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const rawActivities = stats?.recent_activity || [];

  // Group events by Today, Yesterday, Earlier
  const groupedEvents = useMemo(() => {
    const groups = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    rawActivities.forEach((act) => {
      let targetGroup = 'Today'; // default for recent live entries
      if (act.timestamp && act.timestamp !== 'Recently') {
        const datePart = act.timestamp.split(' ')[0];
        if (datePart === todayStr) {
          targetGroup = 'Today';
        } else if (datePart === yesterdayStr) {
          targetGroup = 'Yesterday';
        } else {
          targetGroup = 'Earlier';
        }
      }
      groups[targetGroup].push(act);
    });

    return groups;
  }, [rawActivities]);

  return (
    <div className="role-page-container admin-activity-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#f87171' }}>Operational Telemetry</span>
          <h1 className="page-main-title">⚡ Platform System Activity Stream</h1>
          <p className="page-desc">
            Operational activity from authentication, AI inference, database transactions, and administrative actions.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#dc2626' }}
            onClick={() => navigate('/admin/reports')}
          >
            📋 View Full Audit Log →
          </button>
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {error}</span>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={fetchActivities}
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3.5rem 0', textAlign: 'center', color: '#94a3b8' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
          <span>Streaming live system events...</span>
        </div>
      ) : rawActivities.length === 0 ? (
        <div
          style={{
            padding: '4rem 1.5rem',
            textAlign: 'center',
            background: 'rgba(16, 28, 22, 0.6)',
            border: '1px dashed rgba(52, 211, 153, 0.25)',
            borderRadius: '16px',
            color: '#94a3b8',
          }}
        >
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.85rem' }}>⚡</span>
          <strong style={{ color: '#e2e8f0', fontSize: '1.2rem', display: 'block', marginBottom: '0.35rem' }}>
            ⚡ No recent system activity
          </strong>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            Platform events will appear here when system activity is recorded.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Object.entries(groupedEvents).map(([groupName, events]) => {
            if (events.length === 0) return null;
            return (
              <div key={groupName}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f87171' }}>
                    {groupName}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{events.length} events</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
                  {events.map((act, idx) => {
                    const eventType = act.type === 'diagnosis' ? 'AI INFERENCE' : (act.type === 'user' ? 'USER PROVISIONING' : 'PLATFORM ACTION');
                    const statusVal = act.status || 'Completed';
                    const isFailed = statusVal.toLowerCase().includes('fail') || statusVal.toLowerCase().includes('error');
                    const isHealthy = statusVal.toLowerCase().includes('healthy') || statusVal.toLowerCase().includes('active') || statusVal.toLowerCase().includes('success') || statusVal.toLowerCase().includes('completed');

                    return (
                      <div
                        key={idx}
                        className="activity-card"
                        style={{
                          background: 'rgba(16, 28, 22, 0.8)',
                          border: '1px solid rgba(52, 211, 153, 0.2)',
                          borderRadius: '14px',
                          padding: '1.25rem',
                          backdropFilter: 'blur(12px)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          transition: 'transform 0.15s ease, border-color 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: act.type === 'diagnosis' ? '#34d399' : '#38bdf8', letterSpacing: '0.04em' }}>
                              ⚡ {eventType}
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
                              ● {statusVal}
                            </span>
                          </div>

                          <strong style={{ color: '#fff', fontSize: '0.95rem', display: 'block', lineHeight: 1.35, marginBottom: '0.35rem' }}>
                            {act.title}
                          </strong>

                          <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                            Actor: <strong style={{ color: '#f8fafc' }}>{act.description}</strong>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                          <span>{act.timestamp}</span>
                          <span style={{ color: '#38bdf8' }}>Verified Stream</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
