import React, { useState, useEffect } from 'react';
import { roleApi } from '../../services/roleApi';
import { useNavigate } from 'react-router-dom';

export default function FarmerDiseaseHistory() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [cropFilter, setCropFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Details Modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roleApi.getFarmerDiagnoses(cropFilter, statusFilter, 50);
      setRecords(data.records || []);
    } catch (err) {
      console.error('Failed to load disease history:', err);
      setError(err.message || 'Failed to retrieve scan records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [cropFilter, statusFilter]);

  const filteredRecords = records.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (r.crop && r.crop.toLowerCase().includes(query)) ||
      (r.disease && r.disease.toLowerCase().includes(query))
    );
  });

  return (
    <div className="role-page-container">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag">Diagnostic Ledger</span>
          <h1 className="page-main-title">📋 Crop Disease Detection History</h1>
          <p className="page-desc">
            Complete historical audit trail of your plant leaf scans, AI confidence scores, certified agronomist reviews, and treatment outcomes.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => navigate('/farmer/disease-detection')}
          >
            🔬 New Leaf Scan
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="history-filter-toolbar">
        <div className="search-input-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search crop or disease name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-text-input"
          />
        </div>

        <div className="filter-select-group">
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Crops</option>
            <option value="Tomato">Tomato</option>
            <option value="Potato">Potato</option>
            <option value="Corn">Corn</option>
            <option value="Apple">Apple</option>
            <option value="Grape">Grape</option>
            <option value="Bell Pepper">Bell Pepper</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Health Statuses</option>
            <option value="healthy">Healthy Only</option>
            <option value="diseased">Diseased Only</option>
          </select>

          <button
            type="button"
            className="btn-refresh-filter"
            onClick={fetchHistory}
            title="Refresh records"
          >
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className="role-error-banner">
          <span>⚠️ {error}</span>
          <button onClick={fetchHistory} className="btn-retry-small">Retry</button>
        </div>
      )}

      {/* Table of Past Scans */}
      {loading ? (
        <div className="loading-state-box">
          <div className="spinner"></div>
          <span>Retrieving diagnostic log...</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state-box">
          <span className="empty-icon">🍃</span>
          <h3>No Diagnostic Records Found</h3>
          <p>Try adjusting your search criteria or perform a new leaf diagnosis.</p>
          <button
            className="btn-primary-action"
            onClick={() => navigate('/farmer/disease-detection')}
          >
            🔬 Perform First Scan
          </button>
        </div>
      ) : (
        <div className="panel-card table-panel">
          <div className="table-responsive">
            <table className="role-data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Crop</th>
                  <th>Detected Condition</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Expert Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => {
                  const isHealthy = rec.is_healthy;
                  const dateStr = rec.created_at
                    ? new Date(rec.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recent Scan';

                  return (
                    <tr key={rec.id}>
                      <td className="text-muted">{dateStr}</td>
                      <td>
                        <strong className="crop-name-strong">{rec.crop}</strong>
                      </td>
                      <td>
                        <span className={isHealthy ? 'diagnosis-healthy' : 'diagnosis-diseased'}>
                          {rec.disease}
                        </span>
                      </td>
                      <td>
                        <span className="confidence-pill">
                          {typeof rec.confidence === 'number'
                            ? `${Math.round(rec.confidence <= 1 ? rec.confidence * 100 : rec.confidence)}%`
                            : `${rec.confidence}%`}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${isHealthy ? 'healthy' : 'diseased'}`}>
                          {isHealthy ? '🌿 Healthy' : '⚠️ Diseased'}
                        </span>
                      </td>
                      <td>
                        {rec.expert_status === 'CONFIRMED' ? (
                          <span className="expert-pill confirmed">✔️ Verified</span>
                        ) : rec.expert_status === 'REJECTED' ? (
                          <span className="expert-pill rejected">✖ Overridden</span>
                        ) : (
                          <span className="expert-pill pending">⏳ In Review</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => setSelectedRecord(rec)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Details Modal */}
      {selectedRecord && (
        <div className="modal-backdrop" onClick={() => setSelectedRecord(null)}>
          <div className="modal-dialog-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <div className="header-meta-group">
                <span className="modal-icon">🔬</span>
                <div>
                  <h3 className="modal-title">
                    {selectedRecord.crop} • {selectedRecord.disease}
                  </h3>
                  <small className="text-muted">
                    Scanned on {new Date(selectedRecord.created_at).toLocaleString()}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedRecord(null)}
              >
                ✖
              </button>
            </div>

            <div className="modal-details-body">
              {/* Metric Highlights */}
              <div className="modal-metrics-banner">
                <div className="metric-chip">
                  <span>Health State</span>
                  <strong className={selectedRecord.is_healthy ? 'text-success' : 'text-danger'}>
                    {selectedRecord.is_healthy ? '🌿 Healthy Specimen' : '⚠️ Disease Detected'}
                  </strong>
                </div>
                <div className="metric-chip">
                  <span>AI Confidence</span>
                  <strong className="text-accent">
                    {typeof selectedRecord.confidence === 'number'
                      ? `${Math.round(selectedRecord.confidence <= 1 ? selectedRecord.confidence * 100 : selectedRecord.confidence)}%`
                      : `${selectedRecord.confidence}%`}
                  </strong>
                </div>
                <div className="metric-chip">
                  <span>Expert Status</span>
                  <strong>{selectedRecord.expert_status || 'Pending Agronomist Triage'}</strong>
                </div>
              </div>

              {/* Treatment and Symptoms */}
              <div className="details-section">
                <h4>🦠 Clinical Description & Symptoms</h4>
                <p className="section-body-text">
                  {selectedRecord.symptoms ||
                    `Characteristic symptoms of ${selectedRecord.disease} on ${selectedRecord.crop} foliage. Early detection prevents secondary spore dispersal.`}
                </p>
              </div>

              <div className="details-section">
                <h4>💊 Prescribed Treatment & Interventions</h4>
                <div className="treatment-recommendation-box">
                  <p>
                    {selectedRecord.treatment ||
                      'Maintain optimal soil moisture and improve air circulation around lower crop canopies. Apply organic copper fungicide if symptoms progress.'}
                  </p>
                </div>
              </div>

              {/* Expert Notes if available */}
              {selectedRecord.expert_notes && (
                <div className="details-section expert-section">
                  <h4>👨‍🔬 Certified Expert Note</h4>
                  <div className="expert-notes-card">
                    <p>{selectedRecord.expert_notes}</p>
                    {selectedRecord.expert_treatment && (
                      <div className="expert-custom-treatment">
                        <strong>Custom Prescription:</strong> {selectedRecord.expert_treatment}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-print-small"
                onClick={() => window.print()}
              >
                🖨️ Print Prescription
              </button>
              <button
                type="button"
                className="btn-cancel-secondary"
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
