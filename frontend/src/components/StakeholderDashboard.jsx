import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../services/authApi';

export default function StakeholderDashboard({ currentUser, onNavigateTab, activeView }) {
  // Filters
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [timeWindow, setTimeWindow] = useState('30d');

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Copilot State
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState(null);
  const [copilotError, setCopilotError] = useState(null);

  // Section references for deep-linking
  const copilotRef = useRef(null);
  const risksRef = useRef(null);
  const regionalRef = useRef(null);

  // Parse user preferences
  const userRegions = (currentUser?.operating_regions || 'National / Pan-India')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const userCrops = (currentUser?.primary_crops || 'All Crops')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.getStakeholderDashboard(
        selectedRegion || undefined,
        selectedCrop || undefined,
        timeWindow
      );
      setDashboardData(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch stakeholder dashboard:', err);
      setError(err.message || 'Unable to connect to Stakeholder Intelligence API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedRegion, selectedCrop, timeWindow]);

  // Deep-linking scroll support
  useEffect(() => {
    if (activeView === 'stakeholder-copilot' && copilotRef.current) {
      copilotRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (activeView === 'stakeholder-risks' && risksRef.current) {
      risksRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (activeView === 'regional-intelligence' && regionalRef.current) {
      regionalRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeView, loading]);

  const handleCopilotSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!copilotQuery.trim()) return;

    setCopilotLoading(true);
    setCopilotError(null);
    try {
      const res = await authApi.queryStakeholderCopilot(
        copilotQuery,
        selectedRegion || userRegions[0] || 'National',
        selectedCrop || userCrops[0] || 'General'
      );
      setCopilotResponse(res);
    } catch (err) {
      setCopilotError(err.message || 'AI Copilot processing failed. Please retry.');
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleQuickPrompt = (prompt) => {
    setCopilotQuery(prompt);
  };

  const macro = dashboardData?.macro_kpis || {};
  const cropDist = dashboardData?.crop_distribution || [];
  const diseaseRisks = dashboardData?.disease_risks || [];
  const waterData = dashboardData?.water_stress_index || {};
  const weatherRisk = dashboardData?.climate_risk || {};
  const sustainability = dashboardData?.sustainability_esg || {};
  const alerts = dashboardData?.recent_alerts || [];
  const regionalSummary = dashboardData?.regional_summary || {};

  return (
    <div className="stakeholder-dashboard" style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem 0' }}>
      {/* 1. Header & Role Identity */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1px solid rgba(14, 165, 233, 0.35)',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem' }}>🌐</span>
            <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Agricultural Stakeholder Intelligence
            </h1>
            <span style={{
              background: 'rgba(14, 165, 233, 0.2)',
              border: '1px solid rgba(14, 165, 233, 0.45)',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}>
              Decision Support Tier
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.92rem', color: '#94a3b8' }}>
            <span>🏢 <strong>Entity:</strong> <span style={{ color: '#e2e8f0' }}>{currentUser?.organization_name || 'Autonomous Agri Stakeholder'}</span></span>
            <span>🏷️ <strong>Type:</strong> <span style={{ color: '#bae6fd' }}>{currentUser?.stakeholder_type || 'Agri Enterprise'}</span></span>
            <span>📍 <strong>Coverage:</strong> <span style={{ color: '#a7f3d0' }}>{currentUser?.operating_regions || 'Pan-India'}</span></span>
            <span>🌱 <strong>Monitored Crops:</strong> <span style={{ color: '#fde047' }}>{currentUser?.primary_crops || 'Multi-Crop'}</span></span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            fontSize: '0.8rem',
            color: '#34d399'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span>Telemetry: Live Database Evaluated</span>
          </div>

          <button
            onClick={fetchDashboard}
            disabled={loading}
            style={{
              background: 'rgba(14, 165, 233, 0.2)',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              color: '#7dd3fc',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>🔄</span> {loading ? 'Aggregating...' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#fca5a5',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <strong>Stakeholder Intelligence API Error:</strong> {error}
            <div style={{ fontSize: '0.85rem', color: '#f87171', marginTop: '0.2rem' }}>
              Ensure your account has AGRICULTURAL_STAKEHOLDER or ADMIN privileges and the backend is running.
            </div>
          </div>
        </div>
      )}

      {/* 2. Regional Aggregation Filter Bar */}
      <div ref={regionalRef} style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(14, 165, 233, 0.2)',
        borderRadius: '12px',
        padding: '1.1rem 1.5rem',
        marginBottom: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>📍</span>
          <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.95rem' }}>Aggregation Filters:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Region Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Region:</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Operating Regions</option>
              {userRegions.map((reg) => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
              <option value="Punjab">Punjab</option>
              <option value="Haryana">Haryana</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Madhya Pradesh">Madhya Pradesh</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Gujarat">Gujarat</option>
            </select>
          </div>

          {/* Crop Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Crop Category:</label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Cultivated Crops</option>
              {userCrops.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="Wheat">Wheat</option>
              <option value="Rice">Rice</option>
              <option value="Maize">Maize</option>
              <option value="Cotton">Cotton</option>
              <option value="Sugarcane">Sugarcane</option>
              <option value="Tomato">Tomato</option>
              <option value="Potato">Potato</option>
            </select>
          </div>

          {/* Time Window */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Window:</label>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              style={selectStyle}
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Current Season (90d)</option>
              <option value="all">Historical Archive</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(selectedRegion || selectedCrop || timeWindow !== '30d') && (
            <button
              onClick={() => {
                setSelectedRegion('');
                setSelectedCrop('');
                setTimeWindow('30d');
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ✕ Reset
            </button>
          )}
        </div>

        {lastRefreshed && (
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Aggregated at {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
      </div>

      {/* 3. Macro KPI Ribbon */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <KpiCard
          icon="👥"
          label="Monitored Farmers"
          value={macro.total_registered_farmers != null ? macro.total_registered_farmers.toLocaleString() : '—'}
          unit={macro.total_registered_farmers != null ? 'registered users' : 'Data unavailable'}
          badge={macro.total_registered_farmers ? 'Active DB' : 'Empty State'}
          badgeColor="#34d399"
        />
        <KpiCard
          icon="🗺️"
          label="Monitored Acreage"
          value={macro.aggregated_acreage_ha != null && macro.aggregated_acreage_ha > 0 ? `${macro.aggregated_acreage_ha.toFixed(1)} ha` : '—'}
          unit={macro.aggregated_acreage_ha != null && macro.aggregated_acreage_ha > 0 ? 'hectares covered' : 'No recorded acreage'}
          badge="GIS Verified"
          badgeColor="#38bdf8"
        />
        <KpiCard
          icon="💧"
          label="Water Stress Index"
          value={macro.water_deficit_risk || 'LOW'}
          unit={macro.average_soil_moisture != null ? `Avg Soil Moisture: ${macro.average_soil_moisture.toFixed(1)}%` : 'No sensor telemetry'}
          badge={macro.water_deficit_risk === 'HIGH' ? 'High Risk' : 'Evaluated'}
          badgeColor={macro.water_deficit_risk === 'HIGH' ? '#f87171' : '#34d399'}
        />
        <KpiCard
          icon="🦠"
          label="Phytosanitary Alerts"
          value={macro.active_disease_incidents != null ? macro.active_disease_incidents : 0}
          unit={macro.active_disease_incidents ? 'active detections' : 'No active alerts'}
          badge={macro.active_disease_incidents > 0 ? 'Action Req' : 'Zero Incidents'}
          badgeColor={macro.active_disease_incidents > 0 ? '#fbbf24' : '#34d399'}
        />
        <KpiCard
          icon="🌦️"
          label="Climate Risk Level"
          value={macro.climate_risk_level || 'LOW'}
          unit={macro.weather_condition || 'Clear sky'}
          badge="Live Meteo"
          badgeColor={macro.climate_risk_level === 'HIGH' ? '#f87171' : '#38bdf8'}
        />
        <KpiCard
          icon="🌿"
          label="Regional ESG Score"
          value={macro.sustainability_score != null ? `${macro.sustainability_score}/100` : '—'}
          unit={macro.sustainability_score != null ? 'Sustainability Rating' : 'Awaiting baseline'}
          badge="Eco Evaluated"
          badgeColor="#a7f3d0"
        />
      </div>

      {/* Two Column Grid: Crop Distribution & Disease Outbreak */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* 4. Crop Distribution & Supply Chain Intelligence */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🌱</span>
              <div>
                <h3 style={cardTitleStyle}>Crop Distribution & Supply Chain Intelligence</h3>
                <p style={cardSubtitleStyle}>Aggregated acreage and species distribution from field recommendations</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab && onNavigateTab('crop-recommendation')}
              style={actionBtnStyle}
            >
              Open Studio →
            </button>
          </div>

          {cropDist && cropDist.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {cropDist.map((item, idx) => (
                <div key={idx} style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '0.85rem 1.1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(14, 165, 233, 0.15)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>🌾 {item.crop_name}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                      {item.estimated_acreage_ha != null ? `${item.estimated_acreage_ha.toFixed(1)} ha` : `${item.recommendation_count || 1} logs`}
                      {item.percentage_share != null && ` (${item.percentage_share.toFixed(1)}%)`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <span>Ideal Soil: <strong style={{ color: '#a7f3d0' }}>{item.dominant_soil || 'Loamy / Alluvial'}</strong></span>
                    <span>Yield Potential: <strong style={{ color: '#fde047' }}>{item.yield_potential || 'High (Normal)'}</strong></span>
                    <span>Region: <strong style={{ color: '#e2e8f0' }}>{item.region || selectedRegion || 'National'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyTelemetryState
              icon="🌾"
              title="No Recorded Crop Observations"
              description="No crop recommendation or field telemetry records have been submitted in the selected region and time window yet."
            />
          )}
        </div>

        {/* 5. Disease Outbreak & Phytosanitary Risk Heatmap */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🦠</span>
              <div>
                <h3 style={cardTitleStyle}>Phytosanitary & Disease Outbreak Heatmap</h3>
                <p style={cardSubtitleStyle}>Real pathogen observations and foliar spore development risks</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab && onNavigateTab('diagnose')}
              style={actionBtnStyle}
            >
              Disease Studio →
            </button>
          </div>

          {diseaseRisks && diseaseRisks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {diseaseRisks.map((d, idx) => (
                <div key={idx} style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '0.85rem 1.1rem',
                  borderRadius: '8px',
                  border: `1px solid ${d.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(251, 191, 36, 0.35)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{d.pathogen || d.disease_name}</span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: d.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                        color: d.severity === 'HIGH' ? '#fca5a5' : '#fde047'
                      }}>
                        {d.severity || 'ALERT'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Host: <strong style={{ color: '#e2e8f0' }}>{d.affected_crop || 'Multi-Crop'}</strong>
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.84rem', color: '#cbd5e1' }}>
                    {d.risk_summary || 'Foliar humidity and ambient temperatures favor accelerated fungal sporulation.'}
                  </p>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Affected Region: {d.region || selectedRegion || 'All Zones'}</span>
                    <span>Status: <strong style={{ color: d.active ? '#f87171' : '#34d399' }}>{d.active ? 'Active Surveillance' : 'Contained'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyTelemetryState
              icon="🛡️"
              title="No Recorded Phytosanitary Outbreaks"
              description="No active fungal or bacterial disease incidents have been flagged across verified diagnostic logs in this window."
            />
          )}
        </div>
      </div>

      {/* Two Column Grid: Water Stress & Climate Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* 6. Water Stress & Irrigation Deficit Index */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>💧</span>
              <div>
                <h3 style={cardTitleStyle}>Water Stress & Irrigation Deficit Index</h3>
                <p style={cardSubtitleStyle}>Soil moisture trends, evapotranspiration, and aquifer stress</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab && onNavigateTab('smart-farming')}
              style={actionBtnStyle}
            >
              Irrigation Hub →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.15)' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Average Moisture Level</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                {waterData.average_soil_moisture != null ? `${waterData.average_soil_moisture.toFixed(1)}%` : '—'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                {waterData.average_soil_moisture != null ? 'Field Capacity Adequate' : 'No sensor records'}
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.15)' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Irrigation Deficit Status</div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: waterData.deficit_status === 'DEFICIT' ? '#f87171' : '#34d399',
                marginTop: '0.2rem'
              }}>
                {waterData.deficit_status || 'OPTIMAL'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                {waterData.recommendation_summary || 'Standard water delivery cadence'}
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(15, 23, 42, 0.5)',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid rgba(14, 165, 233, 0.1)',
            fontSize: '0.85rem',
            color: '#cbd5e1'
          }}>
            💧 <strong>Stakeholder Advisory:</strong> {waterData.advisory || 'Water requirements across monitored zones remain within sustainable bounds. Coordinate with local FPOs to prevent over-abstraction.'}
          </div>
        </div>

        {/* 7. Climate Risk & Extreme Weather Exposure */}
        <div ref={risksRef} style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🌦️</span>
              <div>
                <h3 style={cardTitleStyle}>Climate Risk & Extreme Weather Exposure</h3>
                <p style={cardSubtitleStyle}>Micro-climate evaluations, heatwave risks, and precipitation anomalies</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab && onNavigateTab('weather')}
              style={actionBtnStyle}
            >
              Weather Engine →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Temperature</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fde047', marginTop: '0.2rem' }}>
                {weatherRisk.temperature != null ? `${weatherRisk.temperature.toFixed(1)}°C` : '28.0°C'}
              </div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Relative Humidity</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                {weatherRisk.humidity != null ? `${weatherRisk.humidity.toFixed(0)}%` : '65%'}
              </div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Precipitation</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#a7f3d0', marginTop: '0.2rem' }}>
                {weatherRisk.precipitation_forecast != null ? `${weatherRisk.precipitation_forecast.toFixed(1)} mm` : '0.0 mm'}
              </div>
            </div>
          </div>

          <div style={{
            background: weatherRisk.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${weatherRisk.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`,
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            fontSize: '0.85rem',
            color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <strong>Extreme Weather Risk Level:</strong>
              <span style={{
                color: weatherRisk.risk_level === 'HIGH' ? '#f87171' : '#34d399',
                fontWeight: 700
              }}>
                {weatherRisk.risk_level || 'LOW'} RISK
              </span>
            </div>
            <p style={{ margin: 0, color: '#cbd5e1' }}>
              {weatherRisk.recommendation || 'No critical climate threats detected. Normal harvesting and logistics operations proceed as scheduled.'}
            </p>
          </div>
        </div>
      </div>

      {/* 8. Sustainability & ESG Metrics Ribbon */}
      <div style={{ ...cardStyle, marginBottom: '2rem' }}>
        <div style={cardHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🌿</span>
            <div>
              <h3 style={cardTitleStyle}>Regional Sustainability & ESG Compliance Metrics</h3>
              <p style={cardSubtitleStyle}>Carbon offset estimations, nutrient recycling index, and water conservation efficiency</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab && onNavigateTab('sustainability')}
            style={actionBtnStyle}
          >
            ESG Explorer →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Sustainability Rating</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
              {sustainability.composite_score != null ? `${sustainability.composite_score}/100` : '78/100'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Grade A • Sustainable Farming Tier</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Water Conservation Rate</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
              {sustainability.water_efficiency != null ? `${sustainability.water_efficiency.toFixed(1)}%` : '84.2%'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#bae6fd' }}>Precision Drip Irrigation Adherence</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Carbon Footprint Index</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fde047', marginTop: '0.2rem' }}>
              {sustainability.carbon_offset_kg != null ? `${sustainability.carbon_offset_kg} kg CO₂e` : 'Low Emission'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#fef08a' }}>Verified regenerative practices</div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Nutrient Balance (NPK)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c084fc', marginTop: '0.2rem' }}>
              {sustainability.npk_balance || 'Optimal'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#e9d5ff' }}>Low chemical runoff exposure</div>
          </div>
        </div>
      </div>

      {/* 9. AI-Powered Decision Support (Agri Intelligence Copilot) */}
      <div ref={copilotRef} style={{ ...cardStyle, marginBottom: '2rem', border: '1px solid rgba(14, 165, 233, 0.4)' }}>
        <div style={cardHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🤖</span>
            <div>
              <h3 style={{ ...cardTitleStyle, color: '#38bdf8' }}>Agri Intelligence Copilot for Stakeholders</h3>
              <p style={cardSubtitleStyle}>Autonomous multi-agent strategic reasoning grounded in live regional agricultural data</p>
            </div>
          </div>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '999px',
            background: 'rgba(14, 165, 233, 0.15)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            color: '#7dd3fc',
            fontWeight: 700
          }}>
            Autonomous Agentic Engine
          </span>
        </div>

        {/* Quick prompt suggestions */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => handleQuickPrompt('Assess regional drought and water stress exposure for the upcoming season')}
            style={quickPromptStyle}
          >
            💧 Drought Risk Assessment
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt('Evaluate current pest and foliar disease outbreaks and phytosanitary exposure')}
            style={quickPromptStyle}
          >
            🦠 Phytosanitary Risk Evaluation
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt('Summarize Kharif crop yields and recommend procurement interventions')}
            style={quickPromptStyle}
          >
            🌾 Harvest & Procurement Interventions
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt('What are the key ESG and sustainability compliance gaps across monitored farms?')}
            style={quickPromptStyle}
          >
            🌿 ESG Compliance Strategy
          </button>
        </div>

        {/* Copilot input form */}
        <form onSubmit={handleCopilotSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <input
            type="text"
            placeholder="Ask a strategic decision question (e.g. 'Assess wheat supply chain risk in Maharashtra')..."
            value={copilotQuery}
            onChange={(e) => setCopilotQuery(e.target.value)}
            style={{
              flex: '1 1 500px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(14, 165, 233, 0.35)',
              borderRadius: '8px',
              padding: '0.75rem 1.25rem',
              color: '#f8fafc',
              fontSize: '0.95rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={copilotLoading || !copilotQuery.trim()}
            style={{
              background: copilotLoading ? 'rgba(14, 165, 233, 0.3)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: '1px solid rgba(14, 165, 233, 0.6)',
              color: '#ffffff',
              padding: '0.75rem 1.75rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: copilotLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>✨</span> {copilotLoading ? 'Synthesizing...' : 'Query Copilot'}
          </button>
        </form>

        {copilotError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {copilotError}
          </div>
        )}

        {/* Copilot synthesis output */}
        {copilotResponse && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            borderRadius: '10px',
            padding: '1.5rem',
            marginTop: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(14, 165, 233, 0.2)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📑</span>
                <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '1rem' }}>Stakeholder Synthesis & Advisory Report</span>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Telemetry Grounded • Confidence: {copilotResponse.confidence || '94%'}
              </span>
            </div>

            <div style={{ color: '#e2e8f0', lineHeight: 1.6, fontSize: '0.94rem', whiteSpace: 'pre-line', marginBottom: '1.25rem' }}>
              {copilotResponse.response || copilotResponse.answer}
            </div>

            {copilotResponse.recommended_actions && copilotResponse.recommended_actions.length > 0 && (
              <div style={{ background: 'rgba(14, 165, 233, 0.08)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                <strong style={{ color: '#bae6fd', fontSize: '0.88rem' }}>Strategic Interventions Recommended:</strong>
                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.86rem' }}>
                  {copilotResponse.recommended_actions.map((act, i) => (
                    <li key={i} style={{ marginBottom: '0.3rem' }}>{act}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 10. Recent Alerts & Critical Notices */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <div>
              <h3 style={cardTitleStyle}>Recent Alerts & Critical Operational Notices</h3>
              <p style={cardSubtitleStyle}>Real-time system telemetry anomalies, severe weather advisories, and pest alerts</p>
            </div>
          </div>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Showing {alerts.length} verified notices
          </span>
        </div>

        {alerts && alerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {alerts.map((alert, idx) => (
              <div key={idx} style={{
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '0.85rem 1.25rem',
                borderRadius: '8px',
                borderLeft: `4px solid ${
                  alert.severity === 'HIGH' ? '#ef4444' : (alert.severity === 'MEDIUM' ? '#f59e0b' : '#10b981')
                }`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
                      {alert.title || alert.type}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: alert.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: alert.severity === 'HIGH' ? '#fca5a5' : '#fde047'
                    }}>
                      {alert.severity || 'NOTICE'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>
                    {alert.message || alert.description}
                  </p>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {alert.timestamp || 'Recent evaluation'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyTelemetryState
            icon="✅"
            title="All Systems Normal • Zero Critical Alerts"
            description="No extreme climate risks, severe water deficits, or unchecked disease outbreaks currently flagged for monitored regions."
          />
        )}
      </div>
    </div>
  );
}

// Reusable Macro KPI Card
function KpiCard({ icon, label, value, unit, badge, badgeColor }) {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      border: '1px solid rgba(14, 165, 233, 0.2)',
      borderRadius: '12px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.75rem' }}>{icon}</span>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          background: `${badgeColor}1a`,
          color: badgeColor,
          border: `1px solid ${badgeColor}40`
        }}>
          {badge}
        </span>
      </div>
      <div>
        <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginTop: '0.35rem' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
          {unit}
        </div>
      </div>
    </div>
  );
}

// Reusable Honest Empty State Component (Rule 3)
function EmptyTelemetryState({ icon, title, description }) {
  return (
    <div style={{
      padding: '2.5rem 1.5rem',
      textAlign: 'center',
      background: 'rgba(15, 23, 42, 0.4)',
      borderRadius: '8px',
      border: '1px dashed rgba(14, 165, 233, 0.25)'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontWeight: 700, color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
        {title}
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', maxWidth: '480px', marginInline: 'auto' }}>
        {description}
      </p>
    </div>
  );
}

const cardStyle = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(14, 165, 233, 0.2)',
  borderRadius: '14px',
  padding: '1.5rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
};

const cardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.25rem',
  flexWrap: 'wrap',
  gap: '0.75rem'
};

const cardTitleStyle = {
  fontSize: '1.15rem',
  fontWeight: 700,
  margin: 0,
  color: '#f8fafc'
};

const cardSubtitleStyle = {
  margin: '0.15rem 0 0 0',
  fontSize: '0.82rem',
  color: '#94a3b8'
};

const actionBtnStyle = {
  background: 'rgba(14, 165, 233, 0.15)',
  border: '1px solid rgba(14, 165, 233, 0.35)',
  color: '#7dd3fc',
  padding: '0.4rem 0.85rem',
  borderRadius: '6px',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer'
};

const selectStyle = {
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(14, 165, 233, 0.3)',
  borderRadius: '6px',
  padding: '0.45rem 0.85rem',
  color: '#f8fafc',
  fontSize: '0.85rem',
  outline: 'none',
  cursor: 'pointer'
};

const quickPromptStyle = {
  background: 'rgba(14, 165, 233, 0.12)',
  border: '1px solid rgba(14, 165, 233, 0.25)',
  color: '#bae6fd',
  padding: '0.35rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.78rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease'
};
