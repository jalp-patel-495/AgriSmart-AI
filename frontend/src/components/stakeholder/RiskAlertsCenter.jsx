import React, { useState, useEffect } from 'react';
import { authApi } from '../../services/authApi';
import FarmerDetailModal from './FarmerDetailModal';

export default function RiskAlertsCenter({ initialAlerts = [] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  const fetchRisks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.getStakeholderRisks();
      setAlerts(data.active_risks || data.risks || []);
    } catch (err) {
      console.error('Failed to fetch stakeholder risks:', err);
      setError(err.message || 'Unable to load risk alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisks();
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter === 'ALL') return true;
    return (alert.severity || alert.level || '').toUpperCase() === severityFilter;
  });

  const getSeverityStyle = (severity) => {
    switch ((severity || '').toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5', badge: '#dc2626' };
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#fdba74', badge: '#ea580c' };
      case 'MODERATE':
        return { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fde047', badge: '#ca8a04' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7', badge: '#059669' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Filter Bar */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span> Grounded Risk & Early Warning Center
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Multi-tier risk synthesis derived strictly from real connected farm observations (diagnostics, soil moisture, and weather).
          </p>
        </div>

        {/* Severity Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSeverityFilter(lvl)}
              style={{
                background: severityFilter === lvl ? 'rgba(239, 68, 68, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                border: severityFilter === lvl ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                color: severityFilter === lvl ? '#fca5a5' : '#cbd5e1',
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {lvl}
            </button>
          ))}
          <button
            onClick={fetchRisks}
            title="Refresh risks"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '0.4rem 0.7rem',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔄</div>
          <div>Evaluating risk matrix across connected farms...</div>
        </div>
      ) : error ? (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '1.25rem',
            borderRadius: '12px',
          }}
        >
          {error}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '3rem',
            textAlign: 'center',
            color: '#94a3b8',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
          <h4 style={{ color: '#f8fafc', margin: '0 0 0.25rem 0' }}>No Active Risk Alerts</h4>
          <p style={{ fontSize: '0.88rem', margin: 0 }}>
            No risks matching the "{severityFilter}" filter level across connected farms.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredAlerts.map((alert, idx) => {
            const style = getSeverityStyle(alert.severity || alert.level);
            return (
              <div
                key={idx}
                style={{
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  borderRadius: '14px',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Alert Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span
                      style={{
                        background: style.badge,
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {alert.severity || alert.level || 'WARNING'}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 600 }}>
                      {alert.title || alert.alert || alert.type || 'Agricultural Health Alert'}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                    {alert.source && (
                      <span style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        Source: {alert.source}
                      </span>
                    )}
                    <span>{alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Recent Telemetry'}</span>
                  </div>
                </div>

                {/* 5-Point Explicit Breakdown */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                  }}
                >
                  {/* WHY: Grounded reason */}
                  <div>
                    <strong style={{ color: '#cbd5e1' }}>Grounding Reason:</strong>{' '}
                    <span style={{ color: '#e2e8f0' }}>{alert.description || alert.reason || alert.why || 'Observed telemetry exceeds normal physiological safety thresholds.'}</span>
                  </div>

                  {/* ACTION: Agronomic advice */}
                  {(alert.action || alert.recommendation) && (
                    <div>
                      <strong style={{ color: '#38bdf8' }}>Recommended Mitigation Action:</strong>{' '}
                      <span style={{ color: '#cbd5e1' }}>{alert.action || alert.recommendation}</span>
                    </div>
                  )}

                  {/* FARM / FARMER Details */}
                  {(alert.farmer_name || alert.farm_name || alert.location) && (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '0.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.8rem' }}>
                      {alert.farmer_name && (
                        <span>
                          👨‍🌾 <strong>Farmer:</strong> {alert.farmer_name}
                        </span>
                      )}
                      {alert.farm_name && (
                        <span>
                          🏡 <strong>Farm:</strong> {alert.farm_name}
                        </span>
                      )}
                      {alert.location && (
                        <span>
                          📍 <strong>Location:</strong> {alert.location}
                        </span>
                      )}
                      {alert.crop && (
                        <span>
                          🌱 <strong>Crop:</strong> {alert.crop}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick inspect button if farmer_id present */}
                {alert.farmer_id && (
                  <div style={{ alignSelf: 'flex-end' }}>
                    <button
                      onClick={() => setSelectedFarmer({ farmer_id: alert.farmer_id, farmer_name: alert.farmer_name, location: alert.location })}
                      style={{
                        background: 'rgba(14, 165, 233, 0.2)',
                        border: '1px solid rgba(14, 165, 233, 0.5)',
                        color: '#38bdf8',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      View Farm Telemetry →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedFarmer && (
        <FarmerDetailModal
          farmer={selectedFarmer}
          onClose={() => setSelectedFarmer(null)}
        />
      )}
    </div>
  );
}
