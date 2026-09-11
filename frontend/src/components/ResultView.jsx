import React from 'react';

export default function ResultView({ result, isAnalyzing }) {
  if (isAnalyzing) {
    return (
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '340px' }}>
        <div style={{ fontSize: '2.5rem', animation: 'spin 1.5s linear infinite' }}>⚙️</div>
        <h4 style={{ marginTop: '1rem', color: '#fff' }}>Extracting Deep Visual Features...</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Scanning leaf chlorosis, lesion patterns, and cellular pustules
        </p>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '340px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', opacity: 0.4 }}>📋</div>
        <h4 style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>Awaiting Crop Inspection</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '300px', marginTop: '0.35rem' }}>
          Upload a crop leaf photograph on the left to view immediate disease diagnosis, pathogen info, and advisory.
        </p>
      </div>
    );
  }

  const { prediction, processing_time_ms } = result;
  const isHealthy = prediction.status === 'Healthy';
  const confidencePercent = (prediction.confidence * 100).toFixed(1);

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">🌿 Diagnostic Report</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Speed: {processing_time_ms}ms
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span className={`result-header-badge ${isHealthy ? 'badge-healthy' : 'badge-diseased'}`}>
          {isHealthy ? '✅ Crop Foliage Healthy' : '⚠️ Disease Condition Detected'}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Crop: <strong style={{ color: '#fff' }}>{prediction.crop}</strong>
        </span>
      </div>

      <h2 className="disease-main-title">{prediction.disease}</h2>

      {/* Confidence Meter */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Diagnostic Confidence:</span>
          <span style={{ color: 'var(--text-emerald)', fontWeight: 'bold' }}>{confidencePercent}%</span>
        </div>
        <div className="confidence-bar-container">
          <div
            className="confidence-bar-fill"
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
      </div>

      {/* Pathogen */}
      {prediction.pathogen && prediction.pathogen !== 'None' && (
        <div className="result-section">
          <div className="section-label">Causal Pathogen</div>
          <div className="section-body" style={{ fontStyle: 'italic' }}>{prediction.pathogen}</div>
        </div>
      )}

      {/* Symptoms */}
      {prediction.symptoms && (
        <div className="result-section">
          <div className="section-label">Observable Symptoms</div>
          <div className="section-body">{prediction.symptoms}</div>
        </div>
      )}

      {/* Treatment Advice */}
      {prediction.treatment && (
        <div className="result-section" style={{ borderLeft: '3px solid var(--primary-500)' }}>
          <div className="section-label" style={{ color: '#6ee7b7' }}>Agronomic & Treatment Advisory</div>
          <div className="section-body" style={{ color: '#d1fae5' }}>{prediction.treatment}</div>
        </div>
      )}
    </div>
  );
}
