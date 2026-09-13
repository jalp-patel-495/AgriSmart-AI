import React, { useState, useEffect } from 'react';
import { authApi } from '../services/authApi';

export default function SystemMonitoringView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMonitoring = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.getSystemMonitoring();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load system monitoring telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoring();
  }, []);

  const modules = data?.modules || [];

  return (
    <div className="system-monitoring-view" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.25), rgba(15, 23, 42, 0.75))',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '16px',
        padding: '1.5rem 2rem',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2rem' }}>🛠️</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#f3e8ff' }}>
              System Health & AI Artifact Monitoring
            </h1>
            <span style={{
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: '#d8b4fe',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Live Hardware & Artifacts
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem' }}>
            Real-time status of loaded neural networks, ensemble estimators, and rule-based diagnostic services. Zero synthetic or simulated metrics.
          </p>
        </div>

        <button
          onClick={fetchMonitoring}
          disabled={loading}
          style={{
            background: 'rgba(168, 85, 247, 0.2)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            color: '#e9d5ff',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🔄</span> {loading ? 'Checking...' : 'Refresh Status'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          padding: '1.25rem',
          borderRadius: '12px',
          marginBottom: '2rem',
        }}>
          <strong>Access / Load Error:</strong> {error}
        </div>
      )}

      {/* Modules Status Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem',
      }}>
        {modules.map((mod, idx) => {
          const isExperimental = mod.badge?.includes('EXPERIMENTAL');
          const isReady = mod.status === 'Ready' || mod.status === 'Active';

          return (
            <div
              key={idx}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: isExperimental
                  ? '1px solid rgba(245, 158, 11, 0.4)'
                  : '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '14px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#f8fafc', fontWeight: 600 }}>
                    {mod.module_name}
                  </h3>
                  <span style={{
                    background: isExperimental
                      ? 'rgba(245, 158, 11, 0.18)'
                      : (isReady ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)'),
                    border: `1px solid ${
                      isExperimental
                        ? 'rgba(245, 158, 11, 0.45)'
                        : (isReady ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)')
                    }`,
                    color: isExperimental
                      ? '#fcd34d'
                      : (isReady ? '#6ee7b7' : '#fca5a5'),
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}>
                    {mod.badge}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isReady ? '#10b981' : '#ef4444',
                    boxShadow: isReady ? '0 0 8px #10b981' : 'none',
                  }} />
                  <span style={{ fontWeight: 600, fontSize: '0.92rem', color: isReady ? '#34d399' : '#f87171' }}>
                    Status: {mod.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                  <strong>Architecture:</strong> {mod.architecture}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                  <strong>Scope / Classes:</strong> {mod.dataset_scope}
                </div>
              </div>

              <div style={{
                marginTop: '1rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: '#64748b',
              }}>
                <div>Artifact: <strong style={{ color: '#cbd5e1' }}>{mod.artifact_file}</strong></div>
                <div>Size: <strong style={{ color: '#cbd5e1' }}>{mod.artifact_size}</strong></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compliance / Integrity Notice */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        borderRadius: '12px',
        padding: '1.25rem',
        fontSize: '0.88rem',
        color: '#94a3b8',
        lineHeight: '1.5',
      }}>
        <strong>System Integrity Verification:</strong> {data?.notes || 'All telemetry is derived directly from live project models and registered services. No synthetic metrics are generated.'}
      </div>
    </div>
  );
}
