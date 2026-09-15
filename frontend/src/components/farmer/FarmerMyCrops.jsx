import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { roleApi } from '../../services/roleApi';

// Fallback crop icons mapped to common agricultural commodities
const CROP_ICONS = {
  Tomato: '🍅',
  Grape: '🍇',
  Corn: '🌽',
  'Corn (Maize)': '🌽',
  Apple: '🍎',
  Potato: '🥔',
  'Bell Pepper': '🫑',
  Wheat: '🌾',
  Rice: '🌾',
  Strawberry: '🍓',
  Cherry: '🍒',
  Soybean: '🌱',
  Cotton: '🪴',
  Sugarcane: '🎋',
};

export default function FarmerMyCrops() {
  const navigate = useNavigate();
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCropModal, setSelectedCropModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    let isMounted = true;
    const fetchCrops = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await roleApi.getFarmerCrops();
        if (isMounted) {
          setCrops(data.crops || []);
        }
      } catch (err) {
        console.error('Failed to fetch farmer crops:', err);
        if (isMounted) {
          setError('Unable to load field crops. Please check network connectivity.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchCrops();
    return () => {
      isMounted = false;
    };
  }, []);

  // Summary Metrics calculated dynamically from authentic crop data
  const summaryMetrics = useMemo(() => {
    const totalCrops = crops.length;
    
    // Sum valid acreage numbers
    const validAcreages = crops
      .map((c) => (typeof c.acreage === 'number' && !isNaN(c.acreage) ? c.acreage : null))
      .filter((a) => a !== null);
    const totalAreaVal = validAcreages.reduce((acc, curr) => acc + curr, 0);
    const totalAreaFormatted =
      validAcreages.length > 0 ? `${totalAreaVal.toFixed(1)} Acres` : 'Data unavailable';

    // Count crops with optimal / adequate irrigation
    const optimalIrrigationCount = crops.filter(
      (c) =>
        c.irrigation_status &&
        ['Adequate', 'Optimal', 'Optimal Moisture'].includes(c.irrigation_status)
    ).length;

    // Count crops with actual disease check records
    const recentChecksCount = crops.filter((c) => Boolean(c.last_scanned)).length;

    return {
      totalCrops,
      totalAreaFormatted,
      optimalIrrigationCount,
      recentChecksCount,
    };
  }, [crops]);

  // Filtering & Sorting
  const filteredAndSortedCrops = useMemo(() => {
    let result = [...crops];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (crop) =>
          crop.name?.toLowerCase().includes(q) ||
          crop.variety?.toLowerCase().includes(q) ||
          crop.category?.toLowerCase().includes(q)
      );
    }

    // Status category filter
    if (statusFilter !== 'All') {
      result = result.filter((crop) => crop.status === statusFilter);
    }

    // Sort order
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'area') {
        const areaA = typeof a.acreage === 'number' ? a.acreage : -1;
        const areaB = typeof b.acreage === 'number' ? b.acreage : -1;
        return areaB - areaA;
      }
      if (sortBy === 'sowing_date') {
        return (a.sowing_date || '').localeCompare(b.sowing_date || '');
      }
      if (sortBy === 'last_scanned') {
        // Sort crops with scans first
        if (a.last_scanned && !b.last_scanned) return -1;
        if (!a.last_scanned && b.last_scanned) return 1;
        return (b.last_scanned || '').localeCompare(a.last_scanned || '');
      }
      return 0;
    });

    return result;
  }, [crops, searchQuery, statusFilter, sortBy]);

  const handleImageError = (cropId) => {
    setImageErrors((prev) => ({ ...prev, [cropId]: true }));
  };

  // Helper for Status Badge styling
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Healthy':
        return <span className="crop-status-badge badge-healthy">🟢 Healthy</span>;
      case 'Attention Needed':
        return <span className="crop-status-badge badge-attention">🟠 Attention Needed</span>;
      case 'Disease Risk':
        return <span className="crop-status-badge badge-disease-risk">🔴 Disease Risk</span>;
      default:
        return <span className="crop-status-badge badge-unknown">⚪ Status Unavailable</span>;
    }
  };

  return (
    <div className="role-page-container">
      {/* 1. Page Header */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag">FIELD PORTFOLIO</span>
          <h1 className="page-main-title">🌱 My Farm Crops & Plots</h1>
          <p className="page-desc">
            Manage your crops, field plots, irrigation status, and disease monitoring from one place.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => navigate('/farmer/disease-detection')}
            id="btn-scan-leaf-header"
          >
            🔬 Scan Leaf
          </button>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => navigate('/farmer/weather')}
            id="btn-weather-forecast-header"
          >
            🌦️ Weather Forecast
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="portfolio-error-banner">
          <span>⚠️ {error}</span>
          <button
            type="button"
            className="btn-link-action"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Real Summary Cards */}
      <div className="portfolio-summary-grid">
        <div className="portfolio-summary-card">
          <div className="summary-icon-wrapper green">🌱</div>
          <div className="summary-card-body">
            <span className="summary-card-label">Total Crops</span>
            <strong className="summary-card-val">{summaryMetrics.totalCrops}</strong>
          </div>
        </div>

        <div className="portfolio-summary-card">
          <div className="summary-icon-wrapper blue">📐</div>
          <div className="summary-card-body">
            <span className="summary-card-label">Total Farm Area</span>
            <strong className="summary-card-val">{summaryMetrics.totalAreaFormatted}</strong>
          </div>
        </div>

        <div className="portfolio-summary-card">
          <div className="summary-icon-wrapper cyan">💧</div>
          <div className="summary-card-body">
            <span className="summary-card-label">Optimal Irrigation</span>
            <strong className="summary-card-val">{summaryMetrics.optimalIrrigationCount}</strong>
          </div>
        </div>

        <div className="portfolio-summary-card">
          <div className="summary-icon-wrapper purple">🔬</div>
          <div className="summary-card-body">
            <span className="summary-card-label">Recent Disease Checks</span>
            <strong className="summary-card-val">{summaryMetrics.recentChecksCount}</strong>
          </div>
        </div>
      </div>

      {/* 3. Search, Filter & Sort Toolbar */}
      <div className="portfolio-toolbar-container">
        <div className="portfolio-search-box">
          <span className="search-symbol">🔍</span>
          <input
            type="text"
            className="portfolio-search-input"
            placeholder="Search crops by name, variety, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="input-search-crops"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✖
            </button>
          )}
        </div>

        <div className="portfolio-filter-actions">
          <div className="portfolio-status-filters">
            {['All', 'Healthy', 'Attention Needed', 'Disease Risk'].map((status) => (
              <button
                key={status}
                type="button"
                className={`filter-pill-btn ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'Healthy' && '🟢 '}
                {status === 'Attention Needed' && '🟠 '}
                {status === 'Disease Risk' && '🔴 '}
                {status}
              </button>
            ))}
          </div>

          <div className="portfolio-sort-control">
            <label htmlFor="select-crop-sort" className="sort-label">
              Sort by:
            </label>
            <select
              id="select-crop-sort"
              className="portfolio-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Crop Name</option>
              <option value="area">Area</option>
              <option value="sowing_date">Sowing Date</option>
              <option value="last_scanned">Last Disease Check</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Loading Skeletons */}
      {loading ? (
        <div className="crops-cards-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="crop-card-skeleton">
              <div className="skeleton-image-shimmer" />
              <div className="skeleton-body">
                <div className="skeleton-line-title" />
                <div className="skeleton-line-badge" />
                <div className="skeleton-metrics-box">
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                </div>
                <div className="skeleton-buttons-row" />
              </div>
            </div>
          ))}
        </div>
      ) : crops.length === 0 ? (
        /* 5. Empty State: No Crops */
        <div className="portfolio-empty-state">
          <div className="empty-icon-large">🌱</div>
          <h3 className="empty-state-title">No Crops Added Yet</h3>
          <p className="empty-state-desc">
            Add your first crop to start monitoring your farm plots, irrigation telemetries, and disease surveillance.
          </p>
        </div>
      ) : filteredAndSortedCrops.length === 0 ? (
        /* Empty State: No Filter Matches */
        <div className="portfolio-empty-state">
          <div className="empty-icon-large">🔍</div>
          <h3 className="empty-state-title">No Matching Crops Found</h3>
          <p className="empty-state-desc">
            No farm holdings match your search term "{searchQuery}" or status filter "{statusFilter}".
          </p>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
            }}
          >
            Clear Search & Filters
          </button>
        </div>
      ) : (
        /* 6. Crop Cards Responsive Grid */
        <div className="crops-cards-grid">
          {filteredAndSortedCrops.map((crop) => {
            const hasImage = crop.image_url && !imageErrors[crop.id];
            const icon = CROP_ICONS[crop.name] || '🌱';

            return (
              <div key={crop.id} className="crop-plot-card">
                {/* Crop Image Header with Aspect Ratio & Rounded Top */}
                <div className="crop-card-media-wrapper">
                  {hasImage ? (
                    <img
                      src={crop.image_url}
                      alt={`${crop.name} crop specimen`}
                      className="crop-card-img"
                      loading="lazy"
                      onError={() => handleImageError(crop.id)}
                    />
                  ) : (
                    <div className="crop-card-placeholder">
                      <span className="placeholder-crop-icon">{icon}</span>
                      <span className="placeholder-category-tag">
                        {crop.category || 'Agricultural Crop'}
                      </span>
                    </div>
                  )}
                  <div className="crop-card-media-overlay" />
                </div>

                {/* Card Main Info */}
                <div className="crop-card-content">
                  <div className="crop-title-row">
                    <div className="crop-title-details">
                      <h3 className="crop-name-heading">
                        <span className="crop-symbol">{icon}</span> {crop.name}
                      </h3>
                      <span className="crop-variety-sub">
                        {crop.variety || crop.category || 'Standard Cultivar'}
                      </span>
                    </div>
                    <div className="crop-badge-wrapper">
                      {renderStatusBadge(crop.status)}
                    </div>
                  </div>

                  {/* Field Details: Clean Label / Value Layout */}
                  <div className="crop-field-details-grid">
                    {/* Area */}
                    <div className="field-metric-item">
                      <span className="metric-label">📐 AREA</span>
                      <span className="metric-value">
                        {crop.acreage ? `${crop.acreage} Acres` : 'Data unavailable'}
                      </span>
                    </div>

                    {/* Sowing Date */}
                    <div className="field-metric-item">
                      <span className="metric-label">📅 SOWING DATE</span>
                      <span className="metric-value">
                        {crop.sowing_date || 'Data unavailable'}
                      </span>
                    </div>

                    {/* Irrigation Status */}
                    <div className="field-metric-item full-width">
                      <span className="metric-label">💧 IRRIGATION STATUS</span>
                      <div className="irrigation-status-container">
                        {crop.irrigation_status ? (
                          <div className="irrigation-telemetry-badge">
                            <span className="telemetry-pill">
                              {crop.irrigation_status}
                            </span>
                            {crop.soil_moisture && (
                              <span className="moisture-badge">
                                {crop.soil_moisture} Moisture
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="metric-value text-muted">
                            Data unavailable
                          </span>
                        )}
                        {typeof crop.soil_moisture_num === 'number' && (
                          <div className="moisture-progress-track">
                            <div
                              className={`moisture-progress-bar ${
                                crop.soil_moisture_num < 25
                                  ? 'low'
                                  : crop.soil_moisture_num > 60
                                  ? 'high'
                                  : 'optimal'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(5, crop.soil_moisture_num))}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Last Disease Check */}
                    <div className="field-metric-item full-width">
                      <span className="metric-label">🔬 LAST DISEASE CHECK</span>
                      <div className="disease-check-indicator">
                        <span
                          className={`metric-value ${
                            crop.last_scanned ? 'scanned-highlight' : 'text-muted'
                          }`}
                        >
                          {crop.last_scanned || 'No scan yet'}
                        </span>
                        {crop.last_disease && crop.last_disease !== 'Healthy' && (
                          <span className="disease-observation-tag">
                            {crop.last_disease}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="crop-card-actions">
                    <button
                      type="button"
                      className="btn-card-scan"
                      onClick={() => navigate('/farmer/disease-detection')}
                    >
                      🔬 Scan Leaf
                    </button>
                    <button
                      type="button"
                      className="btn-card-details"
                      onClick={() => setSelectedCropModal(crop)}
                    >
                      📋 Plot Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Plot Details Modal */}
      {selectedCropModal && (
        <div
          className="plot-modal-backdrop"
          onClick={() => setSelectedCropModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="plot-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="plot-modal-header">
              <div className="modal-header-info">
                <span className="modal-title-icon">
                  {CROP_ICONS[selectedCropModal.name] || '🌱'}
                </span>
                <div>
                  <h3 className="modal-title-text">
                    {selectedCropModal.name} Plot Profile
                  </h3>
                  <span className="modal-subtitle-text">
                    Field Portfolio Details & Monitoring Overview
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon"
                onClick={() => setSelectedCropModal(null)}
                aria-label="Close modal"
              >
                ✖
              </button>
            </div>

            <div className="plot-modal-body">
              <div className="modal-details-table">
                <div className="modal-detail-row">
                  <span className="detail-row-label">Crop</span>
                  <span className="detail-row-value font-semibold">
                    {selectedCropModal.name}
                  </span>
                </div>

                <div className="modal-detail-row">
                  <span className="detail-row-label">Variety</span>
                  <span className="detail-row-value">
                    {selectedCropModal.variety || selectedCropModal.category || 'Certified Hybrid'}
                  </span>
                </div>

                <div className="modal-detail-row">
                  <span className="detail-row-label">Area</span>
                  <span className="detail-row-value">
                    {selectedCropModal.acreage
                      ? `${selectedCropModal.acreage} Acres ${
                          selectedCropModal.field_size
                            ? `(${selectedCropModal.field_size})`
                            : ''
                        }`
                      : 'Data unavailable'}
                  </span>
                </div>

                <div className="modal-detail-row">
                  <span className="detail-row-label">Sowing Date</span>
                  <span className="detail-row-value text-muted">
                    {selectedCropModal.sowing_date || 'Data unavailable'}
                  </span>
                </div>

                <div className="modal-detail-row">
                  <span className="detail-row-label">Irrigation Status</span>
                  <span className="detail-row-value">
                    {selectedCropModal.irrigation_status
                      ? `${selectedCropModal.irrigation_status} ${
                          selectedCropModal.soil_moisture
                            ? `(${selectedCropModal.soil_moisture})`
                            : ''
                        }`
                      : 'Data unavailable'}
                  </span>
                </div>

                <div className="modal-detail-row">
                  <span className="detail-row-label">Last Disease Check</span>
                  <span className="detail-row-value">
                    {selectedCropModal.last_scanned
                      ? `${selectedCropModal.last_scanned}${
                          selectedCropModal.last_disease
                            ? ` • ${selectedCropModal.last_disease}`
                            : ''
                        }`
                      : 'No scan yet'}
                  </span>
                </div>

                <div className="modal-detail-row">
                  <span className="detail-row-label">Current Status</span>
                  <span className="detail-row-value">
                    {renderStatusBadge(selectedCropModal.status)}
                  </span>
                </div>
              </div>

              <div className="modal-action-footer">
                <button
                  type="button"
                  className="btn-secondary-outline"
                  onClick={() => setSelectedCropModal(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => {
                    setSelectedCropModal(null);
                    navigate('/farmer/disease-detection');
                  }}
                >
                  🔬 Scan Leaf
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
