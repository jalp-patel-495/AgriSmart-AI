import React, { useState, useEffect } from 'react';
import { authApi } from '../../services/authApi';
import FarmerDetailModal from './FarmerDetailModal';

export default function RegionalIntelligenceView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  const fetchRegionalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.getStakeholderRegionalIntelligence(selectedRegion);
      setData(res);
    } catch (err) {
      console.error('Failed to load regional intelligence:', err);
      setError(err.message || 'Unable to load regional intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegionalData();
  }, [selectedRegion]);

  const regions = data?.regions || [];
  const activeCount = data?.total_active_regions || regions.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Bar */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
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
            <span>📍</span> Regional Intelligence & Multi-Farm Telemetry
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Geographic aggregation grouped strictly by operating locations of your connected farms.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={fetchRegionalData}
            title="Refresh regional data"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '0.5rem 0.75rem',
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
        <div style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔄</div>
          <div>Aggregating multi-region telemetry from connected farms...</div>
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
      ) : regions.length === 0 ? (
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
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗺️</div>
          <h4 style={{ color: '#f8fafc', margin: '0 0 0.25rem 0' }}>No Active Regional Clusters</h4>
          <p style={{ fontSize: '0.88rem', margin: 0 }}>
            Connect with farmers across different agricultural zones to monitor localized weather, disease pressures, and soil conditions.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {regions.map((reg, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* Region Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>
                    📍 {reg.region || reg.name || 'Agri Zone'}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {reg.farms_count || reg.connected_farms_count || 1} Connected Farms Monitored
                  </div>
                </div>

                <span
                  style={{
                    background: 'rgba(14, 165, 233, 0.2)',
                    color: '#38bdf8',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {reg.total_acreage_ha ? `${reg.total_acreage_ha} ha` : 'Active'}
                </span>
              </div>

              {/* Weather & Soil Matrix */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <span style={{ color: '#94a3b8' }}>Weather:</span>{' '}
                  <strong style={{ color: '#f8fafc' }}>
                    {reg.temperature ? `${reg.temperature}°C` : '—'}
                  </strong>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{reg.weather_condition || 'Clear'}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Avg Soil Moisture:</span>{' '}
                  <strong style={{ color: reg.avg_soil_moisture && reg.avg_soil_moisture < 30 ? '#f87171' : '#34d399' }}>
                    {reg.avg_soil_moisture ? `${reg.avg_soil_moisture}%` : 'Normal'}
                  </strong>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#94a3b8' }}>Precipitation Forecast:</span>{' '}
                  <strong style={{ color: '#38bdf8' }}>{reg.precipitation_forecast_mm ?? 0} mm</strong>
                </div>
              </div>

              {/* Crops & Disease status */}
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Dominant Crops:</span>{' '}
                  <span style={{ color: '#34d399', fontWeight: 500 }}>
                    {(reg.crops || reg.dominant_crops || []).join(', ') || 'Mixed Crop'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Phytosanitary Status:</span>{' '}
                  <span style={{ color: reg.active_outbreaks > 0 ? '#f87171' : '#6ee7b7', fontWeight: 600 }}>
                    {reg.active_outbreaks > 0
                      ? `⚠️ ${reg.active_outbreaks} Outbreak Reported`
                      : '✓ Clean / No Outbreaks'}
                  </span>
                </div>
              </div>

              {/* Farmers list in region */}
              {reg.farmers && reg.farmers.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Connected Farms in Region:
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {reg.farmers.map((f, fIdx) => (
                      <button
                        key={fIdx}
                        onClick={() => setSelectedFarmer(f)}
                        style={{
                          background: 'rgba(30, 41, 59, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#e2e8f0',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        👨‍🌾 {f.farmer_name} ({f.farm_name || 'Farm'})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
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
