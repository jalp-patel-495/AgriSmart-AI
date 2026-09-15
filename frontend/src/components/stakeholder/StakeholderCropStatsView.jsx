import React, { useState, useEffect, useMemo } from 'react';
import { authApi } from '../../services/authApi';

export default function StakeholderCropStatsView() {
  const [statsData, setStatsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [sortField, setSortField] = useState('crop');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const fetchCropStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authApi.getStakeholderCropStatistics();
        if (res && res.crop_stats) {
          setStatsData(res.crop_stats);
        } else {
          setStatsData([]);
        }
      } catch (err) {
        console.error('Failed to load crop statistics:', err);
        setError('Unable to retrieve agronomic crop statistics.');
      } finally {
        setLoading(false);
      }
    };
    fetchCropStats();
  }, []);

  // Crop Species Icon Resolver
  const getCropIcon = (cropName = '') => {
    const lower = cropName.toLowerCase();
    if (lower.includes('tomato')) return '🍅';
    if (lower.includes('potato')) return '🥔';
    if (lower.includes('corn') || lower.includes('maize')) return '🌽';
    if (lower.includes('apple')) return '🍎';
    if (lower.includes('grape')) return '🍇';
    if (lower.includes('pepper')) return '🫑';
    if (lower.includes('rice') || lower.includes('paddy')) return '🌾';
    if (lower.includes('wheat')) return '🌾';
    if (lower.includes('cotton')) return '☁️';
    return '🌱';
  };

  // Water Stress Badge Renderer
  const renderWaterStressBadge = (stress) => {
    if (!stress || stress === 'Data unavailable') {
      return (
        <span className="badge-pill-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', background: 'rgba(255, 255, 255, 0.06)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          ⚪ Data unavailable
        </span>
      );
    }
    const lower = String(stress).toLowerCase();
    if (lower.includes('optimal') || lower.includes('adequate') || lower.includes('low')) {
      return (
        <span className="badge-pill-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          🟢 {stress}
        </span>
      );
    }
    if (lower.includes('moderate') || lower.includes('scheduled')) {
      return (
        <span className="badge-pill-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
          🟡 {stress}
        </span>
      );
    }
    return (
      <span className="badge-pill-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        🔴 {stress}
      </span>
    );
  };

  // Health Score Progress Indicator
  const renderHealthScore = (score, formattedStr) => {
    if (score === null || score === undefined || formattedStr === 'Data unavailable') {
      return <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Data unavailable</span>;
    }
    const num = typeof score === 'number' ? score : parseInt(score, 10);
    const color = num >= 80 ? '#34d399' : num >= 60 ? '#fbbf24' : '#f87171';

    return (
      <div style={{ minWidth: '120px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
          <span style={{ color: '#94a3b8' }}>Health</span>
          <strong style={{ color }}>{num}%</strong>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.max(4, Math.min(100, num))}%`,
              height: '100%',
              background: color,
              borderRadius: '999px',
            }}
          />
        </div>
      </div>
    );
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered and sorted dataset
  const processedData = useMemo(() => {
    return statsData
      .filter((item) => {
        const matchesSearch = !searchQuery || item.crop.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCrop = !selectedCrop || item.crop === selectedCrop;
        return matchesSearch && matchesCrop;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'monitored_acreage') {
          valA = a.monitored_acreage ?? -1;
          valB = b.monitored_acreage ?? -1;
        } else if (sortField === 'health_score') {
          valA = a.health_score ?? -1;
          valB = b.health_score ?? -1;
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [statsData, searchQuery, selectedCrop, sortField, sortDirection]);

  // Unique crops for filter dropdown
  const uniqueCrops = useMemo(() => {
    return Array.from(new Set(statsData.map((d) => d.crop))).sort();
  }, [statsData]);

  return (
    <div className="role-page-container crop-statistics-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#38bdf8' }}>Agronomic Benchmarking</span>
          <h1 className="page-main-title">🌾 Crop Statistics & Agronomic Registry</h1>
          <p className="page-desc">
            Granular yield telemetry, acreage estimations, and water demand across registered production sectors.
          </p>
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Filter & Search Toolbar */}
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
              placeholder="Search crop species..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-text-input"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          {/* Crop Selector */}
          <select
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
            className="filter-select"
            aria-label="Filter by Crop"
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
            <option value="">All Monitored Crops ({statsData.length})</option>
            {uniqueCrops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {(searchQuery || selectedCrop) && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => {
              setSearchQuery('');
              setSelectedCrop('');
            }}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table Panel */}
      <div
        className="panel-card table-panel"
        style={{
          background: 'rgba(16, 28, 22, 0.8)',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          borderRadius: '16px',
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="table-responsive" style={{ width: '100%', overflowX: 'auto' }}>
          <table className="role-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.45)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th
                  onClick={() => handleSort('crop')}
                  style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Crop Species {sortField === 'crop' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('monitored_acreage')}
                  style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Monitored Area {sortField === 'monitored_acreage' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('estimated_yield')}
                  style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Estimated Yield {sortField === 'estimated_yield' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('health_score')}
                  style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Health Score {sortField === 'health_score' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('water_stress')}
                  style={{ padding: '1rem', cursor: 'pointer', userSelect: 'none', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Water Stress {sortField === 'water_stress' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Economic Value
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
                    <span>Loading agronomic registry...</span>
                  </td>
                </tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🌾</span>
                    <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>
                      {searchQuery || selectedCrop ? 'No crops match your filter criteria.' : 'No crops registered for connected farms.'}
                    </strong>
                    <small style={{ color: '#64748b' }}>Crop statistics update automatically as connected farmers log field telemetry.</small>
                  </td>
                </tr>
              ) : (
                processedData.map((item) => (
                  <tr
                    key={item.crop}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '0.95rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{getCropIcon(item.crop)}</span>
                        <div>
                          <strong style={{ color: '#f8fafc', fontSize: '0.92rem', display: 'block' }}>{item.crop}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {item.total_scans ? `${item.total_scans} scans recorded` : 'Monitored species'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.95rem 1rem', color: '#cbd5e1' }}>
                      {item.acreage_formatted || (item.monitored_acreage ? `${item.monitored_acreage} ha` : 'Data unavailable')}
                    </td>
                    <td style={{ padding: '0.95rem 1rem', color: '#cbd5e1' }}>
                      {item.estimated_yield || 'Data unavailable'}
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      {renderHealthScore(item.health_score, item.health_score_formatted)}
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      {renderWaterStressBadge(item.water_stress)}
                    </td>
                    <td style={{ padding: '0.95rem 1rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        {item.economic_value || 'Data unavailable'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
