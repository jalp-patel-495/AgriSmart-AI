import React, { useState, useEffect, useMemo } from 'react';
import { authApi } from '../../services/authApi';

export default function StakeholderActivityView() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedType, setSelectedType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.getStakeholderActivity(60);
      if (data && data.activities) {
        setActivities(data.activities);
      } else {
        setActivities([]);
      }
    } catch (err) {
      console.error('Failed to load stakeholder activity ledger:', err);
      setError('Unable to load sector activity ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchesType = selectedType === 'ALL' || act.type.toUpperCase() === selectedType;
      const matchesSearch =
        !searchQuery ||
        (act.title && act.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (act.description && act.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (act.crop && act.crop.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (act.farmer_name && act.farmer_name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [activities, selectedType, searchQuery]);

  return (
    <div className="role-page-container stakeholder-activity-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#38bdf8' }}>Audit Trail</span>
          <h1 className="page-main-title">⚡ Sector Real-Time Activity Ledger</h1>
          <p className="page-desc">
            Chronological audit ledger from connected farm nodes, diagnostic inferences, and field telemetry.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={fetchActivities}
            title="Refresh latest telemetry ledger"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            🔄 Refresh Ledger
          </button>
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️ {error}</span>
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
              placeholder="Search by crop, title, or producer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-text-input"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          {/* Event Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="filter-select"
            aria-label="Filter by Event Type"
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
            <option value="ALL">All Event Types ({activities.length})</option>
            <option value="DISEASE">🔬 Disease Diagnostics</option>
            <option value="IRRIGATION">💧 Smart Irrigation</option>
            <option value="CROP_REC">🌾 Crop Recommendations</option>
          </select>
        </div>

        {(searchQuery || selectedType !== 'ALL') && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => {
              setSearchQuery('');
              setSelectedType('ALL');
            }}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Activity Timeline */}
      {loading ? (
        <div style={{ padding: '3rem 0', textAlign: 'center', color: '#94a3b8' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
          <span>Streaming field activity ledger...</span>
        </div>
      ) : filteredActivities.length === 0 ? (
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
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📭</span>
          <strong style={{ color: '#e2e8f0', fontSize: '1.1rem', display: 'block', marginBottom: '0.35rem' }}>
            {searchQuery || selectedType !== 'ALL'
              ? 'No activity records match your filter criteria.'
              : 'No activity recorded yet'}
          </strong>
          <small style={{ color: '#64748b' }}>
            Real system activity will appear here as field data is recorded.
          </small>
        </div>
      ) : (
        <div
          className="panel-card"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.75rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="activity-detailed-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
            {filteredActivities.map((act, index) => {
              const icon = act.icon || (act.type === 'IRRIGATION' ? '💧' : act.type === 'CROP_REC' ? '🌾' : '🔬');
              const typeLabel =
                act.type === 'IRRIGATION'
                  ? 'Smart Irrigation'
                  : act.type === 'CROP_REC'
                  ? 'Crop Recommendation'
                  : 'Disease Diagnostic';
              const typeColor =
                act.type === 'IRRIGATION'
                  ? '#38bdf8'
                  : act.type === 'CROP_REC'
                  ? '#fbbf24'
                  : '#34d399';

              return (
                <div
                  key={act.id || index}
                  className="timeline-entry"
                  style={{
                    display: 'flex',
                    gap: '1.25rem',
                    alignItems: 'flex-start',
                    position: 'relative',
                  }}
                >
                  {/* Left Node & Stem */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: `1px solid ${typeColor}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        boxShadow: `0 0 12px ${typeColor}20`,
                      }}
                    >
                      {icon}
                    </div>
                    {index < filteredActivities.length - 1 && (
                      <div
                        style={{
                          width: '2px',
                          height: 'calc(100% - 10px)',
                          minHeight: '24px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          marginTop: '6px',
                        }}
                      />
                    )}
                  </div>

                  {/* Body Card */}
                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '1.1rem 1.25rem',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.35)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            background: `${typeColor}20`,
                            color: typeColor,
                            border: `1px solid ${typeColor}40`,
                          }}
                        >
                          {typeLabel}
                        </span>
                        <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>
                          {act.title}
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        ● {act.timestamp}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                      {act.description}
                    </p>

                    <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.65rem', alignItems: 'center' }}>
                      {act.farmer_name && (
                        <span style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                          👨‍🌾 {act.farmer_name}
                        </span>
                      )}
                      {act.farm_name && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.04)', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                          🏡 {act.farm_name}
                        </span>
                      )}
                      {act.crop && (
                        <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                          🌱 {act.crop}
                        </span>
                      )}
                      {act.status && (
                        <span style={{ fontSize: '0.75rem', color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                          Status: {act.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
