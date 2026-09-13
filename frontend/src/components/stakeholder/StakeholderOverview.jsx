import React from 'react';

export default function StakeholderOverview({
  dashboardData,
  onNavigateTab,
  onRefresh,
  loading,
}) {
  const macro = dashboardData?.macro_kpis || {};
  const cropDist = dashboardData?.crop_distribution || [];
  const diseaseRisks = dashboardData?.disease_risks || [];
  const waterData = dashboardData?.water_stress_index || {};
  const weatherRisk = dashboardData?.climate_risk || {};
  const sustainability = dashboardData?.sustainability_esg || {};
  const connectedCount = macro.connected_farmers_count || 0;
  const isZeroConnected = connectedCount === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Top Macro KPI Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* KPI 1: Connected Farmers */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('farmers')}
          style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            borderRadius: '14px',
            padding: '1.25rem',
            cursor: 'pointer',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Connected Farmers
            </span>
            <span style={{ fontSize: '1.25rem' }}>👨‍🌾</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.35rem' }}>
            {connectedCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: isZeroConnected ? '#fca5a5' : '#34d399', marginTop: '0.2rem' }}>
            {isZeroConnected ? '⚠️ No farmers connected' : '✓ Federated telemetry active'}
          </div>
        </div>

        {/* KPI 2: Monitored Acreage */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '14px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Monitored Acreage
            </span>
            <span style={{ fontSize: '1.25rem' }}>🗺️</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#34d399', marginTop: '0.35rem' }}>
            {macro.monitored_acreage_hectares !== undefined
              ? `${macro.monitored_acreage_hectares} ha`
              : '0.0 ha'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Sum of logged field zones
          </div>
        </div>

        {/* KPI 3: Monitored Crops */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '14px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Monitored Crops
            </span>
            <span style={{ fontSize: '1.25rem' }}>🌾</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.35rem' }}>
            {macro.monitored_crops_count || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Distinct species in network
          </div>
        </div>

        {/* KPI 4: Active Critical Risks */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('risks')}
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '14px',
            padding: '1.25rem',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Critical / High Risks
            </span>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: macro.active_critical_risks > 0 ? '#f87171' : '#34d399', marginTop: '0.35rem' }}>
            {macro.active_critical_risks || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {macro.active_critical_risks > 0 ? 'Requires intervention' : 'Network risk nominal'}
          </div>
        </div>

        {/* KPI 5: Network Health */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '14px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Network Health
            </span>
            <span style={{ fontSize: '1.25rem' }}>💚</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#c084fc', marginTop: '0.35rem' }}>
            {macro.network_health_score !== undefined ? `${macro.network_health_score}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Composite crop & soil index
          </div>
        </div>
      </div>

      {/* Zero Connected Warning Banner */}
      {isZeroConnected && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
            <div>
              <strong style={{ color: '#fde047' }}>Zero Connected Farmers:</strong>{' '}
              <span style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>
                All dashboard telemetry is strictly aggregated from connected farmers. Please review pending connection requests or connect with farmers to activate network intelligence.
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab && onNavigateTab('farmers')}
            style={{
              background: '#eab308',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 1rem',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Manage Farmer Connections →
          </button>
        </div>
      )}

      {/* 2. Middle Grid: Crop Distribution + Disease Outbreak Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
        {/* Crop Distribution Card */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🌾</span> Crop Distribution Across Network
            </h4>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {cropDist.length} Species Monitored
            </span>
          </div>

          {cropDist.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              No crops cultivated by connected farmers yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {cropDist.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>{item.crop}</span>
                    <span style={{ color: '#38bdf8' }}>
                      {item.percentage}% ({item.acreage_ha || 0} ha)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(item.percentage || 10, 100)}%`,
                        background: 'linear-gradient(90deg, #0ea5e9, #34d399)',
                        borderRadius: '999px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disease Outbreak Intelligence Card */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔬</span> Phytosanitary & Pathogen Surveillance
            </h4>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Real Observation Radar
            </span>
          </div>

          {diseaseRisks.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              ✓ No active disease outbreaks detected across connected farms.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {diseaseRisks.slice(0, 4).map((d, idx) => {
                const isCritical = (d.threat_level || '').toUpperCase() === 'CRITICAL' || (d.threat_level || '').toUpperCase() === 'HIGH';
                return (
                  <div
                    key={idx}
                    style={{
                      background: isCritical ? 'rgba(239, 68, 68, 0.08)' : 'rgba(234, 179, 8, 0.08)',
                      border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                      borderRadius: '10px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
                        {d.disease} ({d.crop})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        Pathogen: {d.pathogen || 'Fungal/Bacterial'} • Affected Farms: {d.affected_farms_count || 1}
                      </div>
                    </div>
                    <span
                      style={{
                        background: isCritical ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                        color: isCritical ? '#fca5a5' : '#fde047',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {d.threat_level || 'EVALUATED'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Grid: Water Stress & Soil Moisture Index + Micro-Climate Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Water Stress Index */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.25rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💧</span> Soil Moisture & Hydration Index
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>
                {waterData.average_soil_moisture !== undefined && waterData.average_soil_moisture !== null
                  ? `${waterData.average_soil_moisture}%`
                  : 'N/A'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Network Average Soil Moisture</div>
            </div>
            <span
              style={{
                background: 'rgba(14, 165, 233, 0.2)',
                color: '#38bdf8',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {waterData.status || 'NOMINAL'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
            {waterData.recommendation || 'Continuous soil moisture telemetry from federated farms.'}
          </div>
        </div>

        {/* Climate & Weather Risk */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.25rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌦️</span> Climate & Weather Outlook
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>
                {weatherRisk.temperature ? `${weatherRisk.temperature}°C` : 'N/A'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {weatherRisk.condition || 'Regional Weather'} • Humidity: {weatherRisk.humidity ? `${weatherRisk.humidity}%` : 'N/A'}
              </div>
            </div>
            <span
              style={{
                background:
                  weatherRisk.risk_level === 'HIGH'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(16, 185, 129, 0.2)',
                color: weatherRisk.risk_level === 'HIGH' ? '#fca5a5' : '#6ee7b7',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {weatherRisk.risk_level || 'LOW'} RISK
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
            {weatherRisk.advisory || 'Live Open-Meteo meteorological telemetry for operating zones.'}
          </div>
        </div>

        {/* Sustainability & ESG */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.25rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌿</span> ESG & Sustainability Stewardship
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>
                {sustainability.score !== undefined ? `${sustainability.score}%` : 'N/A'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Composite Sustainability Score</div>
            </div>
            <span
              style={{
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {sustainability.rating || 'OPTIMAL'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
            Calculated from water efficiency, organic disease control adherence, and soil nutrition records.
          </div>
        </div>
      </div>
    </div>
  );
}
