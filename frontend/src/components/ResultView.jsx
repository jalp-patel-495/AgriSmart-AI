import React, { useState } from 'react';
import {
  resolveCrop,
  resolveConfidence,
  isHealthyClass,
  resolvePathogen,
  HEALTHY_MONITORING_PRECAUTIONS
} from '../utils/cropDiseaseResolver';

/**
 * ResultView Component for Field Diagnostic Reporting
 * 
 * Enforces:
 * - Clean, professional, high-tech diagnostic outcome layout
 * - Exact 65% scientific safety gate:
 *   - Under 65%: "⚠️ Low Confidence — Further Inspection Needed", Disease: "Not confidently identified",
 *     crop retained if valid, treatments & pathogens strictly suppressed.
 *   - 65% and above: "✅ High Confidence", verified disease name & treatments displayed.
 * - Out-of-Distribution (OOD) and Image Quality failure states
 * - Separate Detected Crop & Crop Confidence alongside Disease & Disease Confidence
 * - Observable foliar symptoms supported by model data
 * - Compact interactive guidelines / precautions checklist
 * - AI response time when provided by backend
 */
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

  // 1. Analyzing state
  if (isAnalyzing) {
    return (
      <div className="panel-card" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '340px',
        textAlign: 'center',
        padding: '2.5rem 1.5rem'
      }}>
        <div style={{
          fontSize: '3rem',
          animation: 'spin 1.4s linear infinite',
          filter: 'drop-shadow(0 0 16px rgba(52, 211, 153, 0.5))'
        }}>
          🔄
        </div>
        <h3 style={{ marginTop: '1.25rem', color: '#fff', fontSize: '1.25rem', fontWeight: 800 }}>
          Analyzing Leaf...
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.35rem', maxWidth: '340px' }}>
          AI model is processing the specimen.
        </p>
        <div style={{
          marginTop: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          border: '1px solid rgba(52, 211, 153, 0.2)'
        }}>
          <span style={{ color: '#34d399', fontSize: '0.82rem', fontWeight: 600 }}>
            ✓ Image tensor normalization (224×224)
          </span>
          <span style={{ color: '#38bdf8', fontSize: '0.82rem', fontWeight: 600 }}>
            ✓ Computing universal crop & disease probabilities
          </span>
          <span style={{ color: '#fef08a', fontSize: '0.82rem', fontWeight: 600 }}>
            ⚡ Calibrating 65% safety gate threshold
          </span>
        </div>
      </div>
    );
  }

  // 2. Error state
  if (error) {
    return (
      <div className="panel-card" style={{
        minHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '2.5rem 1.5rem'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
        <h3 style={{ color: '#f87171', fontSize: '1.2rem', fontWeight: 700 }}>Diagnostic Request Failed</h3>
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem', maxWidth: '380px', marginTop: '0.4rem', lineHeight: 1.5 }}>
          {error}
        </p>
      </div>
    );
  }

  // 3. Awaiting Leaf Specimen placeholder state
  if (!result) {
    return (
      <div className="result-placeholder-box">
        <div className="placeholder-icon">🌱</div>
        <h4>Awaiting Leaf Specimen</h4>
        <p>
          Upload an image to start AI disease classification.
        </p>
        <div className="feature-bullets">
          <div className="bullet-item">✓ 38 supported disease & healthy classes</div>
          <div className="bullet-item">✓ Separate Crop & Disease confidence calibration</div>
          <div className="bullet-item">✓ Strict 65% safety gate preventing false prescriptions</div>
        </div>
      </div>
    );
  }

  // 4. Resolve states, confidence, and canonical crop
  const isOOD = Boolean(result.is_ood || result.status === 'out_of_distribution' || result.status === 'unsupported');
  const isQualityFail = Boolean(result.quality_ok === false || result.status === 'undetermined');

  const { percentStr, percentNum, isLowConfidence, tier, barColor } = resolveConfidence(result);
  const rawResolvedCrop = resolveCrop(result);
  const resolvedCrop = (isOOD || isQualityFail) ? null : rawResolvedCrop;
  const isHealthy = !isOOD && !isQualityFail && isHealthyClass(result, isLowConfidence);
  const pathogen = (!isOOD && !isQualityFail) ? resolvePathogen(result, isLowConfidence, isHealthy) : null;

  // Crop confidence calculation (separate from disease confidence)
  let cropConfidenceStr = '--';
  if (result.crop_confidence !== undefined && result.crop_confidence !== null) {
    const cc = parseFloat(result.crop_confidence);
    cropConfidenceStr = `${Math.round(cc > 1 ? cc : cc * 100)}%`;
  } else if (resolvedCrop && !isLowConfidence) {
    // If crop is solidly resolved, display calibrated confidence or disease confidence
    cropConfidenceStr = percentStr;
  }

  // Disease confidence calculation
  const diseaseConfidenceStr = result.disease_confidence !== undefined && result.disease_confidence !== null
    ? `${Math.round(parseFloat(result.disease_confidence) * 100)}%`
    : percentStr;

  // Weather Context
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

  // Guidelines compact checklist
  const lowConfidenceChecklist = [
    'Upload a clearer, high-resolution leaf image',
    'Use natural daylight and avoid artificial color cast',
    'Keep the leaf in sharp focus',
    'Avoid blur, glare and harsh shadows',
    'Capture the complete leaf surface',
    'Inspect both upper and lower surfaces where appropriate'
  ];

  // Active precautions determination
  let activePrecautions = [];
  if (isOOD || isQualityFail || isLowConfidence) {
    activePrecautions = lowConfidenceChecklist;
  } else if (isHealthy) {
    activePrecautions = HEALTHY_MONITORING_PRECAUTIONS;
  } else {
    activePrecautions = (result.precautions && result.precautions.length > 0)
      ? result.precautions
      : [
        'Prune and isolate affected foliar branches to curtail spore spread',
        'Improve canopy airflow and sanitize tools between cuts',
        'Avoid overhead sprinkler watering to reduce leaf surface wetness'
      ];
  }

  const handleAssistantClick = () => {
    if (!onNavigateToAssistant) return;
    if (isOOD || isQualityFail || isLowConfidence) {
      onNavigateToAssistant({
        isLowConfidence: true,
        safePrompt: 'The model was unable to confidently identify the disease (<65% confidence). Please provide recommendations on how to capture a clear specimen.',
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
    <div id="diagnostic-report-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top Bar: Field Diagnostic Report Header + Response Time + Export */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.65rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🌿</span>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
            Field Diagnostic Report
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {result.processing_time_ms && (
            <span style={{
              fontSize: '0.75rem',
              color: '#34d399',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.12)',
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              border: '1px solid rgba(52, 211, 153, 0.3)'
            }}>
              ⚡ {result.processing_time_ms} ms
            </span>
          )}
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
            onClick={handlePrintReport}
            title="Export report"
          >
            🖨️ Export PDF
          </button>
        </div>
      </div>

      {/* Safety Status Banner */}
      <div>
        {isOOD ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#fca5a5',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            fontSize: '0.82rem',
            fontWeight: 700
          }}>
            <span>⚠️</span>
            <span>Unsupported / Unknown Specimen</span>
          </div>
        ) : isQualityFail ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#fef08a',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            fontSize: '0.82rem',
            fontWeight: 700
          }}>
            <span>⚠️</span>
            <span>Undetermined — Low Image Quality</span>
          </div>
        ) : isLowConfidence ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#fca5a5',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            fontSize: '0.82rem',
            fontWeight: 700
          }}>
            <span>⚠️</span>
            <span>Low Confidence</span>
          </div>
        ) : isHealthy ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.18)',
            color: '#6ee7b7',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            fontSize: '0.82rem',
            fontWeight: 700
          }}>
            <span>✅</span>
            <span>High Confidence • Healthy Foliage</span>
          </div>
        ) : (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.18)',
            color: '#6ee7b7',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            fontSize: '0.82rem',
            fontWeight: 700
          }}>
            <span>✅</span>
            <span>High Confidence</span>
          </div>
        )}
      </div>

      {/* Primary Key Metrics Grid: Detected Crop | Crop Confidence | Disease | Disease Confidence | Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.65rem',
        background: 'rgba(0, 0, 0, 0.35)',
        padding: '0.85rem 1rem',
        borderRadius: '12px',
        border: '1px solid rgba(52, 211, 153, 0.2)'
      }}>
        {/* Detected Crop */}
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Detected Crop
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: '0.15rem' }}>
            {isOOD ? 'Unsupported / Unknown' : isQualityFail ? 'Undetermined' : (resolvedCrop || result.crop || 'Undetermined')}
          </div>
        </div>

        {/* Crop Confidence */}
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Crop Confidence
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.15rem' }}>
            {isOOD || isQualityFail ? '--' : cropConfidenceStr}
          </div>
        </div>

        {/* Disease */}
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Disease
          </div>
          <div style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: (isOOD || isQualityFail || isLowConfidence) ? '#fca5a5' : isHealthy ? '#6ee7b7' : '#f87171',
            marginTop: '0.15rem'
          }}>
            {(isOOD || isQualityFail || isLowConfidence)
              ? 'Not confidently identified'
              : isHealthy
              ? 'Healthy'
              : (result.disease || 'Detected Condition')}
          </div>
        </div>

        {/* Disease Confidence */}
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Disease Confidence
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: barColor, marginTop: '0.15rem' }}>
            {isOOD || isQualityFail ? '--' : diseaseConfidenceStr}
          </div>
        </div>

        {/* Status */}
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Status
          </div>
          <div style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: (isOOD || isQualityFail || isLowConfidence) ? '#f59e0b' : isHealthy ? '#34d399' : '#ef4444',
            marginTop: '0.15rem'
          }}>
            {isOOD ? 'Unknown' : isQualityFail ? 'Undetermined' : isLowConfidence ? 'Low Confidence' : isHealthy ? 'Healthy' : 'Diseased'}
          </div>
        </div>
      </div>

      {/* Main Condition Heading */}
      <div>
        {isOOD ? (
          <div>
            <h2 style={{ color: '#fca5a5', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
              Unsupported / Unknown Specimen
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              The uploaded image is outside the distribution of supported crop classes.
            </p>
          </div>
        ) : isQualityFail ? (
          <div>
            <h2 style={{ color: '#fca5a5', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
              Undetermined Specimen
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              Image quality metrics are insufficient for reliable feature extraction.
            </p>
          </div>
        ) : isLowConfidence ? (
          <div>
            <h2 style={{ color: '#fca5a5', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
              Low Confidence — Further Inspection Needed
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              Disease: <span style={{ color: '#e2e8f0', fontStyle: 'italic' }}>Not confidently identified</span>
            </p>
          </div>
        ) : isHealthy ? (
          <div>
            <h2 style={{ color: '#34d399', fontSize: '1.45rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
              {resolvedCrop ? `${resolvedCrop} Healthy` : 'Healthy Foliage'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              No infectious foliar pathogens or necrotic lesions detected.
            </p>
          </div>
        ) : (
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.45rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
              {result.disease}
            </h2>
            {resolvedCrop && (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                Foliar pathology identified on <strong style={{ color: '#fff' }}>{resolvedCrop}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Confidence Visualization Bar (Strict 65% Safety Gate) */}
      {!isOOD && !isQualityFail && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>
              Diagnostic Confidence Calibration
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: barColor,
                background: `${barColor}22`,
                border: `1px solid ${barColor}44`,
                padding: '0.15rem 0.5rem',
                borderRadius: '999px'
              }}>
                {tier}
              </span>
              <strong style={{ color: barColor, fontSize: '0.95rem' }}>{percentStr}</strong>
            </div>
          </div>

          <div style={{
            height: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            overflow: 'hidden'
          }}>
            <div
              style={{
                width: `${percentNum}%`,
                height: '100%',
                background: barColor,
                borderRadius: '999px',
                transition: 'width 0.8s ease'
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: '#64748b',
            marginTop: '0.35rem'
          }}>
            <span>0% (Uncertain)</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>65% Safety Gate</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>85%+ (Verified)</span>
          </div>
        </div>
      )}

      {/* Causal Pathogen (High confidence diseased only; strictly suppressed for <65% and healthy) */}
      {!isLowConfidence && !isHealthy && !isOOD && !isQualityFail && pathogen && (
        <div style={{
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
            🔬 Causal Pathogen
          </div>
          <div style={{ fontStyle: 'italic', color: '#f1f5f9', fontSize: '0.9rem' }}>
            {pathogen}
          </div>
        </div>
      )}

      {/* Observable Foliar Symptoms */}
      <div style={{
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
          🔍 Observable Foliar Symptoms
        </div>
        <div style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.5 }}>
          {(isOOD || isQualityFail || isLowConfidence) ? (
            'Unable to determine symptoms with high confidence. Please provide a clearer, well-lit specimen.'
          ) : isHealthy ? (
            'Crisp emerald foliage with uniform color, intact cuticle, and no necrotic pustules or lesions.'
          ) : (
            result.symptoms || 'Visible discoloration and foliar lesion patterns.'
          )}
        </div>
      </div>

      {/* Recommended Precautions & Action Plan / Quality Checklist */}
      <div style={{
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        background: (isLowConfidence || isOOD || isQualityFail) ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)',
        borderLeft: (isLowConfidence || isOOD || isQualityFail) ? '3px solid #ef4444' : '3px solid #10b981',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        borderRight: '1px solid rgba(255, 255, 255, 0.04)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
      }}>
        <div style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: (isLowConfidence || isOOD || isQualityFail) ? '#fca5a5' : '#34d399',
          marginBottom: '0.65rem'
        }}>
          {(isLowConfidence || isOOD || isQualityFail)
            ? '🛡️ Recommended Image Guidelines'
            : '🛡️ Recommended Precautions & Action Plan'}
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activePrecautions.map((precaution, idx) => (
            <li
              key={idx}
              onClick={() => togglePrecaution(idx)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                cursor: 'pointer',
                fontSize: '0.84rem',
                color: checkedPrecautions[idx] ? '#94a3b8' : '#e2e8f0',
                textDecoration: checkedPrecautions[idx] ? 'line-through' : 'none'
              }}
            >
              <input
                type="checkbox"
                checked={!!checkedPrecautions[idx]}
                onChange={() => togglePrecaution(idx)}
                style={{ marginTop: '0.2rem', accentColor: '#10b981', cursor: 'pointer' }}
              />
              <span>{precaution}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Curative Agronomic Treatment (STRICTLY SUPPRESSED FOR <65%, OOD, QUALITY FAIL, AND HEALTHY) */}
      {!isLowConfidence && !isHealthy && !isOOD && !isQualityFail && result.treatment && (
        <div style={{
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          background: 'rgba(59, 130, 246, 0.08)',
          borderLeft: '3px solid #3b82f6',
          borderTop: '1px solid rgba(59, 130, 246, 0.2)',
          borderRight: '1px solid rgba(59, 130, 246, 0.2)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.35rem' }}>
            💊 AI-Powered Curative Treatment Guidance
          </div>
          <div style={{ color: '#dbeafe', fontSize: '0.88rem', lineHeight: 1.55 }}>
            {result.treatment}
          </div>
        </div>
      )}

      {/* Weather Context Card (Only if real weather intelligence exists) */}
      {isWeatherAvailable && (
        <div style={{
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(16, 185, 129, 0.25)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.6rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🌦️</span>
              <div>
                <strong style={{ color: '#fff', fontSize: '0.88rem' }}>Weather Context</strong>
                {weatherData.location && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.4rem' }}>
                    • {weatherData.location}
                  </span>
                )}
              </div>
            </div>
            {onNavigateToWeather && (
              <button
                type="button"
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
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Temperature:</span>
              <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                {weatherTemp != null ? `${Number(weatherTemp).toFixed(1)}°C` : '--'}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Humidity:</span>
              <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                {weatherHumidity != null ? `${Math.round(weatherHumidity)}%` : '--'}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Rain Probability:</span>
              <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                {weatherRainProb != null ? `${Math.round(weatherRainProb)}%` : '--'}
              </strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>Weather Risk:</span>
              <strong style={{ color: getRiskBadgeColor(weatherRisk), fontSize: '0.88rem' }}>
                {weatherRisk || 'LOW'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Alternative Differential Diagnoses (Strictly hidden for <65% confidence, OOD, and healthy) */}
      {!isLowConfidence && !isHealthy && !isOOD && !isQualityFail && result.top_predictions && result.top_predictions.length > 1 && (
        <div style={{ marginTop: '0.25rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Alternative Differential Diagnoses:
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
            {result.top_predictions.slice(1, 4).map((item, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1'
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
        <button
          type="button"
          className="btn-primary"
          style={{
            marginTop: '0.25rem',
            background: 'linear-gradient(135deg, #10b981, #3b82f6)',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
          }}
          onClick={handleAssistantClick}
        >
          💬 Ask AI Assistant About This Diagnostic Result
        </button>
      )}
    </div>
  );
}
