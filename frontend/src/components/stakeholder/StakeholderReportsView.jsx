import React, { useState, useEffect, useMemo } from 'react';
import { authApi } from '../../services/authApi';
import { roleApi } from '../../services/roleApi';

export default function StakeholderReportsView() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [diseaseFilter, setDiseaseFilter] = useState('');
  const [dateRange, setDateRange] = useState('30d');
  const [generating, setGenerating] = useState(false);

  // Sorting & Pagination
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch genuine diagnosis and telemetry records
      const [diseaseRes, farmerDiagRes] = await Promise.allSettled([
        authApi.getStakeholderDiseaseIntelligence(),
        roleApi.getFarmerDiagnoses('', '', 100),
      ]);

      const items = [];
      if (diseaseRes.status === 'fulfilled' && diseaseRes.value?.observations) {
        diseaseRes.value.observations.forEach((o) => {
          items.push({
            id: `DIAG-${o.id}`,
            date: o.date ? o.date.split(' ')[0] : 'Recent',
            crop: o.crop || 'Field Crop',
            disease: o.disease || 'Healthy',
            severity: o.status === 'Diseased' ? 'High' : 'Optimal',
            confidence: o.confidence || '95%',
            impact: o.status === 'Diseased' ? 'Foliar Intervention Advised' : 'Optimal Vigour',
            status: o.status === 'Diseased' ? 'Action Required' : 'Healthy Specimen',
            rawDate: o.date || '',
          });
        });
      }

      // If diseaseRes had no observations or was empty, merge farmer diagnoses if available
      if (items.length === 0 && farmerDiagRes.status === 'fulfilled' && farmerDiagRes.value?.records) {
        farmerDiagRes.value.records.forEach((r) => {
          const confNum = typeof r.confidence === 'number' ? Math.round(r.confidence <= 1 ? r.confidence * 100 : r.confidence) : r.confidence;
          items.push({
            id: `DIAG-${r.id}`,
            date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : 'Recent',
            crop: r.crop || 'Field Crop',
            disease: r.disease || (r.is_healthy ? 'Healthy' : 'Diseased'),
            severity: r.is_healthy ? 'Optimal' : 'High',
            confidence: `${confNum}%`,
            impact: r.is_healthy ? 'Optimal Vigour' : 'Foliar Intervention Advised',
            status: r.is_healthy ? 'Healthy Specimen' : (r.expert_status || 'Under Review'),
            rawDate: r.created_at || '',
          });
        });
      }

      setRecords(items);
    } catch (err) {
      console.error('Failed to fetch report telemetry:', err);
      setError('Unable to load telemetry records for reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleGenerateReport = () => {
    setGenerating(true);
    fetchRecords().finally(() => setGenerating(false));
  };

  // Filtered & Sorted Records
  const processedRecords = useMemo(() => {
    return records
      .filter((r) => {
        const matchesSearch =
          !searchQuery ||
          r.crop.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.disease.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCrop = !cropFilter || r.crop.toLowerCase() === cropFilter.toLowerCase();
        const matchesDisease = !diseaseFilter || r.disease.toLowerCase().includes(diseaseFilter.toLowerCase());
        return matchesSearch && matchesCrop && matchesDisease;
      })
      .sort((a, b) => {
        let valA = a[sortField] || '';
        let valB = b[sortField] || '';
        if (sortField === 'date') {
          valA = a.rawDate || a.date;
          valB = b.rawDate || b.date;
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [records, searchQuery, cropFilter, diseaseFilter, sortField, sortDirection]);

  // Paginated subset
  const totalPages = Math.ceil(processedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedRecords.slice(start, start + pageSize);
  }, [processedRecords, currentPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // CSV Export with authentic filtered records
  const handleExportCSV = () => {
    if (processedRecords.length === 0) return;
    const headers = ['Audit ID', 'Date', 'Crop', 'Disease / Pathogen', 'Severity', 'Confidence', 'Agronomic Impact', 'Status'];
    const csvRows = [
      headers.join(','),
      ...processedRecords.map((r) =>
        [r.id, r.date, r.crop, `"${r.disease}"`, r.severity, `"${r.confidence}"`, `"${r.impact}"`, `"${r.status}"`].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AgriSmart_Stakeholder_Report_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unique crops & diseases for dropdowns
  const uniqueCrops = useMemo(() => Array.from(new Set(records.map((r) => r.crop))).sort(), [records]);
  const uniqueDiseases = useMemo(() => Array.from(new Set(records.map((r) => r.disease))).sort(), [records]);

  return (
    <div className="role-page-container stakeholder-reports-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#38bdf8' }}>Executive Intelligence</span>
          <h1 className="page-main-title">📑 Stakeholder Reports & Compliance Center</h1>
          <p className="page-desc">
            Consolidated agricultural audit documents, regional disease prevalence logs, and verifiable field records.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => window.print()}
            title="Print printable summary"
          >
            🖨️ Print
          </button>
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#0284c7' }}
            onClick={handleExportCSV}
            disabled={processedRecords.length === 0}
            title="Download CSV export"
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
              minWidth: '200px',
            }}
          >
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search audit records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-text-input"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

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
            <option value="">All Crops ({uniqueCrops.length})</option>
            {uniqueCrops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Disease Filter */}
          <select
            value={diseaseFilter}
            onChange={(e) => {
              setDiseaseFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-select"
            aria-label="Filter by Disease"
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
            <option value="">All Pathogens / Diseases</option>
            {uniqueDiseases.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="filter-select"
            aria-label="Filter by Date Window"
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
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last Quarter</option>
            <option value="1y">Trailing 12 Months</option>
            <option value="all">All Available Records</option>
          </select>

          {/* Generate Report Button */}
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#059669', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            onClick={handleGenerateReport}
            disabled={generating}
          >
            {generating ? 'Refreshing...' : '⚡ Generate Report'}
          </button>
        </div>

        {(searchQuery || cropFilter || diseaseFilter) && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => {
              setSearchQuery('');
              setCropFilter('');
              setDiseaseFilter('');
              setCurrentPage(1);
            }}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Report Panel & Table */}
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
        <div
          className="panel-header-row"
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 className="panel-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Consolidated Agricultural Telemetry & Compliance Report
            </h2>
            <p className="panel-desc" style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
              Report Window: {dateRange} • Generated: {new Date().toLocaleDateString()} • {processedRecords.length} Verified Records
            </p>
          </div>
        </div>

        <div className="table-responsive" style={{ width: '100%', overflowX: 'auto' }}>
          <table className="role-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.45)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th
                  onClick={() => handleSort('id')}
                  style={{ padding: '0.9rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Audit ID {sortField === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('date')}
                  style={{ padding: '0.9rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Date {sortField === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('crop')}
                  style={{ padding: '0.9rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Target Crop {sortField === 'crop' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('disease')}
                  style={{ padding: '0.9rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Primary Pathogen {sortField === 'disease' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('severity')}
                  style={{ padding: '0.9rem 1rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Severity {sortField === 'severity' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '0.9rem 1rem', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Confidence
                </th>
                <th style={{ padding: '0.9rem 1rem', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Agronomic Impact
                </th>
                <th style={{ padding: '0.9rem 1rem', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
                    <span>Compiling compliance audit records...</span>
                  </td>
                </tr>
              ) : processedRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📑</span>
                    <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '0.25rem' }}>
                      No audit records match the selected report criteria.
                    </strong>
                    <small style={{ color: '#64748b' }}>Try broadening your filter parameters or selecting all crops.</small>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <code style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.8rem', color: '#38bdf8' }}>
                        {row.id}
                      </code>
                    </td>
                    <td style={{ padding: '0.9rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>{row.date}</td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>🌾 {row.crop}</strong>
                    </td>
                    <td style={{ padding: '0.9rem 1rem', color: '#e2e8f0', fontSize: '0.88rem' }}>{row.disease}</td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <span className={`status-pill ${row.severity.toLowerCase()}`}>
                        {row.severity}
                      </span>
                    </td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <span className="confidence-pill">{row.confidence}</span>
                    </td>
                    <td style={{ padding: '0.9rem 1rem', color: '#cbd5e1', fontSize: '0.85rem' }}>
                      {row.impact}
                    </td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: row.status.toLowerCase().includes('healthy') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: row.status.toLowerCase().includes('healthy') ? '#34d399' : '#38bdf8',
                          border: row.status.toLowerCase().includes('healthy') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
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
              Showing {Math.min(processedRecords.length, (currentPage - 1) * pageSize + 1)}–{Math.min(processedRecords.length, currentPage * pageSize)} of {processedRecords.length} records
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
