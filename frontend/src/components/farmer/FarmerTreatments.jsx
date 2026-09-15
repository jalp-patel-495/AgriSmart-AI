import React, { useState, useEffect, useMemo } from 'react';
import { roleApi } from '../../services/roleApi';
import fallbackRegistry from '../../utils/class_registry.json';

/**
 * Farmer Treatments & Prevention Catalog
 * 
 * Features:
 * - Evidence-informed disease management, prevention guidance & crop care
 * - Prominent dynamic search bar with clear button
 * - Dynamic Crop & Disease dropdown filters
 * - Quick-filter crop chips
 * - Real catalog statistics (no hardcoding)
 * - Responsive 3-column treatment cards (with symptoms, management, prevention)
 * - Safe verified badge display (only if verified)
 * - Agricultural safety disclaimer
 * - Expand/collapse details on each card
 */
export default function FarmerTreatments() {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [expandedCardIds, setExpandedCardIds] = useState({});

  // Crop icons mapping for visual polish
  const cropIcons = {
    'Apple': '🍎',
    'Blueberry': '🫐',
    'Cherry': '🍒',
    'Corn': '🌽',
    'Grape': '🍇',
    'Orange': '🍊',
    'Peach': '🍑',
    'Bell Pepper': '🫑',
    'Potato': '🥔',
    'Raspberry': '🫐',
    'Soybean': '🌱',
    'Squash': '🎃',
    'Strawberry': '🍓',
    'Tomato': '🍅',
  };

  // Build fallback items from project's class_registry.json in case API is unavailable
  const fallbackItems = useMemo(() => {
    if (!fallbackRegistry?.classes) return [];
    return fallbackRegistry.classes.map((c, i) => {
      const normalizedCrop = c.crop_name === 'Pepper, bell' ? 'Bell Pepper' : c.crop_name;
      return {
        id: c.class_index ?? (i + 1),
        crop_name: normalizedCrop,
        crop: normalizedCrop,
        name: c.disease_name,
        disease: c.disease_name,
        pathogen: c.pathogen,
        symptoms: c.symptoms,
        treatment: c.management,
        prevention: c.prevention,
        expert_reviewed: false,
        status: c.status
      };
    });
  }, []);

  // Fetch treatment catalog from backend with automatic fallback to authentic project registry
  useEffect(() => {
    const fetchTreatments = async () => {
      setLoading(true);
      try {
        const data = await roleApi.getTreatments();
        if (Array.isArray(data) && data.length > 0) {
          // Normalize names
          const normalized = data.map((item) => ({
            ...item,
            crop: item.crop_name || item.crop || 'Crop',
            disease: item.name || item.disease || 'Disease',
          }));
          setTreatments(normalized);
        } else {
          setTreatments(fallbackItems);
        }
      } catch (err) {
        console.warn('Backend treatments fetch error, using authentic class registry:', err);
        setTreatments(fallbackItems);
      } finally {
        setLoading(false);
      }
    };

    fetchTreatments();
  }, [fallbackItems]);

  // Extract unique sorted crops from the actual catalog
  const availableCrops = useMemo(() => {
    const set = new Set();
    treatments.forEach((t) => {
      const c = t.crop || t.crop_name;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [treatments]);

  // Extract unique sorted diseases from the actual catalog (filtered by selectedCrop if chosen)
  const availableDiseases = useMemo(() => {
    const set = new Set();
    treatments.forEach((t) => {
      const c = t.crop || t.crop_name;
      if (!selectedCrop || c === selectedCrop) {
        const d = t.disease || t.name;
        if (d) set.add(d);
      }
    });
    return Array.from(set).sort();
  }, [treatments, selectedCrop]);

  // All 14 supported crops for the quick filter row
  const quickFilterCrops = useMemo(() => {
    const canonicalOrder = [
      'Apple',
      'Blueberry',
      'Cherry',
      'Corn',
      'Grape',
      'Orange',
      'Peach',
      'Bell Pepper',
      'Potato',
      'Raspberry',
      'Soybean',
      'Squash',
      'Strawberry',
      'Tomato'
    ];
    // Return all canonical crops that exist in availableCrops, plus any additional catalog crops
    return canonicalOrder.filter((c) => availableCrops.includes(c)).concat(
      availableCrops.filter((c) => !canonicalOrder.includes(c))
    );
  }, [availableCrops]);

  // Real catalog statistics
  const totalCropsCount = availableCrops.length;
  const totalDiseasesCount = useMemo(() => {
    return new Set(treatments.map((t) => t.disease || t.name).filter(Boolean)).size;
  }, [treatments]);
  const totalTreatmentsCount = treatments.length;

  // Filtered treatment records based on search and dropdown selections
  const filteredTreatments = useMemo(() => {
    return treatments.filter((item) => {
      const crop = item.crop || item.crop_name || '';
      const disease = item.disease || item.name || '';
      const symptoms = item.symptoms || '';
      const treatment = item.treatment || '';
      const prevention = item.prevention || '';
      const pathogen = item.pathogen || '';

      // Crop filter
      if (selectedCrop && crop !== selectedCrop) {
        return false;
      }

      // Disease filter
      if (selectedDisease && disease !== selectedDisease) {
        return false;
      }

      // Search query across all fields
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCrop = crop.toLowerCase().includes(q);
        const matchDisease = disease.toLowerCase().includes(q);
        const matchSymptoms = symptoms.toLowerCase().includes(q);
        const matchTreatment = treatment.toLowerCase().includes(q);
        const matchPrevention = prevention.toLowerCase().includes(q);
        const matchPathogen = pathogen.toLowerCase().includes(q);

        if (!matchCrop && !matchDisease && !matchSymptoms && !matchTreatment && !matchPrevention && !matchPathogen) {
          return false;
        }
      }

      return true;
    });
  }, [treatments, selectedCrop, selectedDisease, searchQuery]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCrop('');
    setSelectedDisease('');
  };

  const hasActiveFilters = Boolean(searchQuery || selectedCrop || selectedDisease);

  // Toggle card expansion
  const toggleExpand = (id) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="role-page-container treatments-catalog-page">
      {/* 1. Page Header */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag">Agronomic Reference</span>
          <h1 className="page-main-title">💊 Treatments & Prevention Catalog</h1>
          <p className="page-desc">
            Evidence-informed disease management, prevention guidance, and crop-care recommendations for supported crops.
          </p>
        </div>
      </div>

      {/* 2. Search & Dropdown Filter Row */}
      <div className="treatments-filter-section">
        <div className="treatments-filter-row">
          {/* Prominent Search Bar */}
          <div className="treatments-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search diseases, symptoms, or treatments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="treatments-search-input"
              aria-label="Search diseases, symptoms, or treatments"
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Crop Dropdown Filter */}
          <select
            value={selectedCrop}
            onChange={(e) => {
              setSelectedCrop(e.target.value);
              setSelectedDisease(''); // reset disease when crop changes
            }}
            className="treatment-filter-select"
            aria-label="Filter by Crop"
          >
            <option value="">All Supported Crops</option>
            {availableCrops.map((cropName) => (
              <option key={cropName} value={cropName}>
                {cropIcons[cropName] || '🌱'} {cropName}
              </option>
            ))}
          </select>

          {/* Disease Dropdown Filter */}
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className="treatment-filter-select"
            aria-label="Filter by Disease"
          >
            <option value="">All Diseases</option>
            {availableDiseases.map((dName) => (
              <option key={dName} value={dName}>
                🔬 {dName}
              </option>
            ))}
          </select>

          {/* Clear All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-clear-all-filters"
              onClick={handleClearFilters}
              title="Reset all search queries and filters"
            >
              ✕ Reset
            </button>
          )}
        </div>

        {/* 3. Quick Crop Filter Chips */}
        <div className="quick-crop-chips-row">
          <span className="quick-chips-label">Quick Filters:</span>
          <div className="quick-chips-list">
            <button
              type="button"
              className={`quick-chip-btn ${!selectedCrop ? 'active' : ''}`}
              onClick={() => {
                setSelectedCrop('');
                setSelectedDisease('');
              }}
            >
              🌿 All
            </button>
            {quickFilterCrops.map((cropName) => (
              <button
                key={cropName}
                type="button"
                className={`quick-chip-btn ${selectedCrop === cropName ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCrop(selectedCrop === cropName ? '' : cropName);
                  setSelectedDisease('');
                }}
              >
                <span>{cropIcons[cropName] || '🌱'}</span>
                <span>{cropName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Catalog Statistics (Real Counts) */}
      <div className="catalog-stats-row">
        <div className="catalog-stat-card">
          <div className="stat-icon-pill green">🌾</div>
          <div className="stat-text-group">
            <span className="stat-label">Supported Crops</span>
            <span className="stat-number">{totalCropsCount}</span>
          </div>
        </div>

        <div className="catalog-stat-card">
          <div className="stat-icon-pill amber">🔬</div>
          <div className="stat-text-group">
            <span className="stat-label">Disease Conditions</span>
            <span className="stat-number">{totalDiseasesCount}</span>
          </div>
        </div>

        <div className="catalog-stat-card">
          <div className="stat-icon-pill blue">💊</div>
          <div className="stat-text-group">
            <span className="stat-label">Treatment Records</span>
            <span className="stat-number">{totalTreatmentsCount}</span>
          </div>
        </div>
      </div>

      {/* 5. Results Counter Bar */}
      <div className="catalog-results-status-bar">
        <span className="results-counter-text">
          <strong>{filteredTreatments.length}</strong> {filteredTreatments.length === 1 ? 'treatment found' : 'treatments found'}
          {hasActiveFilters && (
            <span style={{ color: '#94a3b8', marginLeft: '0.4rem' }}>
              (filtered from {totalTreatmentsCount})
            </span>
          )}
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            className="btn-link-reset"
            onClick={handleClearFilters}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 6. Treatment Cards Grid */}
      {loading ? (
        <div className="catalog-loading-card">
          <div className="spinner" style={{ width: '36px', height: '36px' }}></div>
          <p style={{ marginTop: '0.85rem', color: '#94a3b8', fontSize: '0.9rem' }}>
            Loading treatment catalog...
          </p>
        </div>
      ) : filteredTreatments.length === 0 ? (
        /* Empty State */
        <div className="catalog-empty-card">
          <span className="empty-icon">🔎</span>
          <h3>No matching treatments found</h3>
          <p>Try another disease, crop, or symptom keyword.</p>
          <button
            type="button"
            className="btn-primary-action"
            onClick={handleClearFilters}
            style={{ marginTop: '0.75rem' }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="treatment-cards-grid">
          {filteredTreatments.map((item) => {
            const crop = item.crop || item.crop_name || 'Crop';
            const disease = item.disease || item.name || 'Disease';
            const isExpanded = Boolean(expandedCardIds[item.id]);
            const isVerified = Boolean(item.expert_reviewed === true);

            return (
              <div key={item.id} className="treatment-card">
                <div>
                  {/* Card Header: Crop Tag & Verification Badge */}
                  <div className="treatment-card-header">
                    <span className="treatment-crop-tag">
                      <span>{cropIcons[crop] || '🌿'}</span>
                      <span>{crop}</span>
                    </span>

                    {isVerified && (
                      <span className="treatment-verified-badge" title="Reviewed by qualified agronomy expert">
                        ✓ Expert Reviewed
                      </span>
                    )}
                  </div>

                  {/* Disease Title */}
                  <h3 className="treatment-disease-title">
                    <span style={{ color: '#34d399', marginRight: '0.35rem' }}>🔬</span>
                    {disease}
                  </h3>

                  {/* Pathogen (if available) */}
                  {item.pathogen && (
                    <div className="treatment-pathogen-label">
                      Pathogen: <em>{item.pathogen}</em>
                    </div>
                  )}

                  {/* Characteristic Symptoms */}
                  {item.symptoms && (
                    <div className="treatment-block">
                      <div className="treatment-block-label symptoms">
                        ⚠️ Characteristic Symptoms
                      </div>
                      <p className={`treatment-block-text ${!isExpanded ? 'clamped' : ''}`}>
                        {item.symptoms}
                      </p>
                    </div>
                  )}

                  {/* Recommended Management */}
                  {item.treatment && (
                    <div className="treatment-block management">
                      <div className="treatment-block-label management">
                        💊 Recommended Management
                      </div>
                      <p className={`treatment-block-text ${!isExpanded ? 'clamped' : ''}`}>
                        {item.treatment}
                      </p>
                    </div>
                  )}

                  {/* Prevention */}
                  {item.prevention && (
                    <div className="treatment-block prevention">
                      <div className="treatment-block-label prevention">
                        🛡️ Prevention
                      </div>
                      <p className={`treatment-block-text ${!isExpanded ? 'clamped' : ''}`}>
                        {item.prevention}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Footer with Expand / Collapse Details Toggle */}
                <div className="treatment-card-footer">
                  <button
                    type="button"
                    className="btn-toggle-details"
                    onClick={() => toggleExpand(item.id)}
                    aria-label={isExpanded ? 'Collapse card details' : 'Expand full card details'}
                  >
                    {isExpanded ? '▴ Show Less' : '▾ View Details'}
                  </button>

                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Informational Care
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Safety Disclaimer */}
      <div className="treatment-safety-disclaimer">
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <p>
          <strong>Agricultural Safety Notice:</strong> Treatment guidance is informational. Follow local agricultural regulations and product labels, and consult a qualified agricultural expert when needed.
        </p>
      </div>
    </div>
  );
}
