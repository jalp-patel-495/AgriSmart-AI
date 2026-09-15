import React, { useState, useEffect, useMemo } from 'react';
import { authApi } from '../../services/authApi';

export default function StakeholderDiseaseTrendsView() {
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [diseaseData, setDiseaseData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAlertId, setExpandedAlertId] = useState(null);

  useEffect(() => {
    const fetchTrendsAndAlerts = async () => {
      setLoading(true);
      setError(null);
      try {
        const [disRes, riskRes] = await Promise.allSettled([
          authApi.getStakeholderDiseaseIntelligence(),
          authApi.getStakeholderRisks(),
        ]);

        if (disRes.status === 'fulfilled') {
          setDiseaseData(disRes.value);
        }
        if (riskRes.status === 'fulfilled') {
          setRiskData(riskRes.value);
        }
      } catch (err) {
        console.error('Failed to load disease trends:', err);
        setError('Unable to load disease intelligence records.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrendsAndAlerts();
  }, []);

  // Build authentic alert items strictly from real records
  const alertsList = useMemo(() => {
    const list = [];

    // 1. Items from StakeholderRisksResponse (Disease category)
    if (riskData && riskData.alerts) {
      riskData.alerts.forEach((alert) => {
        if (alert.category === 'Disease') {
          list.push({
            id: alert.id,
            pathogen: alert.what,
            severity: alert.level,
            crop: alert.what.includes(' on ') ? alert.what.split(' on ')[1]?.split(' at ')[0] : 'Monitored Crop',
            farmLocation: alert.source_module || 'Connected Farm',
            confidence: alert.why,
            advisory: alert.action,
            timestamp: alert.timestamp,
            rawItem: alert,
          });
        }
      });
    }

    // 2. If no risk alerts but observations exist, map real diseased observations
    if (list.length === 0 && diseaseData && diseaseData.observations) {
      const diseasedObs = diseaseData.observations.filter(
        (o) => o.status === 'Diseased' || (o.disease && !o.disease.toLowerCase().includes('healthy'))
      );

      diseasedObs.forEach((o) => {
        const confNum = parseInt(o.confidence, 10) || 0;
        const severity = confNum >= 80 ? 'HIGH' : 'MODERATE';

        list.push({
          id: `obs-${o.id}`,
          pathogen: o.disease || 'Identified Foliar Pathogen',
          severity,
          crop: o.crop || 'Field Specimen',
          farmLocation: o.farmer_id ? `Farmer #${o.farmer_id}` : 'Connected Farm Node',
          confidence: `Diagnostic Confidence: ${o.confidence}`,
          advisory: o.treatment || 'Prune infected foliage and apply appropriate bio-protectant spray as per agronomic protocol.',
          symptoms: o.symptoms,
          timestamp: o.date || 'Recent diagnostic observation',
          rawItem: o,
        });
      });
    }

    return list;
  }, [riskData, diseaseData]);

  // Filter alerts by risk and search
  const filteredAlerts = useMemo(() => {
    return alertsList.filter((a) => {
      const matchesRisk = selectedRiskFilter === 'ALL' || a.severity.toUpperCase() === selectedRiskFilter;
      const matchesSearch =
        !searchQuery ||
        a.pathogen.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.crop.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRisk && matchesSearch;
    });
  }, [alertsList, selectedRiskFilter, searchQuery]);

  // Weather-driven foliar risk notice
  const weatherRiskInfo = diseaseData?.weather_driven_pathogen_risk;

  return (
    <div className="role-page-container disease-trends-page">
      {/* Page Header */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#f87171' }}>Phytosanitary Surveillance</span>
          <h1 className="page-main-title">⚠️ Disease Trends & Early Warning</h1>
          <p className="page-desc">
            Phytosanitary monitoring based on aggregated field scans, agrometeorological humidity indexes, and verified plant health observations.
          </p>
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Weather Risk Banner if available */}
      {weatherRiskInfo && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(6, 78, 59, 0.25) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '14px',
            padding: '1.15rem 1.35rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>🌦️</span>
          <div>
            <strong style={{ color: '#38bdf8', fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
              Regional Micro-Climate & Sporulation Index ({weatherRiskInfo.risk_level} Risk)
            </strong>
            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, lineHeight: 1.45 }}>
              {weatherRiskInfo.notes || 'Meteorological conditions monitored across connected farm coordinates.'}
            </p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div
        className="history-filter-toolbar"
        style={{
          background: 'rgba(16, 28, 22, 0.75)',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          borderRadius: '14px',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Input */}
          <div
            className="search-input-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              minWidth: '220px',
            }}
          >
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search pathogen or crop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-text-input"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          {/* Severity Dropdown */}
          <select
            value={selectedRiskFilter}
            onChange={(e) => setSelectedRiskFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter by Risk Severity"
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Severity Levels</option>
            <option value="CRITICAL">Critical Severity Only</option>
            <option value="HIGH">High Severity Only</option>
            <option value="MODERATE">Moderate Severity Only</option>
            <option value="LOW">Low Severity Only</option>
          </select>
        </div>

        {(searchQuery || selectedRiskFilter !== 'ALL') && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => {
              setSearchQuery('');
              setSelectedRiskFilter('ALL');
            }}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Outbreak Alert Cards */}
      {loading ? (
        <div style={{ padding: '3rem 0', textAlign: 'center', color: '#94a3b8' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
          <span>Scanning recorded disease telemetry...</span>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 1rem',
            textAlign: 'center',
            background: 'rgba(16, 28, 22, 0.6)',
            border: '1px dashed rgba(52, 211, 153, 0.25)',
            borderRadius: '16px',
            color: '#94a3b8',
          }}
        >
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🛡️</span>
          <strong style={{ color: '#e2e8f0', fontSize: '1.1rem', display: 'block', marginBottom: '0.35rem' }}>
            {searchQuery || selectedRiskFilter !== 'ALL'
              ? 'No disease alerts match your active filter criteria.'
              : 'No active disease alerts or phytosanitary risks detected on connected farms.'}
          </strong>
          <small style={{ color: '#64748b' }}>
            All inspected foliar specimens from connected producers currently show optimal vitality or no unhandled outbreaks.
          </small>
        </div>
      ) : (
        <div className="outbreaks-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
          {filteredAlerts.map((alert) => {
            const isHigh = alert.severity.toUpperCase() === 'HIGH' || alert.severity.toUpperCase() === 'CRITICAL';
            const badgeBg = isHigh ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)';
            const badgeColor = isHigh ? '#f87171' : '#fbbf24';
            const badgeBorder = isHigh ? 'rgba(239, 68, 68, 0.35)' : 'rgba(251, 191, 36, 0.35)';
            const isExpanded = expandedAlertId === alert.id;

            return (
              <div
                key={alert.id}
                className="outbreak-alert-card"
                style={{
                  background: 'rgba(16, 28, 22, 0.8)',
                  border: `1px solid ${badgeBorder}`,
                  borderRadius: '16px',
                  padding: '1.35rem',
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Card Top */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      background: badgeBg,
                      color: badgeColor,
                      border: `1px solid ${badgeBorder}`,
                      padding: '0.2rem 0.65rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isHigh ? '🔴' : '🟡'} {alert.severity} RISK
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {alert.timestamp}
                  </span>
                </div>

                {/* Card Title & Pathogen */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🦠</span>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                      {alert.pathogen}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      🌾 <strong>Crop:</strong> {alert.crop} • 📍 <strong>Source:</strong> {alert.farmLocation}
                    </div>
                  </div>
                </div>

                {/* Diagnostic Observation / Confidence */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.82rem',
                    color: '#cbd5e1',
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>Observation: </span>
                  {alert.confidence}
                </div>

                {/* Advisory Directive */}
                <div
                  style={{
                    background: 'rgba(6, 78, 59, 0.2)',
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                  }}
                >
                  <strong style={{ color: '#34d399', display: 'block', marginBottom: '0.25rem' }}>
                    🛡️ Advisory Directive:
                  </strong>
                  <p style={{ color: '#e2e8f0', margin: 0, lineHeight: 1.4 }}>
                    {alert.advisory}
                  </p>
                </div>

                {/* Expandable Details Button */}
                <div style={{ paddingTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                  </button>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.85rem',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ marginBottom: '0.4rem' }}>
                        <strong style={{ color: '#fff' }}>Symptoms & Etiology: </strong>
                        {alert.symptoms || 'Foliar discoloration and visible fungal / bacterial lesion structures.'}
                      </div>
                      <div style={{ marginBottom: '0.4rem' }}>
                        <strong style={{ color: '#fff' }}>Agronomic Verification: </strong>
                        Automated neural classification cross-referenced with PlantVillage disease taxonomy.
                      </div>
                      <div>
                        <strong style={{ color: '#fff' }}>Origin Node: </strong>
                        {alert.farmLocation} • Timestamp: {alert.timestamp}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
