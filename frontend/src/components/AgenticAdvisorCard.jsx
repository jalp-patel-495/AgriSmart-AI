import React from 'react';

export default function AgenticAdvisorCard({ advisorData, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="panel-card" style={{ padding: '1.5rem', marginBottom: 0, border: '1px solid rgba(52, 211, 153, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem', animation: 'spin 2s linear infinite' }}>⚙️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>🤖 Agentic Advisor Synthesizing Field Intelligence...</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cross-checking disease, irrigation, weather, and sustainability outputs</span>
          </div>
        </div>
      </div>
    );
  }

  if (!advisorData) {
    return null;
  }

  const { priority, summary, situation, actions, evidence, missing_data, safety_note } = advisorData;

  const getPriorityStyle = (prio) => {
    switch (prio) {
      case 'CRITICAL':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          border: '#ef4444',
          text: '#f87171',
          glow: 'rgba(239, 68, 68, 0.4)',
          icon: '🚨',
        };
      case 'HIGH':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: '#f59e0b',
          text: '#fbbf24',
          glow: 'rgba(245, 158, 11, 0.4)',
          icon: '⚠️',
        };
      case 'MEDIUM':
        return {
          bg: 'rgba(234, 179, 8, 0.15)',
          border: '#eab308',
          text: '#facc15',
          glow: 'rgba(234, 179, 8, 0.3)',
          icon: '⚡',
        };
      case 'LOW':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          border: '#10b981',
          text: '#34d399',
          glow: 'rgba(16, 185, 129, 0.3)',
          icon: '✅',
        };
      default:
        return {
          bg: 'rgba(100, 116, 139, 0.15)',
          border: '#64748b',
          text: '#94a3b8',
          glow: 'rgba(100, 116, 139, 0.3)',
          icon: 'ℹ️',
        };
    }
  };

  const pStyle = getPriorityStyle(priority);

  const getActionIcon = (source, actionText) => {
    const s = (source || '').toLowerCase();
    const a = (actionText || '').toLowerCase();
    if (s.includes('disease') || a.includes('plant') || a.includes('leaf')) return '🌿';
    if (s.includes('irrigation') && s.includes('weather')) return '🌦️';
    if (s.includes('irrigation') || a.includes('moisture') || a.includes('water')) return '💧';
    if (s.includes('weather') || a.includes('forecast') || a.includes('rain')) return '🌦️';
    if (s.includes('sustainability') || a.includes('resource')) return '🌱';
    return '📌';
  };

  return (
    <div
      className="panel-card"
      id="agentic-advisor-card"
      style={{
        padding: '1.75rem',
        marginBottom: 0,
        background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.06) 0%, rgba(15, 23, 42, 0.75) 100%)',
        border: `1px solid ${pStyle.border}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: `0 8px 30px ${pStyle.glow}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient badge glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '140px',
          height: '140px',
          background: pStyle.bg,
          filter: 'blur(45px)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🤖</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                Agentic Advisor
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(96, 165, 250, 0.3)',
                }}
              >
                🤖 Decision Support
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Deterministic synthesis of Disease, Irrigation, Weather, Yield & Sustainability telemetry
            </span>
          </div>
        </div>

        {/* Priority Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '999px',
              background: pStyle.bg,
              border: `1px solid ${pStyle.border}`,
              color: pStyle.text,
              fontWeight: 800,
              fontSize: '0.85rem',
              letterSpacing: '0.04em',
            }}
          >
            <span>{pStyle.icon}</span>
            <span>PRIORITY: {priority}</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
              title="Refresh advisor evaluation"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* Current Situation Banner */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.2rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          Current Situation:
        </div>
        <p style={{ margin: '0 0 0.85rem 0', color: '#f1f5f9', fontSize: '0.94rem', lineHeight: '1.5', fontWeight: 500 }}>
          {summary}
        </p>

        {situation && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.65rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Target Crop</span>
              <strong style={{ color: '#fff', fontSize: '0.82rem' }}>{situation.crop}</strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.65rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Disease Status</span>
              <strong style={{ color: situation.disease_status.includes('Healthy') ? '#34d399' : (situation.disease_status === 'Data unavailable' ? '#94a3b8' : '#fbbf24'), fontSize: '0.82rem' }}>
                {situation.disease_status}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.65rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Irrigation Status</span>
              <strong style={{ color: situation.irrigation_status.includes('Required') ? '#60a5fa' : '#34d399', fontSize: '0.82rem' }}>
                {situation.irrigation_status}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.65rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Weather Risk</span>
              <strong style={{ color: situation.weather_risk.includes('High') ? '#f87171' : '#cbd5e1', fontSize: '0.82rem' }}>
                {situation.weather_risk}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.65rem', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Sustainability</span>
              <strong style={{ color: '#34d399', fontSize: '0.82rem' }}>{situation.sustainability}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Recommended Actions Section */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '0.88rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span>📋</span> Recommended Actions ({actions ? actions.length : 0})
        </h4>

        {actions && actions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {actions.map((act) => {
              const icon = getActionIcon(act.source, act.action);
              return (
                <div
                  key={act.priority}
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderLeft: `4px solid ${act.priority === 1 ? pStyle.border : '#10b981'}`,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: act.priority === 1 ? pStyle.bg : 'rgba(16, 185, 129, 0.15)',
                          color: act.priority === 1 ? pStyle.text : '#34d399',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                        }}
                      >
                        {act.priority}
                      </span>
                      <strong style={{ color: '#fff', fontSize: '0.94rem' }}>
                        {icon} {act.action}
                      </strong>
                    </div>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      Source: <strong>{act.source}</strong>
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', paddingLeft: '2rem' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>Reason: </span>
                    {act.reason}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No urgent actions indicated. Farm telemetry is within optimal operating ranges.
          </div>
        )}
      </div>

      {/* Evidence and Missing Data Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {/* Evidence */}
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#34d399', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>
            Supporting Evidence ({evidence?.length || 0}):
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {evidence && evidence.length > 0 ? (
              evidence.map((mod, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.73rem',
                    color: '#a7f3d0',
                    background: 'rgba(16, 185, 129, 0.15)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  ✓ {mod}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None recorded</span>
            )}
          </div>
        </div>

        {/* Missing Data */}
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(100, 116, 139, 0.05)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>
            Missing Telemetry ({missing_data?.length || 0}):
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {missing_data && missing_data.length > 0 ? (
              missing_data.map((mod, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.73rem',
                    color: '#94a3b8',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  - {mod}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#34d399' }}>All 6 modules integrated</span>
            )}
          </div>
        </div>
      </div>

      {/* Safety Disclaimer Footer */}
      <div
        style={{
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.74rem',
          color: '#94a3b8',
        }}
      >
        <span>
          🛡️ {safety_note || 'This advisor combines existing AI outputs. It does not replace professional agricultural advice.'}
        </span>
        <span style={{ color: '#64748b' }}>
          SIH Deterministic Layer v1.0
        </span>
      </div>
    </div>
  );
}
