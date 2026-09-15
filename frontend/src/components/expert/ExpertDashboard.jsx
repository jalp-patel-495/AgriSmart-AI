import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { roleApi } from '../../services/roleApi';

export default function ExpertDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [allCases, setAllCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for Triage Queue
  const [searchQuery, setSearchQuery] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  useEffect(() => {
    const fetchExpertData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsData, cases] = await Promise.all([
          roleApi.getExpertDashboardStats(),
          roleApi.getExpertCases('ALL'),
        ]);
        setStats(statsData);
        setAllCases(cases || []);
      } catch (err) {
        console.error('Failed to load expert dashboard:', err);
        setError(err.message || 'Unable to retrieve agronomic triage data.');
      } finally {
        setLoading(false);
      }
    };
    fetchExpertData();
  }, []);

  // Real KPI values
  const totalCount = stats?.total_cases ?? allCases.length;
  const pendingCount = stats?.pending_cases ?? allCases.filter(c => !c.expert_reviewed && c.expert_status !== 'CONFIRMED' && c.expert_status !== 'REJECTED' && c.expert_status !== 'CORRECTED').length;
  const reviewedCount = stats?.reviewed_cases ?? allCases.filter(c => c.expert_reviewed || c.expert_status === 'CONFIRMED' || c.expert_status === 'REJECTED' || c.expert_status === 'CORRECTED').length;

  // Real Consensus Rate calculation from actual reviewed cases
  const reviewedCasesList = allCases.filter(c => c.expert_reviewed || c.expert_status === 'CONFIRMED' || c.expert_status === 'REJECTED' || c.expert_status === 'CORRECTED');
  const confirmedCount = allCases.filter(c => c.expert_status === 'CONFIRMED').length;
  const consensusRateDisplay = reviewedCasesList.length > 0
    ? `${Math.round((confirmedCount / reviewedCasesList.length) * 100)}%`
    : 'Data unavailable';

  // Unique crops for filter
  const uniqueCrops = useMemo(() => {
    return Array.from(new Set(allCases.map(c => c.crop).filter(Boolean))).sort();
  }, [allCases]);

  // Filtered Cases for Triage Queue
  const filteredCases = useMemo(() => {
    return allCases.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        (c.crop && c.crop.toLowerCase().includes(q)) ||
        (c.disease && c.disease.toLowerCase().includes(q)) ||
        String(c.id).includes(q);

      const matchesCrop = !cropFilter || c.crop === cropFilter;

      const normStatus = (c.expert_status || (c.expert_reviewed ? 'CONFIRMED' : 'PENDING')).toUpperCase();
      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && (normStatus === 'PENDING' || !c.expert_reviewed)) ||
        (statusFilter === 'REVIEWED' && (normStatus === 'CONFIRMED' || normStatus === 'CORRECTED' || c.expert_reviewed)) ||
        (statusFilter === 'ESCALATED' && normStatus === 'REJECTED');

      let matchesDate = true;
      if (dateFilter !== 'ALL' && c.created_at) {
        const caseDate = new Date(c.created_at);
        const now = new Date();
        const diffDays = (now - caseDate) / (1000 * 60 * 60 * 24);
        if (dateFilter === '7D') matchesDate = diffDays <= 7;
        else if (dateFilter === '30D') matchesDate = diffDays <= 30;
      }

      return matchesSearch && matchesCrop && matchesStatus && matchesDate;
    });
  }, [allCases, searchQuery, cropFilter, statusFilter, dateFilter]);

  return (
    <div className="role-page-container expert-dashboard-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#818cf8' }}>Agronomic Panel</span>
          <h1 className="page-main-title">🔬 Expert Clinical Dashboard</h1>
          <p className="page-desc">
            Review field disease cases, validate AI-assisted diagnoses, and provide agronomic guidance.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#6366f1' }}
            onClick={() => navigate('/expert/cases')}
          >
            📋 View All Cases
          </button>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => navigate('/expert/queries')}
          >
            💬 Farmer Queries
          </button>
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginLeft: '1rem', background: 'transparent', border: '1px solid currentColor', color: 'inherit', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '1.75rem' }}>
        {/* Card 1: Pending Reviews */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Pending Reviews</span>
            <span className="kpi-icon-pill amber">⏳</span>
          </div>
          <div className="kpi-value" style={{ color: '#fbbf24' }}>
            {loading ? '...' : pendingCount}
          </div>
          <div className="kpi-footer text-warning">Awaiting agronomist validation</div>
        </div>

        {/* Card 2: Reviewed Cases */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Reviewed Cases</span>
            <span className="kpi-icon-pill green">✅</span>
          </div>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {loading ? '...' : reviewedCount}
          </div>
          <div className="kpi-footer text-success">Confirmed or corrected cases</div>
        </div>

        {/* Card 3: Total Submissions */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Submissions</span>
            <span className="kpi-icon-pill purple">📋</span>
          </div>
          <div className="kpi-value" style={{ color: '#c084fc' }}>
            {loading ? '...' : totalCount}
          </div>
          <div className="kpi-footer text-muted">Field diagnostic records on file</div>
        </div>

        {/* Card 4: AI Consensus Rate */}
        <div className="kpi-metric-card">
          <div className="kpi-top">
            <span className="kpi-label">AI Consensus Rate</span>
            <span className="kpi-icon-pill blue">🧠</span>
          </div>
          <div className="kpi-value" style={{ color: '#818cf8' }}>
            {loading ? '...' : consensusRateDisplay}
          </div>
          <div className="kpi-footer text-accent">
            {reviewedCasesList.length > 0 ? 'Agronomist confirmation rate' : 'No reviewed cases yet'}
          </div>
        </div>
      </div>

      {/* Main 2-Column Section: Triage Queue & Farmer Queries */}
      <div className="dashboard-double-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        
        {/* Triage Queue Panel */}
        <div className="dashboard-panel main-panel" style={{ background: 'rgba(16, 28, 22, 0.8)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
          <div className="panel-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem' }}>
            <div>
              <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                ⚡ Triage Queue & Incoming Cases
              </h2>
              <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Farmer plant specimens awaiting review
              </p>
            </div>
            <Link to="/expert/cases" className="panel-link" style={{ fontSize: '0.82rem', color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>
              View All Cases →
            </Link>
          </div>

          {/* Queue Filter Bar */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search crop or disease..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '0.4rem 0.75rem',
                color: '#fff',
                fontSize: '0.82rem',
                flex: '1 1 140px',
                outline: 'none',
              }}
            />

            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              aria-label="Filter by Crop"
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                color: '#fff',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <option value="">All Crops</option>
              {uniqueCrops.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                color: '#fff',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">🟡 Pending</option>
              <option value="REVIEWED">🟢 Reviewed</option>
              <option value="ESCALATED">🔴 Escalated</option>
            </select>

            {(searchQuery || cropFilter || statusFilter !== 'ALL' || dateFilter !== 'ALL') && (
              <button
                type="button"
                className="btn-secondary-outline"
                onClick={() => {
                  setSearchQuery('');
                  setCropFilter('');
                  setStatusFilter('ALL');
                  setDateFilter('ALL');
                }}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: '2.5rem 0', textAlign: 'center', color: '#94a3b8' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
              <span>Loading case queue...</span>
            </div>
          ) : filteredCases.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📂</span>
              <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>No Cases in Queue</strong>
              <small style={{ color: '#64748b' }}>
                {searchQuery || cropFilter || statusFilter !== 'ALL' ? 'No cases match your active filters.' : 'All incoming specimens have been triaged.'}
              </small>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="role-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 0, 0, 0.45)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Case ID</th>
                    <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Date & Time</th>
                    <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Crop</th>
                    <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>AI Classification</th>
                    <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>AI Confidence</th>
                    <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Review Status</th>
                    <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.slice(0, 6).map((c) => {
                    const rawConf = typeof c.confidence_score === 'number'
                      ? c.confidence_score
                      : parseFloat(c.confidence) / 100 || 0.85;
                    const confNum = Math.round(rawConf <= 1 ? rawConf * 100 : rawConf);
                    const isLowConfidence = confNum < 65;

                    const normStatus = (c.expert_status || (c.expert_reviewed ? 'CONFIRMED' : 'PENDING')).toUpperCase();
                    let badgeLabel = '🟡 Pending';
                    let badgeColor = '#fbbf24';
                    let badgeBg = 'rgba(251, 191, 36, 0.15)';
                    let badgeBorder = 'rgba(251, 191, 36, 0.3)';

                    if (normStatus === 'CONFIRMED' || normStatus === 'CORRECTED') {
                      badgeLabel = '🟢 Reviewed';
                      badgeColor = '#34d399';
                      badgeBg = 'rgba(16, 185, 129, 0.15)';
                      badgeBorder = 'rgba(16, 185, 129, 0.3)';
                    } else if (normStatus === 'REJECTED') {
                      badgeLabel = '🔴 Escalated';
                      badgeColor = '#f87171';
                      badgeBg = 'rgba(239, 68, 68, 0.15)';
                      badgeBorder = 'rgba(239, 68, 68, 0.3)';
                    }

                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          background: isLowConfidence ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '0.85rem' }}>
                          <code style={{ color: '#818cf8', fontSize: '0.8rem' }}>#{c.id}</code>
                        </td>
                        <td style={{ padding: '0.85rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recent'}
                        </td>
                        <td style={{ padding: '0.85rem' }}>
                          <strong style={{ color: '#fff' }}>🌾 {c.crop}</strong>
                        </td>
                        <td style={{ padding: '0.85rem', color: '#e2e8f0' }}>
                          <div>{c.disease}</div>
                          {isLowConfidence && (
                            <span style={{ fontSize: '0.72rem', color: '#f87171', display: 'block', marginTop: '0.15rem' }}>
                              ⚠️ Low Confidence Gate
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ minWidth: '90px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                              <span style={{ color: isLowConfidence ? '#f87171' : '#34d399', fontWeight: 600 }}>
                                {confNum}%
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.max(5, Math.min(100, confNum))}%`,
                                  height: '100%',
                                  background: isLowConfidence ? '#f87171' : '#34d399',
                                  borderRadius: '999px',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: badgeBg,
                              color: badgeColor,
                              border: `1px solid ${badgeBorder}`,
                            }}
                          >
                            {badgeLabel}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem' }}>
                          <button
                            type="button"
                            className="btn-table-action"
                            style={{
                              background: 'rgba(99, 102, 241, 0.15)',
                              borderColor: 'rgba(99, 102, 241, 0.35)',
                              color: '#c7d2fe',
                              fontSize: '0.78rem',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => navigate('/expert/diagnosis-review', { state: { selectedCaseId: c.id } })}
                          >
                            Review Case →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side Panel: Recent Farmer Queries */}
        <div className="dashboard-panel side-panel" style={{ background: 'rgba(16, 28, 22, 0.8)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
          <div className="panel-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem' }}>
            <div>
              <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                💬 Recent Farmer Queries
              </h2>
              <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                Field consultations and advisory requests
              </p>
            </div>
            <Link to="/expert/queries" className="panel-link" style={{ fontSize: '0.82rem', color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>
              All Queries →
            </Link>
          </div>

          {/* Genuine Empty State - Zero Fabrication */}
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.65rem' }}>💬</span>
            <strong style={{ color: '#e2e8f0', fontSize: '1.05rem', display: 'block', marginBottom: '0.35rem' }}>
              No farmer queries
            </strong>
            <small style={{ color: '#64748b', display: 'block', maxWidth: '300px', margin: '0 auto', lineHeight: 1.45 }}>
              New farmer advisory requests will appear here as producers submit consultations from their mobile field app.
            </small>
            <div style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-secondary-outline"
                onClick={() => navigate('/expert/cases')}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
              >
                Inspect Disease Cases Registry
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
