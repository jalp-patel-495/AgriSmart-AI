import React, { useState } from 'react';
import {
  resolveCrop,
  resolveConfidence,
  isHealthyClass,
  resolvePathogen,
  SAFE_LOW_CONFIDENCE_PRECAUTIONS,
  HEALTHY_MONITORING_PRECAUTIONS
} from '../utils/cropDiseaseResolver';

export default function ResultView({
  result,
  isAnalyzing,
  error,
  weatherData,
  onNavigateToWeather,
  onNavigateToAssistant,
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
          Upload or capture a leaf photo on the left. The neural network will inspect foliar patterns, evaluate confidence thresholds, and generate safety-gated field recommendations.
        </p>
      </div>
    );
  }

  // Resolve scientific safety thresholds and canonical crop mapping
  const { percentStr, percentNum, isLowConfidence, tier, barColor } = resolveConfidence(result);
  const resolvedCrop = resolveCrop(result);
  const isHealthy = isHealthyClass(result, isLowConfidence);
  const pathogen = resolvePathogen(result, isLowConfidence, isHealthy);

  // Weather data extraction (real API values only)
  const isWeatherAvailable = Boolean(
    weatherData &&
    (weatherData.weather || typeof weatherData.temperature === 'number' || typeof weatherData.weather?.temperature === 'number')
  );
  const weatherTemp = weatherData?.weather?.temperature ?? weatherData?.temperature;
  const weatherHumidity = weatherData?.weather?.humidity ?? weatherData?.humidity;
  const weatherRainProb = weatherData?.weather?.rain_probability ?? weatherData?.weather?.precipitation_probability ?? weatherData?.rain_probability;
  const weatherRisk = weatherData?.weather_risk || (weatherHumidity > 80 ? 'HIGH' : weatherHumidity > 60 ? 'MEDIUM' : 'LOW');

  const getRiskBadgeColor = (risk) => {
    switch (String(risk).toUpperCase()) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#f59e0b';
      default: return '#10b981';
    }
  };

  // Determine precautions array based on state
  let activePrecautions = [];
  if (isLowConfidence) {
    activePrecautions = SAFE_LOW_CONFIDENCE_PRECAUTIONS;
  } else if (isHealthy) {
    activePrecautions = HEALTHY_MONITORING_PRECAUTIONS;
  } else {
    activePrecautions = result.precautions && result.precautions.length > 0 ? result.precautions : [
      'Remove affected foliage to prevent spore proliferation',
      'Improve canopy ventilation and sanitize pruning tools',
      'Avoid overhead sprinkler irrigation to minimize leaf wetness duration'
    ];
  }

  const handleAssistantClick = () => {
    if (!onNavigateToAssistant) return;
    if (isLowConfidence) {
      onNavigateToAssistant({
        isLowConfidence: true,
        safePrompt: 'The model was unable to confidently identify the disease. Please upload a clearer image.',
        crop: resolvedCrop || 'Undetermined'
      });
    } else {
      onNavigateToAssistant({
        isLowConfidence: false,
        crop: resolvedCrop || result.crop,
        disease: isHealthy ? 'Healthy' : result.disease
      });
    }
  };

  return (
    <div className="panel-card" id="diagnostic-report-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <h3 className="panel-title">🌿 Field Diagnostic Report</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {result.processing_time_ms && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-emerald)', fontWeight: 'bold' }}>
              ⚡ {result.processing_time_ms} ms
            </span>
          )}
          <button
            className="btn-secondary"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
            onClick={handlePrintReport}
            title="Print or save verified PDF report"
          >
            🖨️ Export PDF
          </button>
        </div>
      </div>

      {/* State Badge & Crop Resolution */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        {isLowConfidence ? (
          <span
            className="result-header-badge"
            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.35)' }}
          >
            ⚠️ Low Confidence
          </span>
        ) : isHealthy ? (
          <span
            className="result-header-badge"
            style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.35)' }}
          >
            🟢 Healthy Crop
          </span>
        ) : (
          <span
            className="result-header-badge"
            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.35)' }}
          >
            🌿 Pathology Detected
          </span>
        )}

        {/* Crop Information: "Possible Crop" for <65%, "Crop" for >=65%, "Undetermined" only if unmapped */}
        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          {isLowConfidence ? (
            resolvedCrop ? (
              <>Possible Crop: <strong style={{ color: '#fef08a' }}>{resolvedCrop}</strong></>
            ) : (
              <>Crop: <strong style={{ color: '#9ca3af' }}>Undetermined</strong></>
            )
          ) : (
            <>Crop: <strong style={{ color: '#fff' }}>{resolvedCrop || result.crop || 'Undetermined'}</strong></>
          )}
        </span>
      </div>

      {/* Main Condition Heading */}
      {isLowConfidence ? (
        <div style={{ marginTop: '0.65rem' }}>
          <h2 className="disease-main-title" style={{ color: '#fca5a5', fontSize: '1.4rem' }}>
            Low Confidence — Further Inspection Needed
          </h2>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.2rem' }}>
            Disease: <span style={{ fontStyle: 'italic', color: '#d1d5db' }}>Not confidently identified</span>
          </div>
        </div>
      ) : isHealthy ? (
        <div style={{ marginTop: '0.65rem' }}>
          <h2 className="disease-main-title" style={{ color: '#34d399', fontSize: '1.5rem' }}>
            {resolvedCrop ? `${resolvedCrop} Healthy` : 'Healthy Foliage'}
          </h2>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.2rem' }}>
            Result: <strong style={{ color: '#6ee7b7' }}>Healthy</strong>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '0.65rem' }}>
          <h2 className="disease-main-title">
            {result.disease}
          </h2>
        </div>
      )}

      {/* Improved Confidence Visualization (Safety Gate at 65%) */}
      <div style={{ marginTop: '1rem', padding: '0.75rem 0.85rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>AI Diagnostic Confidence:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                fontWeight: 600,
                color: barColor,
                background: `${barColor}22`,
                border: `1px solid ${barColor}44`,
              }}
            >
              {tier}
            </span>
            <strong style={{ color: barColor, fontSize: '0.95rem' }}>{percentStr}</strong>
          </div>
        </div>
        <div className="confidence-bar-container" style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)' }}>
          <div
            className="confidence-bar-fill"
            style={{
              width: `${percentNum}%`,
              background: barColor,
              transition: 'width 0.6s ease'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          <span>0% (Low)</span>
          <span style={{ color: '#f59e0b' }}>65% Safety Gate</span>
          <span style={{ color: '#10b981' }}>85%+ (High)</span>
        </div>
      </div>

      {/* Causal Pathogen (High confidence diseased only; strictly suppressed for <65% and healthy) */}
      {!isLowConfidence && !isHealthy && (
        <div className="result-section">
          <div className="section-label">🔬 Causal Pathogen</div>
          <div className="section-body" style={{ fontStyle: 'italic', color: '#f3f4f6' }}>
            {pathogen}
          </div>
        </div>
      )}

      {/* Observable Symptoms */}
      <div className="result-section">
        <div className="section-label">🔍 Observable Foliar Symptoms</div>
        <div className="section-body" style={{ color: '#f3f4f6' }}>
          {isLowConfidence ? (
            'Unable to determine symptoms with high confidence. Please provide a clearer, well-lit specimen.'
          ) : isHealthy ? (
            'Crisp emerald foliage with uniform color, intact cuticle, and no necrotic pustules or lesions.'
          ) : (
            result.symptoms || 'Visible discoloration and foliar lesion patterns.'
          )}
        </div>
      </div>

      {/* Recommended Precautions & Action Plan */}
      <div
        className="result-section"
        style={{
          borderLeft: isLowConfidence ? '3px solid #ef4444' : '3px solid #10b981',
          background: isLowConfidence ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)'
        }}
      >
        <div
          className="section-label"
          style={{ color: isLowConfidence ? '#fca5a5' : '#34d399' }}
        >
          {isLowConfidence ? '🛡️ Recommended Precautions & Image Guidelines' : '🛡️ Recommended Precautions & Action Plan'}
        </div>
        <ul className="precaution-checklist">
          {activePrecautions.map((precaution, idx) => (
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

      {/* Curative Agronomic Treatment (Strictly suppressed for <65% and healthy) */}
      {!isLowConfidence && !isHealthy && result.treatment && (
        <div className="result-section" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="section-label" style={{ color: '#93c5fd' }}>💊 Curative Agronomic Treatment</div>
          <div className="section-body" style={{ color: '#dbeafe' }}>{result.treatment}</div>
        </div>
      )}

      {/* Weather Context Card (Real Weather Intelligence data ONLY; never fake/hardcoded) */}
      {isWeatherAvailable && (
        <div
          className="result-section weather-context-card"
          style={{
            marginTop: '1rem',
            padding: '0.85rem 1rem',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🌦️</span>
              <div>
                <strong style={{ color: '#fff', fontSize: '0.88rem' }}>Weather Context</strong>
                {weatherData.location && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                    • {weatherData.location}
                  </span>
                )}
              </div>
            </div>
            {onNavigateToWeather && (
              <button
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#a7f3d0' }}
                onClick={onNavigateToWeather}
              >
                View Weather Intelligence →
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Temperature:</span>
              <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                {weatherTemp != null ? `${Number(weatherTemp).toFixed(1)}°C` : '--'}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Humidity:</span>
              <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                {weatherHumidity != null ? `${Math.round(weatherHumidity)}%` : '--'}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Rain Probability:</span>
              <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                {weatherRainProb != null ? `${Math.round(weatherRainProb)}%` : '--'}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Weather Risk:</span>
              <strong style={{ color: getRiskBadgeColor(weatherRisk), fontSize: '0.88rem' }}>
                {weatherRisk || 'LOW'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Alternative Differential Diagnoses (STRICTLY HIDDEN for <65% confidence and healthy) */}
      {!isLowConfidence && !isHealthy && result.top_predictions && result.top_predictions.length > 1 && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Alternative Differential Diagnoses:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
            {result.top_predictions.slice(1).map((item, idx) => (
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

      {/* Consult AI Assistant Action (Passes safe prompt on low confidence) */}
      {onNavigateToAssistant && (
        <div style={{ marginTop: '1.25rem' }}>
          <button
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}
            onClick={handleAssistantClick}
          >
            💬 Ask AI Assistant About This Result
          </button>
        </div>
      )}
    </div>
  );
}
