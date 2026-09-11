import React from 'react';

export default function Dashboard({ onStartDiagnose, classesData }) {
  const totalClasses = classesData?.length || 13;
  const cropsCovered = new Set(classesData?.map((c) => c.crop) || ['Apple', 'Corn', 'Potato', 'Tomato']).size;
  const healthyClasses = classesData?.filter((c) => c.status === 'Healthy').length || 4;
  const diseasedClasses = totalClasses - healthyClasses;

  return (
    <div>
      <div className="dashboard-header">
        <div className="hero-badge">🌱 AgriSmart AI • Smart Farm Companion</div>
        <h1 className="dashboard-title">Next-Gen Crop Protection & Leaf Diagnostic Intelligence</h1>
        <p className="dashboard-subtitle">
          Accelerating agricultural disease detection with high-resolution computer vision and precision agronomic recommendations.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>🌾</div>
          <div>
            <div className="stat-value">{cropsCovered} Crops</div>
            <div className="stat-label">Staple Crop Varieties</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>🦠</div>
          <div>
            <div className="stat-value">{diseasedClasses} Classes</div>
            <div className="stat-label">Pathogens & Blights</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>🛡️</div>
          <div>
            <div className="stat-value">{healthyClasses} Healthy</div>
            <div className="stat-label">Baseline Controls</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>⚡</div>
          <div>
            <div className="stat-value">224×224</div>
            <div className="stat-label">PyTorch Normalized Res</div>
          </div>
        </div>
      </div>

      {/* Action Banner */}
      <div
        className="panel-card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.05))',
          borderColor: 'rgba(52, 211, 153, 0.3)',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem'
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>Suspect Leaf Disease in Your Field?</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Snap a photo of the affected leaf or drag an image to identify symptoms, pathogens, and curative treatments.
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '0.75rem 1.75rem' }}
          onClick={onStartDiagnose}
        >
          🚀 Launch Disease Detector
        </button>
      </div>

      {/* Disease Classes Directory */}
      <div className="panel-card">
        <div className="panel-header">
          <h3 className="panel-title">📚 Crop Disease Taxonomy & Knowledge Base</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Phase 1 Defined Classes ({totalClasses})
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {classesData?.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.9rem 1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{item.crop}: {item.disease}</strong>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontWeight: 700,
                    backgroundColor: item.status === 'Healthy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: item.status === 'Healthy' ? '#34d399' : '#f87171'
                  }}
                >
                  {item.status}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                {item.symptoms}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
