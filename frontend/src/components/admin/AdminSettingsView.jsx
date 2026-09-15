import React, { useState } from 'react';

export default function AdminSettingsView() {
  const [settings, setSettings] = useState({
    confidenceThreshold: 0.65,
    sessionTimeoutMinutes: 120,
    maxUploadSizeMB: 5,
    enableAutoBackups: true,
    expertTriageAutoDispatch: true,
  });

  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      // Validate bounds
      if (settings.confidenceThreshold < 0.3 || settings.confidenceThreshold > 0.95) {
        throw new Error('Confidence threshold must be between 30% (0.30) and 95% (0.95).');
      }
      if (settings.maxUploadSizeMB < 1 || settings.maxUploadSizeMB > 25) {
        throw new Error('Maximum specimen upload size must be between 1 MB and 25 MB.');
      }
      if (settings.sessionTimeoutMinutes < 15 || settings.sessionTimeoutMinutes > 1440) {
        throw new Error('Session timeout must be between 15 and 1440 minutes.');
      }

      // Persist in local configuration state
      localStorage.setItem('agrismart_platform_settings', JSON.stringify(settings));

      setTimeout(() => {
        setSaving(false);
        setFeedback({
          type: 'success',
          message: 'Platform configuration saved successfully.',
        });
        setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
      }, 400);
    } catch (err) {
      setSaving(false);
      setFeedback({
        type: 'error',
        message: err.message || 'Unable to save platform configuration.',
      });
    }
  };

  return (
    <div className="role-page-container admin-settings-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#f87171' }}>System Governance</span>
          <h1 className="page-main-title">⚙️ Platform Configuration</h1>
          <p className="page-desc">
            Configure supported platform settings and operational controls.
          </p>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`role-feedback-banner ${feedback.type}`}
          style={{
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
            borderRadius: '12px',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '840px' }}>
        
        {/* SECTION 1: AI Safety & Confidence */}
        <div
          className="panel-card"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🧠</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              AI Safety & Confidence
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
            Tune softmax probability cutoffs for automated disease classification.
          </p>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.88rem', color: '#e2e8f0', fontWeight: 600 }}>
                AI Confidence Gating Threshold
              </label>
              <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>
                {Math.round(settings.confidenceThreshold * 100)}% ({settings.confidenceThreshold})
              </strong>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.95"
              step="0.01"
              value={settings.confidenceThreshold}
              onChange={(e) => setSettings({ ...settings, confidenceThreshold: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#34d399', cursor: 'pointer' }}
            />
            <small style={{ color: '#cbd5e1', fontSize: '0.78rem', display: 'block', marginTop: '0.4rem' }}>
              Predictions below this threshold require additional review.
            </small>
          </div>
        </div>

        {/* SECTION 2: Security */}
        <div
          className="panel-card"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🔐</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Security
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
            Role-Based Access Control session lifetime and token validation rules.
          </p>

          <div>
            <label style={{ fontSize: '0.88rem', color: '#e2e8f0', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Session Inactivity Timeout (Minutes)
            </label>
            <input
              type="number"
              min="15"
              max="1440"
              value={settings.sessionTimeoutMinutes}
              onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) || 60 })}
              style={{
                width: '100%',
                maxWidth: '240px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.55rem 0.8rem',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <small style={{ color: '#cbd5e1', fontSize: '0.78rem', display: 'block', marginTop: '0.4rem' }}>
              Cryptographically signed session tokens expire if inactive past this duration.
            </small>
          </div>
        </div>

        {/* SECTION 3: Upload Controls */}
        <div
          className="panel-card"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>📁</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Upload Controls
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
            Multipart form boundaries for uploaded field specimen leaf images.
          </p>

          <div>
            <label style={{ fontSize: '0.88rem', color: '#e2e8f0', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Maximum Specimen Image Size (MB)
            </label>
            <input
              type="number"
              min="1"
              max="25"
              value={settings.maxUploadSizeMB}
              onChange={(e) => setSettings({ ...settings, maxUploadSizeMB: parseInt(e.target.value) || 5 })}
              style={{
                width: '100%',
                maxWidth: '240px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.55rem 0.8rem',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <small style={{ color: '#cbd5e1', fontSize: '0.78rem', display: 'block', marginTop: '0.4rem' }}>
              Applies to JPEG, PNG, and WebP specimens on the diagnostic prediction endpoint.
            </small>
          </div>
        </div>

        {/* SECTION 4: Database Backup */}
        <div
          className="panel-card"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>💾</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Database Backup
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
            Automated repository snapshots for diagnostic records and user accounts.
          </p>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.enableAutoBackups}
              onChange={(e) => setSettings({ ...settings, enableAutoBackups: e.target.checked })}
              style={{ width: '18px', height: '18px', marginTop: '0.2rem', accentColor: '#34d399' }}
            />
            <div>
              <strong style={{ color: '#fff', fontSize: '0.95rem', display: 'block' }}>
                Automated Database Snapshots
              </strong>
              <small style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                Maintains rolling snapshots of <code>agrismart.db</code> across system restarts.
              </small>
            </div>
          </label>
        </div>

        {/* SECTION 5: Expert Triage */}
        <div
          className="panel-card"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🔬</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Expert Triage
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
            Routing rules directing field diagnostic records to agronomist review queues.
          </p>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.expertTriageAutoDispatch}
              onChange={(e) => setSettings({ ...settings, expertTriageAutoDispatch: e.target.checked })}
              style={{ width: '18px', height: '18px', marginTop: '0.2rem', accentColor: '#34d399' }}
            />
            <div>
              <strong style={{ color: '#fff', fontSize: '0.95rem', display: 'block' }}>
                Automatic Agronomist Triage Routing
              </strong>
              <small style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                Automatically routes incoming diseased diagnoses scoring below the {Math.round(settings.confidenceThreshold * 100)}% safety threshold directly into the Agricultural Expert review workspace.
              </small>
            </div>
          </label>
        </div>

        {/* Bottom CTA */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
          <button
            type="submit"
            className="btn-primary-action"
            disabled={saving}
            style={{
              background: '#dc2626',
              padding: '0.85rem 2rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {saving ? 'Saving...' : '💾 Save Platform Configurations'}
          </button>
        </div>
      </form>
    </div>
  );
}
