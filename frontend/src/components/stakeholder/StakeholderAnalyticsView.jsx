import React, { useState, useEffect } from 'react';
import { authApi } from '../../services/authApi';

export default function StakeholderAnalyticsView() {
  const [selectedRange, setSelectedRange] = useState('30d');
  const [dashboardData, setDashboardData] = useState(null);
  const [diseaseData, setDiseaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, disRes] = await Promise.allSettled([
          authApi.getStakeholderDashboard(undefined, undefined, selectedRange),
          authApi.getStakeholderDiseaseIntelligence(),
        ]);

        if (dashRes.status === 'fulfilled') {
          setDashboardData(dashRes.value);
        }
        if (disRes.status === 'fulfilled') {
          setDiseaseData(disRes.value);
        }
      } catch (err) {
        console.error('Failed to load analytics telemetry:', err);
        setError('Unable to load regional agricultural analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedRange]);

  // Extract authentic telemetry
  const healthyVsDiseased = dashboardData?.healthy_vs_diseased || {};
  const totalScans = healthyVsDiseased.total_scans ?? 0;
  const healthyCount = healthyVsDiseased.healthy_count ?? 0;
  const diseasedCount = healthyVsDiseased.diseased_count ?? 0;

  const totalClassified = healthyVsDiseased.total_classified !== undefined
    ? Number(healthyVsDiseased.total_classified)
    : (healthyCount + diseasedCount);

  const healthyPct = totalClassified > 0
    ? (healthyVsDiseased.healthy_percentage !== undefined && healthyVsDiseased.healthy_percentage !== null
        ? healthyVsDiseased.healthy_percentage
        : Math.round((healthyCount / totalClassified) * 100))
    : null;
  const diseasedPct = totalClassified > 0
    ? (healthyVsDiseased.diseased_percentage !== undefined && healthyVsDiseased.diseased_percentage !== null
        ? healthyVsDiseased.diseased_percentage
        : Math.round((diseasedCount / totalClassified) * 100))
    : null;

  // Real crops distribution
  const rawCropDist = dashboardData?.crop_distribution || [];
  const mostAffected = dashboardData?.most_affected_crops || [];
  
  // Dominant crop
  let dominantCropName = 'Data unavailable';
  if (mostAffected.length > 0 && mostAffected[0].crop) {
    dominantCropName = `${mostAffected[0].crop} (${mostAffected[0].percentage}%)`;
  } else if (rawCropDist.length > 0 && rawCropDist[0].crop_name) {
    dominantCropName = rawCropDist[0].crop_name;
  }

  // Disease distribution from real records
  const observations = diseaseData?.observations || [];
  const diseasedObs = observations.filter(o => o.status === 'Diseased' || (o.disease && !o.disease.toLowerCase().includes('healthy')));
  
  // Aggregate real diseases
  const diseaseMap = {};
  diseasedObs.forEach(o => {
    const name = o.disease || 'Unknown foliar disease';
    if (!diseaseMap[name]) {
      diseaseMap[name] = {
        name,
        category: o.pathogen && o.pathogen !== 'Identified pathogen' ? o.pathogen : 'Foliar Pathogen',
        count: 0,
        crops: new Set(),
      };
    }
    diseaseMap[name].count += 1;
    if (o.crop) diseaseMap[name].crops.add(o.crop);
  });

  const diseaseDistribution = Object.values(diseaseMap)
    .sort((a, b) => b.count - a.count)
    .map(d => ({
      ...d,
      cropsList: Array.from(d.crops).join(', '),
      percentage: diseasedObs.length > 0 ? Math.round((d.count / diseasedObs.length) * 100) : 0,
    }));

  // Build authentic temporal trajectory buckets from real observations
  const trajectoryBuckets = React.useMemo(() => {
    if (!observations || observations.length === 0) return [];

    // Group observations by date (YYYY-MM-DD)
    const dateGroups = {};
    observations.forEach(o => {
      const dStr = o.date ? o.date.split(' ')[0] : 'Unknown';
      if (!dateGroups[dStr]) {
        dateGroups[dStr] = { date: dStr, healthy: 0, diseased: 0, total: 0 };
      }
      dateGroups[dStr].total += 1;
      if (o.status === 'Healthy') {
        dateGroups[dStr].healthy += 1;
      } else {
        dateGroups[dStr].diseased += 1;
      }
    });

    const sortedDates = Object.keys(dateGroups).sort();
    return sortedDates.map(k => dateGroups[k]);
  }, [observations]);

  // Max value for trajectory scaling
  const maxTrajectoryScans = Math.max(...trajectoryBuckets.map(b => b.total), 1);

  return (
    <div className="role-page-container regional-analytics-page">
      {/* Header */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#38bdf8' }}>Agronomic Telemetry</span>
          <h1 className="page-main-title">📈 Regional Agriculture Analytics</h1>
          <p className="page-desc">
            Analyze crop distribution, disease prevalence, and agricultural health across available field data.
          </p>
        </div>
        <div className="header-action-group">
          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            className="filter-select"
            aria-label="Select aggregation time window"
            style={{
              background: 'rgba(16, 28, 22, 0.9)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Available Data</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '1.75rem' }}>
        {/* Card 1: Healthy % */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Healthy %</span>
            <span className="kpi-icon-pill green">🌱</span>
          </div>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {loading ? '...' : (healthyPct !== null ? `${healthyPct}%` : 'Data unavailable')}
          </div>
          <div className="kpi-footer text-success">
            {healthyCount} verified healthy {healthyCount === 1 ? 'specimen' : 'specimens'}
          </div>
        </div>

        {/* Card 2: Diseased % */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Diseased %</span>
            <span className="kpi-icon-pill amber">🦠</span>
          </div>
          <div className="kpi-value" style={{ color: '#f87171' }}>
            {loading ? '...' : (diseasedPct !== null ? `${diseasedPct}%` : 'Data unavailable')}
          </div>
          <div className="kpi-footer text-danger">
            {diseasedCount} active pathogen {diseasedCount === 1 ? 'case' : 'cases'}
          </div>
        </div>

        {/* Card 3: Dominant Crop */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Dominant Crop</span>
            <span className="kpi-icon-pill blue">🌾</span>
          </div>
          <div className="kpi-value" style={{ color: '#38bdf8', fontSize: '1.45rem' }}>
            {loading ? '...' : dominantCropName}
          </div>
          <div className="kpi-footer text-info">Primary monitored production crop</div>
        </div>

        {/* Card 4: Survey / Scan Count */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Survey / Scan Count</span>
            <span className="kpi-icon-pill purple">🔬</span>
          </div>
          <div className="kpi-value" style={{ color: '#a78bfa' }}>
            {loading ? '...' : totalScans.toLocaleString()}
          </div>
          <div className="kpi-footer text-accent">Total verified neural inspections</div>
        </div>
      </div>

      {/* Grid: Monitored Crop Distribution & Disease Distribution */}
      <div className="analytics-split-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Monitored Crop Distribution */}
        <div className="dashboard-panel" style={{ background: 'rgba(16, 28, 22, 0.8)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
          <div className="panel-header-row" style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem' }}>
            <div>
              <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                🌾 Monitored Crop Distribution
              </h2>
              <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Monitored crops registered across connected farm holdings
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: '#94a3b8' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
              <span>Loading crop distribution...</span>
            </div>
          ) : rawCropDist.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🌾</span>
              <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>No crop distribution records available.</strong>
              <small style={{ color: '#64748b' }}>Crops will appear as connected producers register their cultivated acreage.</small>
            </div>
          ) : (
            <div className="dist-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {rawCropDist.map((item, idx) => {
                const colors = ['#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#ef4444', '#ec4899'];
                const color = colors[idx % colors.length];
                const pct = item.percentage_share ?? 0;
                const acreageText = item.estimated_acreage_ha ? `${item.estimated_acreage_ha} ha` : 'Acreage unrecorded';

                return (
                  <div
                    key={item.crop_name || idx}
                    className="dist-item-row"
                    onMouseEnter={() => setActiveTooltip(`crop-${idx}`)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    style={{ position: 'relative' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#f8fafc' }}>
                        🌾 {item.crop_name}
                      </strong>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                        {pct}% <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({acreageText})</span>
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.max(4, Math.min(100, pct))}%`,
                          height: '100%',
                          background: color,
                          borderRadius: '999px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>

                    {activeTooltip === `crop-${idx}` && (
                      <div
                        style={{
                          position: 'absolute',
                          right: '0',
                          bottom: '100%',
                          marginBottom: '0.25rem',
                          background: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.75rem',
                          color: '#fff',
                          pointerEvents: 'none',
                          zIndex: 10,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                        }}
                      >
                        {item.crop_name}: {pct}% share • Soil: {item.dominant_soil || 'Alluvial'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Disease & Pathogen Distribution */}
        <div className="dashboard-panel" style={{ background: 'rgba(16, 28, 22, 0.8)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
          <div className="panel-header-row" style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem' }}>
            <div>
              <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                🦠 Disease & Pathogen Distribution
              </h2>
              <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Pathogen incidence across reported diseased specimens
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: '#94a3b8' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
              <span>Loading pathogen distribution...</span>
            </div>
          ) : diseaseDistribution.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🦠</span>
              <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>No disease distribution records available.</strong>
              <small style={{ color: '#64748b' }}>No foliar diseases or pathogen alerts detected on connected farms.</small>
            </div>
          ) : (
            <div className="dist-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {diseaseDistribution.map((item, idx) => {
                const categoryColor = item.category.toLowerCase().includes('fung') ? '#f87171' : item.category.toLowerCase().includes('bact') ? '#a78bfa' : '#fbbf24';

                return (
                  <div
                    key={item.name || idx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#fff', display: 'block' }}>
                          {item.name}
                        </strong>
                        <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.2rem', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: categoryColor,
                              fontWeight: 600,
                            }}
                          >
                            {item.category}
                          </span>
                          {item.cropsList && (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              Crops: {item.cropsList}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '0.98rem', color: '#f87171' }}>{item.percentage}%</strong>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.count} {item.count === 1 ? 'case' : 'cases'}</div>
                      </div>
                    </div>

                    <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.max(5, Math.min(100, item.percentage))}%`,
                          height: '100%',
                          background: categoryColor,
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Disease Detection Trajectory Over Time (Interactive Chart) */}
      <div className="dashboard-panel" style={{ background: 'rgba(16, 28, 22, 0.8)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
        <div className="panel-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              📈 Disease Detection Trajectory Over Time
            </h2>
            <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
              Volume comparison of healthy vs diseased field diagnoses grouped across recorded scan intervals
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#34d399' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
              Healthy
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#f87171' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f87171', display: 'inline-block' }}></span>
              Diseased
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: '#94a3b8' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
            <span>Plotting trajectory timeline...</span>
          </div>
        ) : trajectoryBuckets.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
            <span style={{ fontSize: '2.2rem', display: 'block', marginBottom: '0.5rem' }}>📉</span>
            <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>No historical scan trajectory recorded yet.</strong>
            <small style={{ color: '#64748b' }}>A multi-series chart will be plotted as temporal scans are recorded for connected farms.</small>
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
            {/* SVG Interactive Chart */}
            <svg
              viewBox={`0 0 ${Math.max(600, trajectoryBuckets.length * 120)} 240`}
              style={{ width: '100%', height: '240px', overflow: 'visible' }}
            >
              {/* Background Grid Lines */}
              <line x1="50" y1="30" x2="100%" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="50" y1="90" x2="100%" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="50" y1="150" x2="100%" y2="150" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="50" y1="200" x2="100%" y2="200" stroke="rgba(255,255,255,0.15)" />

              {/* Y-Axis Labels */}
              <text x="40" y="34" fill="#64748b" fontSize="10" textAnchor="end">{maxTrajectoryScans}</text>
              <text x="40" y="94" fill="#64748b" fontSize="10" textAnchor="end">{Math.round(maxTrajectoryScans * 0.66)}</text>
              <text x="40" y="154" fill="#64748b" fontSize="10" textAnchor="end">{Math.round(maxTrajectoryScans * 0.33)}</text>
              <text x="40" y="204" fill="#64748b" fontSize="10" textAnchor="end">0</text>

              {/* Trajectory Columns */}
              {trajectoryBuckets.map((bucket, bIdx) => {
                const colWidth = 40;
                const totalWidth = Math.max(600, trajectoryBuckets.length * 120);
                const step = (totalWidth - 100) / Math.max(1, trajectoryBuckets.length);
                const x = 70 + bIdx * step;

                const healthyH = (bucket.healthy / maxTrajectoryScans) * 160;
                const diseasedH = (bucket.diseased / maxTrajectoryScans) * 160;

                const healthyY = 200 - healthyH;
                const diseasedY = 200 - diseasedH;

                return (
                  <g
                    key={bucket.date}
                    className="chart-col-group"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setActiveTooltip(`traj-${bIdx}`)}
                    onMouseLeave={() => setActiveTooltip(null)}
                  >
                    {/* Healthy Bar */}
                    <rect
                      x={x - colWidth / 2}
                      y={healthyY}
                      width={colWidth / 2 - 2}
                      height={Math.max(2, healthyH)}
                      fill="#34d399"
                      rx="3"
                      opacity="0.85"
                    />

                    {/* Diseased Bar */}
                    <rect
                      x={x + 2}
                      y={diseasedY}
                      width={colWidth / 2 - 2}
                      height={Math.max(2, diseasedH)}
                      fill="#f87171"
                      rx="3"
                      opacity="0.85"
                    />

                    {/* X-Axis Date Label */}
                    <text
                      x={x}
                      y="218"
                      fill="#94a3b8"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {bucket.date}
                    </text>
                    <text
                      x={x}
                      y="232"
                      fill="#64748b"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {bucket.total} scans
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {activeTooltip && activeTooltip.startsWith('traj-') && (() => {
              const idx = parseInt(activeTooltip.replace('traj-', ''), 10);
              const b = trajectoryBuckets[idx];
              if (!b) return null;
              return (
                <div
                  style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: '8px',
                    padding: '0.6rem 1rem',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}
                >
                  <strong style={{ color: '#fff', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                    {b.date} ({b.total} Total Scans)
                  </strong>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                    <span style={{ color: '#34d399' }}>🟢 Healthy: {b.healthy}</span>
                    <span style={{ color: '#f87171' }}>🔴 Diseased: {b.diseased}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
