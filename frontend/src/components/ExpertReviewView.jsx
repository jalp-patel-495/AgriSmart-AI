import React, { useState, useEffect } from 'react';
import { authApi } from '../services/authApi';

export default function ExpertReviewView({ currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.getExpertReviewData();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load Expert Review telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReview();
  }, []);

  const results = data?.results || {};

  return (
    <div className="expert-review-view" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.25))',
        border: '1px solid rgba(16, 185, 129, 0.3)',
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
            <span style={{ fontSize: '2rem' }}>👨‍🔬</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#ecfdf5' }}>
              Agricultural Expert Review
            </h1>
            <span style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#93c5fd',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Certified Review Mode
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem' }}>
            Centralized agrometeorological verification portal. Review live field observations, diagnostic outcomes, and advisor directives without altering model parameters or farmer records.
          </p>
        </div>

        <button
          onClick={fetchReview}
          disabled={loading}
          style={{
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#a7f3d0',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🔄</span> {loading ? 'Refreshing...' : 'Refresh Telemetry'}
        </button>
      </div>

      {/* Safety & Compliance Disclaimer Card */}
      <div style={{
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
      }}>
        <span style={{ fontSize: '1.4rem' }}>🛡️</span>
        <div style={{ fontSize: '0.88rem', color: '#fde68a' }}>
          <strong>Expert Read-Only Verification Protocol:</strong> Experts are permitted to evaluate multi-subsystem telemetry and validate diagnostic outcomes. In accordance with safety protocol, direct modification of farmer inputs, model weights, or system configurations is restricted.
        </div>
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

      {/* Grid of Results */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem',
      }}>
        {/* Crop Profile */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span>🌾</span>
            <h3 style={cardTitleStyle}>Target Crop</h3>
          </div>
          <div style={cardValueStyle}>{results.crop || 'Data unavailable'}</div>
          <div style={cardSubStyle}>Verified current crop under evaluation</div>
        </div>

        {/* Disease Detection */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span>🌿</span>
            <h3 style={cardTitleStyle}>Disease Detection</h3>
          </div>
          <div style={cardValueStyle}>{results.disease || 'Data unavailable'}</div>
          <div style={cardSubStyle}>
            Confidence: <strong style={{ color: '#6ee7b7' }}>{results.confidence || 'Data unavailable'}</strong>
          </div>
        </div>

        {/* Crop Recommendation */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span>🌱</span>
            <h3 style={cardTitleStyle}>Crop Recommendation</h3>
          </div>
          <div style={cardValueStyle}>{results.crop_recommendation || 'Data unavailable'}</div>
          <div style={cardSubStyle}>Production soil & climate match</div>
        </div>

        {/* Smart Irrigation */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span>💧</span>
            <h3 style={cardTitleStyle}>Smart Irrigation</h3>
          </div>
          <div style={cardValueStyle}>
            <span style={{
              color: results.smart_irrigation === 'YES' ? '#fbbf24' : (results.smart_irrigation === 'NO' ? '#34d399' : 'inherit'),
              fontWeight: 700,
            }}>
              {results.smart_irrigation || 'Data unavailable'}
            </span>
          </div>
          <div style={cardSubStyle}>
            Soil Moisture: {results.soil_moisture || 'Data unavailable'}
          </div>
        </div>

        {/* Weather Risk */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span>🌦️</span>
            <h3 style={cardTitleStyle}>Weather Risk</h3>
          </div>
          <div style={cardValueStyle}>
            <span style={{
              color: results.weather_risk === 'HIGH' ? '#f87171' : (results.weather_risk === 'LOW' ? '#34d399' : '#fbbf24'),
              fontWeight: 700,
            }}>
              {results.weather_risk || 'Data unavailable'}
            </span>
          </div>
          <div style={cardSubStyle}>
            {results.weather_condition || 'Data unavailable'} • {results.temperature || ''}
          </div>
        </div>

        {/* Sustainability Score */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span>🌍</span>
            <h3 style={cardTitleStyle}>Sustainability Score</h3>
          </div>
          <div style={cardValueStyle}>
            <span style={{ color: '#6ee7b7', fontWeight: 700 }}>
              {results.sustainability_score || 'Data unavailable'}
            </span>
          </div>
          <div style={cardSubStyle}>Water efficiency + Resource use + Crop health</div>
        </div>

        {/* Yield Prediction */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span>⚖️</span>
            <h3 style={cardTitleStyle}>Yield Prediction</h3>
          </div>
          <div style={cardValueStyle}>{results.yield_prediction || 'Data unavailable'}</div>
          <div style={cardSubStyle}>Estimated production per hectare</div>
        </div>

        {/* Agentic Advisor Overall Priority */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span>🤖</span>
            <h3 style={cardTitleStyle}>Agentic Advisor</h3>
          </div>
          <div style={cardValueStyle}>
            <span style={{
              color: results.agentic_advisor_priority === 'CRITICAL' ? '#f87171' : (results.agentic_advisor_priority === 'HIGH' ? '#fb923c' : '#34d399'),
              fontWeight: 700,
            }}>
              {results.agentic_advisor_priority || 'Data unavailable'}
            </span>
          </div>
          <div style={cardSubStyle}>
            Synthesized multi-module urgency level
          </div>
        </div>
      </div>

      {/* Recommended Action Summary Box */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: '16px',
        padding: '1.75rem',
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: '#a7f3d0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📋</span> Recommended Action for Extension Verification
        </h3>
        <p style={{
          margin: '0 0 1rem 0',
          color: '#e2e8f0',
          fontSize: '1.05rem',
          lineHeight: '1.6',
          background: 'rgba(2, 44, 34, 0.4)',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          borderLeft: '4px solid #10b981',
        }}>
          {results.recommended_action || 'Data unavailable'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          <div>Review Timestamp: <strong>{data?.review_timestamp || 'Active'}</strong></div>
          <div>Reviewing Officer: <strong>{currentUser?.full_name || 'Agricultural Expert'}</strong> ({currentUser?.email})</div>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'rgba(15, 23, 42, 0.6)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  borderRadius: '12px',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const cardHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.75rem',
};

const cardTitleStyle = {
  margin: 0,
  fontSize: '0.92rem',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const cardValueStyle = {
  fontSize: '1.4rem',
  fontWeight: 700,
  color: '#f8fafc',
  marginBottom: '0.5rem',
};

const cardSubStyle = {
  fontSize: '0.82rem',
  color: '#64748b',
};
