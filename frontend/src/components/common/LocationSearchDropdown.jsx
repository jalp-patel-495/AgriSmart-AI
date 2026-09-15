import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * LocationSearchDropdown
 * Modern, accessible searchable dropdown selector for Agricultural Basin Presets.
 * Features:
 * - Search by basin name, state/region (e.g. Gujarat, Punjab), country, or crops (e.g. Tomato, Apple)
 * - Regional filter tabs (All, Gujarat, Maharashtra, Punjab, South India, Other India, Global)
 * - Custom-styled scrollable list with zero white native scrollbars
 * - GPS integration option
 * - Quick-select popular basin chips with clean flex-wrapping (no horizontal scrollbar)
 * - Keyboard navigation (Arrows, Enter, Escape) & Click-outside auto-close
 */
export default function LocationSearchDropdown({
  presets = [],
  selectedLocation = null,
  isGpsMode = false,
  onSelectPreset,
  onDetectGps,
  isDetectingGps = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRegionFilter, setActiveRegionFilter] = useState('All');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setSearchQuery('');
      setActiveRegionFilter('All');
    }
  }, [isOpen]);

  // Compute region counts
  const regionCounts = useMemo(() => {
    const counts = {
      All: presets.length,
      Gujarat: 0,
      Maharashtra: 0,
      Punjab: 0,
      'South India': 0,
      'Other India': 0,
      International: 0,
    };

    const southStates = ['karnataka', 'andhra pradesh', 'telangana', 'tamil nadu', 'kerala'];

    presets.forEach((p) => {
      const reg = (p.region || '').toLowerCase();
      const country = (p.country || 'India').toLowerCase();

      if (country !== 'india') {
        counts.International += 1;
      } else if (reg.includes('gujarat')) {
        counts.Gujarat += 1;
      } else if (reg.includes('maharashtra')) {
        counts.Maharashtra += 1;
      } else if (reg.includes('punjab')) {
        counts.Punjab += 1;
      } else if (southStates.some((s) => reg.includes(s))) {
        counts['South India'] += 1;
      } else {
        counts['Other India'] += 1;
      }
    });

    return counts;
  }, [presets]);

  // Filter presets based on region tab and search query
  const filteredPresets = useMemo(() => {
    let list = presets;

    // 1. Regional Filter
    if (activeRegionFilter !== 'All') {
      const southStates = ['karnataka', 'andhra pradesh', 'telangana', 'tamil nadu', 'kerala'];
      if (activeRegionFilter === 'Gujarat') {
        list = list.filter((p) => (p.region || '').toLowerCase().includes('gujarat'));
      } else if (activeRegionFilter === 'Maharashtra') {
        list = list.filter((p) => (p.region || '').toLowerCase().includes('maharashtra'));
      } else if (activeRegionFilter === 'Punjab') {
        list = list.filter((p) => (p.region || '').toLowerCase().includes('punjab'));
      } else if (activeRegionFilter === 'South India') {
        list = list.filter((p) => southStates.some((s) => (p.region || '').toLowerCase().includes(s)));
      } else if (activeRegionFilter === 'International') {
        list = list.filter((p) => p.country && p.country.toLowerCase() !== 'india');
      } else if (activeRegionFilter === 'Other India') {
        const exclude = ['gujarat', 'maharashtra', 'punjab', ...southStates];
        list = list.filter(
          (p) =>
            (p.country?.toLowerCase() === 'india' || !p.country) &&
            !exclude.some((s) => (p.region || '').toLowerCase().includes(s))
        );
      }
    }

    // 2. Search Text Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const regionMatch = (p.region || '').toLowerCase().includes(q);
        const countryMatch = (p.country || '').toLowerCase().includes(q);
        const cropsMatch =
          Array.isArray(p.primary_crops) &&
          p.primary_crops.some((c) => c.toLowerCase().includes(q));
        return nameMatch || regionMatch || countryMatch || cropsMatch;
      });
    }

    return list;
  }, [presets, activeRegionFilter, searchQuery]);

  // Reset highlight index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredPresets]);

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredPresets.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredPresets.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPresets.length > 0 && filteredPresets[highlightedIndex]) {
        handleSelect(filteredPresets[highlightedIndex]);
      }
    }
  };

  const handleSelect = (preset) => {
    if (onSelectPreset) {
      onSelectPreset(preset);
    }
    setIsOpen(false);
  };

  // Curated Popular presets for quick 1-click pills below the dropdown
  const popularPresets = useMemo(() => {
    const popularNames = [
      'Anand Agronomy Region',
      'Saurashtra Groundnut Belt (Junagadh)',
      'Nashik Agricultural Belt',
      'Ludhiana Farm Basin',
      'Kashmir Valley Saffron & Apple Basin (Srinagar)',
      'Cauvery Delta Rice Bowl (Thanjavur)',
    ];
    return presets.filter((p) =>
      popularNames.some((pn) => p.name?.toLowerCase().includes(pn.toLowerCase().slice(0, 8)))
    ).slice(0, 5);
  }, [presets]);

  // Highlight matched search text
  const highlightMatch = (text, query) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} style={{ color: '#34d399', fontWeight: 700, textDecoration: 'underline' }}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="location-selector-section" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Top Label & Quick Stats */}
      <div className="location-selector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="location-selector-icon">📍</span>
          <span className="location-selector-title">Agricultural Basin / Location:</span>
        </div>
        <div className="location-selector-meta">
          <span className="badge-zones-count">
            🌐 {presets.length || 42} Agro-Climatic Basins
          </span>
        </div>
      </div>

      {/* Dropdown Trigger Box */}
      <div className="location-dropdown-wrapper">
        <button
          type="button"
          className={`location-dropdown-trigger ${isOpen ? 'open' : ''} ${isGpsMode ? 'gps-active' : ''}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="trigger-left">
            <span className="trigger-icon">{isGpsMode ? '🎯' : '📍'}</span>
            <div className="trigger-text-group">
              <div className="trigger-main-text">
                {isGpsMode
                  ? 'Your Field (GPS Coordinates)'
                  : selectedLocation?.name || 'Select Agricultural Basin...'}
              </div>
              <div className="trigger-sub-text">
                {isGpsMode ? (
                  <span style={{ color: '#34d399' }}>Live Device Telemetry • Active Field</span>
                ) : (
                  <>
                    <span>{selectedLocation?.region || 'Region'}, {selectedLocation?.country || 'India'}</span>
                    {selectedLocation?.latitude !== undefined && selectedLocation?.longitude !== undefined && (
                      <span className="coords-subtag">
                        • {Number(selectedLocation.latitude).toFixed(2)}°N, {Number(selectedLocation.longitude).toFixed(2)}°E
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="trigger-right">
            <span className="search-hint-badge">
              <span>🔍</span> Search & Select
            </span>
            <span className={`trigger-chevron ${isOpen ? 'rotate' : ''}`}>▾</span>
          </div>
        </button>

        {/* Floating Dropdown Menu */}
        {isOpen && (
          <div className="location-dropdown-panel" role="listbox">
            {/* 1. Search Bar */}
            <div className="dropdown-search-container">
              <span className="dropdown-search-icon">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                className="dropdown-search-input"
                placeholder="Search basin, state (e.g. Gujarat, Punjab), country or crop..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="dropdown-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 2. Regional Filter Tabs */}
            <div className="dropdown-region-tabs">
              {['All', 'Gujarat', 'Maharashtra', 'Punjab', 'South India', 'Other India', 'International'].map(
                (tab) => {
                  const count = regionCounts[tab] || 0;
                  const isActive = activeRegionFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      className={`region-tab-chip ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveRegionFilter(tab)}
                    >
                      {tab} ({count})
                    </button>
                  );
                }
              )}
            </div>

            {/* 3. Live Results Count & GPS Option */}
            <div className="dropdown-results-bar">
              <span className="results-count-text">
                Showing <strong>{filteredPresets.length}</strong> of {presets.length} agricultural basins
              </span>
              {onDetectGps && (
                <button
                  type="button"
                  className={`btn-dropdown-gps ${isGpsMode ? 'active' : ''}`}
                  onClick={() => {
                    onDetectGps();
                    setIsOpen(false);
                  }}
                  disabled={isDetectingGps}
                >
                  {isDetectingGps ? '📡 Acquiring GPS...' : isGpsMode ? '🎯 Using GPS Field' : '🎯 Use My Field GPS'}
                </button>
              )}
            </div>

            {/* 4. Options List */}
            <div className="dropdown-options-list" ref={optionsListRef}>
              {filteredPresets.length === 0 ? (
                <div className="dropdown-empty-state">
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.25rem' }}>
                    No agricultural basins found
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    No presets match &quot;{searchQuery}&quot;. Try searching for state (e.g. Gujarat, Punjab), country, or crops (e.g. Tomato, Rice).
                  </div>
                  <button
                    type="button"
                    className="btn-clear-filters"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveRegionFilter('All');
                    }}
                  >
                    Reset Search & Filters
                  </button>
                </div>
              ) : (
                filteredPresets.map((preset, idx) => {
                  const isSelected = !isGpsMode && selectedLocation?.name === preset.name;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={`${preset.name}-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`location-option-item ${isSelected ? 'selected' : ''} ${
                        isHighlighted ? 'highlighted' : ''
                      }`}
                      onClick={() => handleSelect(preset)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <div className="option-left">
                        <span className="option-pin">{isSelected ? '✅' : '📍'}</span>
                        <div className="option-details">
                          <div className="option-name">
                            {highlightMatch(preset.name, searchQuery)}
                          </div>
                          <div className="option-sub">
                            <span className="region-tag">
                              {highlightMatch(preset.region, searchQuery)}, {preset.country || 'India'}
                            </span>
                            <span className="coords-tag">
                              {Number(preset.latitude).toFixed(2)}°N, {Number(preset.longitude).toFixed(2)}°E
                            </span>
                          </div>

                          {/* Primary Crops tags */}
                          {Array.isArray(preset.primary_crops) && preset.primary_crops.length > 0 && (
                            <div className="option-crops-list">
                              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Crops:</span>
                              {preset.primary_crops.map((crop, cIdx) => (
                                <span key={cIdx} className="crop-pill">
                                  {crop}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="option-right">
                        {isSelected && (
                          <span className="selected-badge">
                            ✓ Selected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Quick Popular Presets (Neatly wrapped, NO horizontal scrolling!) */}
      {popularPresets.length > 0 && (
        <div className="quick-presets-container">
          <span className="quick-presets-label">Popular Basins:</span>
          <div className="quick-presets-pills">
            {popularPresets.map((preset, idx) => {
              const isSelected = !isGpsMode && selectedLocation?.name === preset.name;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`quick-preset-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelect(preset)}
                  title={`Select ${preset.name} (${preset.region})`}
                >
                  📍 {preset.name.split(' (')[0]} ({preset.region})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
