import React, { useState, useEffect } from 'react';
import { authApi } from '../../services/authApi';

export default function FarmerDetailModal({ farmer, onClose, onDisconnect }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('overview'); // overview, health, irrigation, recommendations, weather
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!farmer?.farmer_id) return;
    let isMounted = true;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await authApi.getFarmerAgriculturalProfile(farmer.farmer_id);
        if (isMounted) {
          setProfile(data);
        }
      } catch (err) {
        console.error('Failed to load farmer profile:', err);
        if (isMounted) {
          setError(err.message || 'Unable to retrieve farm agricultural records.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [farmer?.farmer_id]);

  const handleDisconnect = async () => {
    if (!farmer?.connection_id) return;
    setDisconnecting(true);
    try {
      await authApi.removeFarmerConnection(farmer.connection_id);
      if (onDisconnect) {
        onDisconnect(farmer.connection_id);
      }
      onClose();
    } catch (err) {
      alert(`Failed to disconnect: ${err.message}`);
      setDisconnecting(false);
    }
  };

  const getRiskBadgeColor = (risk) => {
    switch ((risk || '').toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5' };
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.2)', border: '#f97316', text: '#fdba74' };
      case 'MODERATE':
        return { bg: 'rgba(234, 179, 8, 0.2)', border: '#eab308', text: '#fde047' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.2)', border: '#10b981', text: '#6ee7b7' };
    }
  };

  const riskColors = getRiskBadgeColor(profile?.overall_risk_level || farmer?.risk_level);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
              }}
            >
              👨‍🌾
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: '#f8fafc' }}>
                  {farmer.farmer_name}
                </h2>
                <span
                  style={{
                    backgroundColor: riskColors.bg,
                    border: `1px solid ${riskColors.border}`,
                    color: riskColors.text,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                  }}
                >
                  {profile?.overall_risk_level || farmer.risk_level || 'LOW'} Risk
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                <span>🏡 {farmer.farm_name || 'Primary Farm Holding'}</span>
                <span style={{ margin: '0 0.5rem' }}>•</span>
                <span>📍 {farmer.location || 'Location Not Specified'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.4rem',
                cursor: 'pointer',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Subtab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.75rem',
            background: 'rgba(15, 23, 42, 0.6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'overview', label: '📊 Farm Overview' },
            { id: 'health', label: `🌱 Disease Records (${profile?.disease_diagnoses?.length || 0})` },
            { id: 'irrigation', label: `💧 Irrigation Logs (${profile?.irrigation_history?.length || 0})` },
            { id: 'recommendations', label: `🌾 Crop Recommendations (${profile?.crop_recommendations?.length || 0})` },
            { id: 'weather', label: '🌦️ Live Micro-Climate' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                background: activeSubTab === tab.id ? 'rgba(14, 165, 233, 0.25)' : 'transparent',
                border: activeSubTab === tab.id ? '1px solid rgba(14, 165, 233, 0.6)' : '1px solid transparent',
                color: activeSubTab === tab.id ? '#38bdf8' : '#94a3b8',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🔄</div>
              <div>Retrieving verified telemetry for {farmer.farmer_name}...</div>
            </div>
          ) : error ? (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '12px',
                padding: '1.25rem',
                color: '#fca5a5',
              }}
            >
              <strong>Error Loading Telemetry:</strong> {error}
            </div>
          ) : !profile ? null : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeSubTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Quick KPI grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '1rem',
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '1rem',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        Monitored Acreage
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>
                        {profile.total_acreage_ha > 0 ? `${profile.total_acreage_ha} ha` : '0.0 ha'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Based on logged field zones
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '1rem',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        Soil Classification
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.25rem' }}>
                        {profile.soil_type || 'Clay Loam'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Profile registered soil type
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '1rem',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        Indicative Sustainability
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', marginTop: '0.25rem' }}>
                        {profile.sustainability_score}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Water & soil stewardship
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '1rem',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        Forecasted Yield
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.25rem' }}>
                        {profile.yield_forecast_t_ha} t/ha
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        ML estimated harvest index
                      </div>
                    </div>
                  </div>

                  {/* Profile Metadata */}
                  <div
                    style={{
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', color: '#38bdf8' }}>
                      📋 Stakeholder Federation Details
                    </h4>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '1rem',
                        fontSize: '0.88rem',
                      }}
                    >
                      <div>
                        <span style={{ color: '#94a3b8' }}>Contact Email:</span>{' '}
                        <span style={{ color: '#f8fafc' }}>{profile.email}</span>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Contact Phone:</span>{' '}
                        <span style={{ color: '#f8fafc' }}>{profile.phone_number || 'Not provided'}</span>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Preferred Crops:</span>{' '}
                        <span style={{ color: '#34d399', fontWeight: 500 }}>
                          {profile.preferred_crop || 'Multi-crop / Unspecified'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Connection Established:</span>{' '}
                        <span style={{ color: '#f8fafc' }}>
                          {profile.connection_date
                            ? new Date(profile.connection_date).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                      {profile.connection_notes && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: '#94a3b8' }}>Federation Notes:</span>{' '}
                          <span style={{ color: '#e2e8f0', fontStyle: 'italic' }}>
                            "{profile.connection_notes}"
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary of Telemetry Records */}
                  <div
                    style={{
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#38bdf8' }}>
                      📡 Available Telemetry Datasets
                    </h4>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                      <div>
                        🔬 <strong>{profile.disease_diagnoses?.length || 0}</strong> Field Disease Detections
                      </div>
                      <div>
                        💧 <strong>{profile.irrigation_history?.length || 0}</strong> Sensor / Irrigation Logs
                      </div>
                      <div>
                        🌱 <strong>{profile.crop_recommendations?.length || 0}</strong> Crop Recommendations
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DISEASE RECORDS */}
              {activeSubTab === 'health' && (
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#38bdf8' }}>
                    🔬 Verified Field Disease Observations
                  </h4>
                  {(!profile.disease_diagnoses || profile.disease_diagnoses.length === 0) ? (
                    <div
                      style={{
                        padding: '2.5rem',
                        textAlign: 'center',
                        background: 'rgba(30, 41, 59, 0.3)',
                        borderRadius: '12px',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        color: '#94a3b8',
                      }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem' }}>
                        No Disease Records Found
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        This farmer has not yet performed any visual disease diagnoses or all detected crops are healthy.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {profile.disease_diagnoses.map((diag, idx) => {
                        const isHealthy = (diag.status || '').toUpperCase() === 'HEALTHY';
                        return (
                          <div
                            key={idx}
                            style={{
                              background: isHealthy ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                              border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              borderRadius: '12px',
                              padding: '1.1rem',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                                marginBottom: '0.6rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.1rem' }}>{isHealthy ? '✅' : '⚠️'}</span>
                                <span style={{ fontWeight: 600, fontSize: '1rem', color: '#f8fafc' }}>
                                  {diag.crop} — {diag.disease}
                                </span>
                                <span
                                  style={{
                                    background: isHealthy ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    color: isHealthy ? '#6ee7b7' : '#fca5a5',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '999px',
                                  }}
                                >
                                  {diag.confidence ? `${(diag.confidence * 100).toFixed(1)}% Conf.` : 'Evaluated'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                {new Date(diag.created_at).toLocaleString()}
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                              <div>
                                <span style={{ color: '#94a3b8' }}>Pathogen:</span>{' '}
                                <span style={{ color: '#e2e8f0' }}>{diag.pathogen || 'N/A'}</span>
                              </div>
                              <div>
                                <span style={{ color: '#94a3b8' }}>Status:</span>{' '}
                                <span style={{ color: isHealthy ? '#34d399' : '#f87171', fontWeight: 600 }}>
                                  {diag.status}
                                </span>
                              </div>
                              {diag.symptoms && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <span style={{ color: '#94a3b8' }}>Symptoms:</span>{' '}
                                  <span style={{ color: '#cbd5e1' }}>{diag.symptoms}</span>
                                </div>
                              )}
                              {diag.treatment && (
                                <div style={{ gridColumn: '1 / -1', background: 'rgba(15, 23, 42, 0.5)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>Recommended Treatment:</span>{' '}
                                  <span style={{ color: '#cbd5e1' }}>{diag.treatment}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: IRRIGATION LOGS */}
              {activeSubTab === 'irrigation' && (
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#38bdf8' }}>
                    💧 Soil Hydration & Irrigation History
                  </h4>
                  {(!profile.irrigation_history || profile.irrigation_history.length === 0) ? (
                    <div
                      style={{
                        padding: '2.5rem',
                        textAlign: 'center',
                        background: 'rgba(30, 41, 59, 0.3)',
                        borderRadius: '12px',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        color: '#94a3b8',
                      }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💧</div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem' }}>
                        No Irrigation Telemetry Recorded
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        This farmer has not yet logged irrigation cycles or connected soil moisture IoT sensors.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                            <th style={{ padding: '0.6rem 0.75rem' }}>Date & Time</th>
                            <th style={{ padding: '0.6rem 0.75rem' }}>Soil Moisture</th>
                            <th style={{ padding: '0.6rem 0.75rem' }}>Water Applied</th>
                            <th style={{ padding: '0.6rem 0.75rem' }}>Urgency</th>
                            <th style={{ padding: '0.6rem 0.75rem' }}>Field Size</th>
                            <th style={{ padding: '0.6rem 0.75rem' }}>Conditions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.irrigation_history.map((log, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              <td style={{ padding: '0.75rem', color: '#f8fafc' }}>
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <span
                                  style={{
                                    color: log.soil_moisture < 30 ? '#f87171' : '#34d399',
                                    fontWeight: 600,
                                  }}
                                >
                                  {log.soil_moisture}%
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem', color: '#38bdf8' }}>
                                {log.water_applied_liters ? `${log.water_applied_liters.toLocaleString()} L` : 'Scheduled'}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <span
                                  style={{
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background:
                                      log.urgency === 'CRITICAL'
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : log.urgency === 'HIGH'
                                        ? 'rgba(249, 115, 22, 0.2)'
                                        : 'rgba(16, 185, 129, 0.2)',
                                    color:
                                      log.urgency === 'CRITICAL'
                                        ? '#fca5a5'
                                        : log.urgency === 'HIGH'
                                        ? '#fdba74'
                                        : '#6ee7b7',
                                  }}
                                >
                                  {log.urgency || 'OPTIMAL'}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>
                                {log.field_size_hectares ? `${log.field_size_hectares} ha` : '—'}
                              </td>
                              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>
                                {log.weather_condition || 'Normal'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CROP RECOMMENDATIONS */}
              {activeSubTab === 'recommendations' && (
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#38bdf8' }}>
                    🌾 Crop Suitability Evaluations
                  </h4>
                  {(!profile.crop_recommendations || profile.crop_recommendations.length === 0) ? (
                    <div
                      style={{
                        padding: '2.5rem',
                        textAlign: 'center',
                        background: 'rgba(30, 41, 59, 0.3)',
                        borderRadius: '12px',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        color: '#94a3b8',
                      }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌾</div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.25rem' }}>
                        No Crop Recommendations On File
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        This farm has not yet run soil nutrient suitability evaluations.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                      {profile.crop_recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '12px',
                            padding: '1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '1rem' }}>
                              🌱 {rec.recommended_crop}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {new Date(rec.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div>
                              <strong>Soil N-P-K:</strong> {rec.n_value ?? '—'} / {rec.p_value ?? '—'} / {rec.k_value ?? '—'}
                            </div>
                            <div>
                              <strong>Moisture:</strong> {rec.moisture ? `${rec.moisture}%` : '—'}
                            </div>
                            <div>
                              <strong>Temp / Humidity:</strong> {rec.temperature ? `${rec.temperature}°C` : '—'} / {rec.humidity ? `${rec.humidity}%` : '—'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: LIVE WEATHER */}
              {activeSubTab === 'weather' && (
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#38bdf8' }}>
                    🌦️ Live Micro-Climate at Farm Coordinates
                  </h4>
                  {profile.live_weather ? (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.7))',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>
                            {profile.live_weather.temperature}°C
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                            {profile.live_weather.weather_condition || 'Current Conditions'} • {farmer.location || 'Farm Region'}
                          </div>
                        </div>
                        <div
                          style={{
                            background:
                              profile.live_weather.risk_level === 'HIGH'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(16, 185, 129, 0.2)',
                            border: `1px solid ${profile.live_weather.risk_level === 'HIGH' ? '#ef4444' : '#10b981'}`,
                            color: profile.live_weather.risk_level === 'HIGH' ? '#fca5a5' : '#6ee7b7',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                          }}
                        >
                          Weather Risk: {profile.live_weather.risk_level || 'LOW'}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '1rem',
                          fontSize: '0.88rem',
                        }}
                      >
                        <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem', borderRadius: '8px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Relative Humidity</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#38bdf8' }}>
                            {profile.live_weather.humidity}%
                          </div>
                        </div>
                        <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem', borderRadius: '8px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Precipitation Forecast</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#38bdf8' }}>
                            {profile.live_weather.precipitation ?? 0} mm
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
                      Micro-climate data unavailable for the specified location.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            {!isConfirmingDisconnect ? (
              <button
                onClick={() => setIsConfirmingDisconnect(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Disconnect Farm
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>Confirm disconnect?</span>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  style={{
                    background: '#dc2626',
                    border: 'none',
                    color: '#fff',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: disconnecting ? 'wait' : 'pointer',
                  }}
                >
                  {disconnecting ? 'Removing...' : 'Yes, Disconnect'}
                </button>
                <button
                  onClick={() => setIsConfirmingDisconnect(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#cbd5e1',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(14, 165, 233, 0.2)',
              border: '1px solid rgba(14, 165, 233, 0.5)',
              color: '#38bdf8',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
