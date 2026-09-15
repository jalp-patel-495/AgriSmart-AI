import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { roleApi } from '../../services/roleApi';

export default function ExpertDiseaseCases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cropFilter, setCropFilter] = useState('');
  const [dateRange, setDateRange] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const pageSize = 10;

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roleApi.getExpertCases(statusFilter, cropFilter);
      setCases(data || []);
    } catch (err) {
      console.error('Failed to load expert cases:', err);
      setError('Unable to retrieve disease cases registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [statusFilter, cropFilter]);

  // Unique crops from cases
  const uniqueCrops = useMemo(() => {
    return Array.from(new Set(cases.map((c) => c.crop).filter(Boolean))).sort();
  }, [cases]);

  // Filtered & Sorted Cases
  const processedCases = useMemo(() => {
    return cases
      .filter((c) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !searchQuery ||
          (c.crop && c.crop.toLowerCase().includes(q)) ||
          (c.disease && c.disease.toLowerCase().includes(q)) ||
          String(c.id).includes(q) ||
          (c.farmer_name && c.farmer_name.toLowerCase().includes(q));

        let matchesDate = true;
        if (dateRange !== 'ALL' && c.created_at) {
          const caseDate = new Date(c.created_at);
          const now = new Date();
          const diffDays = (now - caseDate) / (1000 * 60 * 60 * 24);
          if (dateRange === '7D') matchesDate = diffDays <= 7;
          else if (dateRange === '30D') matchesDate = diffDays <= 30;
          else if (dateRange === '90D') matchesDate = diffDays <= 90;
        }

        return matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'id') {
          valA = a.id;
          valB = b.id;
        } else if (sortField === 'confidence') {
          valA = a.confidence_score ?? parseFloat(a.confidence) / 100 ?? 0;
          valB = b.confidence_score ?? parseFloat(b.confidence) / 100 ?? 0;
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [cases, searchQuery, dateRange, sortField, sortDirection]);

  // Paginated records
  const totalPages = Math.ceil(processedCases.length / pageSize) || 1;
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedCases.slice(start, start + pageSize);
  }, [processedCases, currentPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Export CSV of currently filtered cases
  const handleExportCSV = () => {
    if (processedCases.length === 0) return;
    const headers = ['Case ID', 'Date & Time', 'Crop', 'Detected Condition', 'AI Confidence', 'Review Status', 'Producer'];
    const rows = processedCases.map((c) => [
      c.id,
      `"${c.created_at || 'Recent'}"`,
      `"${c.crop}"`,
      `"${c.disease}"`,
      `"${typeof c.confidence === 'number' ? `${Math.round(c.confidence <= 1 ? c.confidence * 100 : c.confidence)}%` : c.confidence}"`,
      `"${c.expert_status || 'PENDING'}"`,
      `"${c.farmer_name || 'Farmer'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AgriSmart_Disease_Cases_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="role-page-container expert-cases-registry-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#818cf8' }}>Field Case Queue</span>
          <h1 className="page-main-title">🔬 Farmer Disease Cases Registry</h1>
          <p className="page-desc">
            Search, filter, and review incoming field diagnostic submissions from connected farmers.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#6366f1' }}
            onClick={() => navigate('/expert/diagnosis-review')}
          >
            ✍️ Open Diagnosis Review Studio
          </button>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={handleExportCSV}
            disabled={processedCases.length === 0}
          >
            📥 Export CSV
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
          {/* Search Query */}
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
              placeholder="Search crop, disease, or case ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-text-input"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-select"
            aria-label="Filter by Case Status"
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
            <option value="ALL">All Case Statuses</option>
            <option value="PENDING">🟡 Pending Review</option>
            <option value="CONFIRMED">🟢 Confirmed Diagnoses</option>
            <option value="REJECTED">🔴 Overridden / Rejected</option>
          </select>

          {/* Crop Filter */}
          <select
            value={cropFilter}
            onChange={(e) => {
              setCropFilter(e.target.value);
              setCurrentPage(1);
            }}
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
            <option value="">All Monitored Crops ({uniqueCrops.length})</option>
            {uniqueCrops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-select"
            aria-label="Filter by Date Range"
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
            <option value="ALL">All Available Dates</option>
            <option value="7D">Last 7 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="90D">Last Quarter</option>
          </select>
        </div>

        {(searchQuery || statusFilter !== 'ALL' || cropFilter || dateRange !== 'ALL') && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setCropFilter('');
              setDateRange('ALL');
              setCurrentPage(1);
            }}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Cases Table */}
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
                  onClick={() => handleSort('id')}
                  style={{ padding: '0.95rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Case ID {sortField === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('created_at')}
                  style={{ padding: '0.95rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Date & Time {sortField === 'created_at' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('crop')}
                  style={{ padding: '0.95rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Crop {sortField === 'crop' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('disease')}
                  style={{ padding: '0.95rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Detected Condition {sortField === 'disease' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('confidence')}
                  style={{ padding: '0.95rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  AI Confidence {sortField === 'confidence' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '0.95rem 1rem', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Review Status
                </th>
                <th style={{ padding: '0.95rem 1rem', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
                    <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
                    <span>Loading disease registry...</span>
                  </td>
                </tr>
              ) : processedCases.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📂</span>
                    <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>
                      {searchQuery || cropFilter || statusFilter !== 'ALL'
                        ? 'No cases match your active filter criteria.'
                        : 'No disease cases recorded yet.'}
                    </strong>
                    <small style={{ color: '#64748b' }}>Diagnostic cases will appear here as field scans are uploaded.</small>
                  </td>
                </tr>
              ) : (
                paginatedCases.map((item) => {
                  const rawConf = typeof item.confidence_score === 'number'
                    ? item.confidence_score
                    : parseFloat(item.confidence) / 100 || 0.85;
                  const confNum = Math.round(rawConf <= 1 ? rawConf * 100 : rawConf);
                  const isLowConf = confNum < 65;

                  const normStatus = (item.expert_status || (item.expert_reviewed ? 'CONFIRMED' : 'PENDING')).toUpperCase();
                  let badgeLabel = '🟡 Pending';
                  let badgeColor = '#fbbf24';
                  let badgeBg = 'rgba(251, 191, 36, 0.15)';
                  let badgeBorder = 'rgba(251, 191, 36, 0.3)';

                  if (normStatus === 'CONFIRMED' || normStatus === 'CORRECTED') {
                    badgeLabel = '🟢 Confirmed';
                    badgeColor = '#34d399';
                    badgeBg = 'rgba(16, 185, 129, 0.15)';
                    badgeBorder = 'rgba(16, 185, 129, 0.3)';
                  } else if (normStatus === 'REJECTED') {
                    badgeLabel = '🔴 Rejected';
                    badgeColor = '#f87171';
                    badgeBg = 'rgba(239, 68, 68, 0.15)';
                    badgeBorder = 'rgba(239, 68, 68, 0.3)';
                  }

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <code style={{ color: '#818cf8', background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                          #{item.id}
                        </code>
                      </td>
                      <td style={{ padding: '0.95rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                        {item.created_at || 'Recent'}
                      </td>
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>🌾 {item.crop}</strong>
                      </td>
                      <td style={{ padding: '0.95rem 1rem', color: '#e2e8f0', fontSize: '0.88rem' }}>
                        <div>{item.disease}</div>
                        {isLowConf && (
                          <span style={{ fontSize: '0.72rem', color: '#f87171', display: 'block', marginTop: '0.15rem' }}>
                            ⚠️ Under 65% Threshold
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <div style={{ minWidth: '100px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                            <span style={{ color: isLowConf ? '#f87171' : '#34d399', fontWeight: 700 }}>
                              {confNum}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.max(5, Math.min(100, confNum))}%`,
                                height: '100%',
                                background: isLowConf ? '#f87171' : '#34d399',
                                borderRadius: '999px',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.95rem 1rem' }}>
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
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <button
                          type="button"
                          className="btn-table-action"
                          style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            borderColor: 'rgba(99, 102, 241, 0.35)',
                            color: '#c7d2fe',
                            fontSize: '0.8rem',
                            padding: '0.35rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => navigate('/expert/diagnosis-review', { state: { selectedCaseId: item.id } })}
                        >
                          Review Case →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Showing {Math.min(processedCases.length, (currentPage - 1) * pageSize + 1)}–{Math.min(processedCases.length, currentPage * pageSize)} of {processedCases.length} cases
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary-outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              >
                ◀ Previous
              </button>
              <button
                type="button"
                className="btn-secondary-outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              >
                Next ▶
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
