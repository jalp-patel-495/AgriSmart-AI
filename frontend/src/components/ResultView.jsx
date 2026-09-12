import React, { useState } from 'react';

export default function ResultView({
  result,
  isAnalyzing,
  error,
  onNavigateToWeather,
  onNavigateToAssistant
}) {
  const [checkedPrecautions, setCheckedPrecautions] = useState({});

  const togglePrecaution = (index) => {
    setCheckedPrecautions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handlePrintReport = () => {
    window.print();
  };

  if (isAnalyzing) {
    return (
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '380px' }}>
        <div style={{ fontSize: '2.8rem', animation: 'spin 1.5s linear infinite' }}>⚙️</div>
        <h4 style={{ marginTop: '1.25rem', color: '#fff', fontSize: '1.2rem' }}>Processing Deep Neural Forward Pass...</h4>
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-emerald)', fontSize: '0.85rem' }}>✓ Decoding image buffer with OpenCV</span>
          <span style={{ color: 'var(--text-emerald)', fontSize: '0.85rem' }}>✓ Standardizing 224×224 tensor normalization</span>
          <span style={{ color: '#60a5fa', fontSize: '0.85rem' }}>⚡ Computing PyTorch class probabilities</span>
        </div>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h3 style={{ marginTop: '0.75rem', color: '#f87171' }}>Diagnostic Failed</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '350px', marginTop: '0.35rem' }}>
          {error}
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '380px', textAlign: 'center' }}>
        <div style={{ fontSize: '3.2rem', opacity: 0.4 }}>📋</div>
        <h4 style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '1.15rem' }}>Awaiting Leaf Inspection</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '320px', marginTop: '0.35rem' }}>
          Upload or capture a leaf photo on the left. The neural network will identify the disease, calculate confidence, and generate treatment steps.
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
        <h3 className="panel-title">🌿 Field Diagnostic Report</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-emerald)', fontWeight: 'bold' }}>
            ⚡ {processing_time_ms} ms
          </span>
          <button
            className="btn-secondary"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
            onClick={handlePrintReport}
            title="Print or save as PDF"
          >
            🖨️ Export PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span className={`result-header-badge ${isHealthy ? 'badge-healthy' : 'badge-diseased'}`}>
          {isHealthy ? '✅ Crop Foliage Healthy' : '⚠️ Pathology Detected'}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Crop: <strong style={{ color: '#fff' }}>{crop}</strong>
        </span>
      </div>

      <h2 className="disease-main-title">{disease}</h2>

      {/* Confidence Gauge */}
      <div style={{ marginTop: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>AI Diagnostic Confidence:</span>
          <span style={{ color: 'var(--text-emerald)', fontWeight: 'bold' }}>{confidencePercent}</span>
        </div>
        <div className="confidence-bar-container">
          <div
            className="confidence-bar-fill"
            style={{ width: confidence_score ? `${confidence_score * 100}%` : confidencePercent }}
          />
        </div>
      </div>

      {/* Pathogen */}
      {pathogen && pathogen !== 'None' && (
        <div className="result-section">
          <div className="section-label">🔬 Causal Pathogen</div>
          <div className="section-body" style={{ fontStyle: 'italic', color: '#f3f4f6' }}>{pathogen}</div>
        </div>
      )}

      {/* Symptoms */}
      {symptoms && (
        <div className="result-section">
          <div className="section-label">🔍 Observable Foliar Symptoms</div>
          <div className="section-body" style={{ color: '#f3f4f6' }}>{symptoms}</div>
        </div>
      )}

      {/* Interactive Precautions Checklist */}
      {precautions && precautions.length > 0 && (
        <div className="result-section" style={{ borderLeft: '3px solid #10b981', background: 'rgba(16, 185, 129, 0.08)' }}>
          <div className="section-label" style={{ color: '#34d399' }}>🛡️ Recommended Precautions & Action Plan</div>
          <ul className="precaution-checklist">
            {precautions.map((precaution, idx) => (
              <li
                key={idx}
                className="precaution-item"
                onClick={() => togglePrecaution(idx)}
              >
                <input
                  type="checkbox"
                  checked={!!checkedPrecautions[idx]}
                  onChange={() => togglePrecaution(idx)}
                  className="precaution-checkbox"
                />
                <span className={`precaution-text ${checkedPrecautions[idx] ? 'checked' : ''}`}>
                  {precaution}
                </span>
              </li>
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

      {/* Phase 7: Agrometeorological Field Risk Warning */}
      {!isHealthy && (
        <div className="result-section weather-alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🌦️</span>
              <div>
                <strong style={{ color: '#fef08a', fontSize: '0.9rem' }}>Weather Alert: High Humidity + Moisture Threat</strong>
                <p style={{ color: '#fef3c7', fontSize: '0.8rem', margin: '0.15rem 0 0 0' }}>
                  Sustained relative humidity and rain accelerate spore dispersal. Suspend overhead sprinklers and intensify canopy scouting.
                </p>
              </div>
            </div>
            {onNavigateToWeather && (
              <button
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderColor: '#f59e0b', color: '#fef08a' }}
                onClick={onNavigateToWeather}
              >
                View Weather Intelligence →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top 3 Alternative Candidates */}
      {top_predictions && top_predictions.length > 1 && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Alternative Differential Diagnoses:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
            {top_predictions.slice(1).map((item, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.55rem',
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

      {/* Consult AI Assistant Action */}
      {onNavigateToAssistant && (
        <div style={{ marginTop: '1.25rem' }}>
          <button
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}
            onClick={onNavigateToAssistant}
          >
            💬 Ask AI Assistant About This Result
          </button>
        </div>
      )}
    </div>
  );
}
