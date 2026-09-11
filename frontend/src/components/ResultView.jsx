import React from 'react';

export default function ResultView({ result, isAnalyzing }) {
  if (isAnalyzing) {
    return (
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '380px' }}>
        <div style={{ fontSize: '2.5rem', animation: 'spin 1.5s linear infinite' }}>⚙️</div>
        <h4 style={{ marginTop: '1rem', color: '#fff' }}>Executing PyTorch Forward Pass...</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          OpenCV preprocessing & deep feature extraction
        </p>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '380px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', opacity: 0.4 }}>📋</div>
        <h4 style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>Awaiting Crop Inspection</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '320px', marginTop: '0.35rem' }}>
          Upload a crop leaf photograph on the left to view real-time disease diagnosis, symptoms, and actionable farmer precautions.
        </p>
      </div>
    );
  }

  const { disease, crop, confidence, confidence_score, status, pathogen, symptoms, precautions, treatment, top_predictions, processing_time_ms } = result;
  const isHealthy = status === 'Healthy';
  const confidencePercent = confidence || `${(confidence_score * 100).toFixed(0)}%`;

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">🌿 Diagnostic Report</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-emerald)', fontWeight: 'bold' }}>
          ⚡ {processing_time_ms} ms
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span className={`result-header-badge ${isHealthy ? 'badge-healthy' : 'badge-diseased'}`}>
          {isHealthy ? '✅ Crop Foliage Healthy' : '⚠️ Pathology Identified'}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Crop: <strong style={{ color: '#fff' }}>{crop}</strong>
        </span>
      </div>

      <h2 className="disease-main-title">{disease}</h2>

      {/* Confidence Meter */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Diagnostic Confidence:</span>
          <span style={{ color: 'var(--text-emerald)', fontWeight: 'bold' }}>{confidencePercent}</span>
        </div>
        <div className="confidence-bar-container">
          <div
            className="confidence-bar-fill"
            style={{ width: confidence_score ? `${confidence_score * 100}%` : confidencePercent }}
          />
        </div>
      </div>

      {/* Symptoms */}
      {symptoms && (
        <div className="result-section">
          <div className="section-label">🔬 Observable Symptoms</div>
          <div className="section-body" style={{ color: '#f3f4f6' }}>{symptoms}</div>
        </div>
      )}

      {/* Precautions List */}
      {precautions && precautions.length > 0 && (
        <div className="result-section" style={{ borderLeft: '3px solid #10b981', background: 'rgba(16, 185, 129, 0.08)' }}>
          <div className="section-label" style={{ color: '#34d399' }}>🛡️ Recommended Precautions & Action Plan</div>
          <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', color: '#e5e7eb', fontSize: '0.9rem', lineHeight: '1.6' }}>
            {precautions.map((precaution, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>{precaution}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Treatment Advice */}
      {treatment && (
        <div className="result-section" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="section-label" style={{ color: '#93c5fd' }}>💊 Curative Agronomic Treatment</div>
          <div className="section-body" style={{ color: '#dbeafe' }}>{treatment}</div>
        </div>
      )}

      {/* Top 3 Alternative Candidates */}
      {top_predictions && top_predictions.length > 1 && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Alternative Candidates:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
            {top_predictions.slice(1).map((item, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)'
                }}
              >
                {item.disease}: <strong style={{ color: '#fff' }}>{item.confidence}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
