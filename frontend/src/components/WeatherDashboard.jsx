import React, { useState, useEffect } from 'react';
import { getFarmPresets, getWeatherIntelligence } from '../services/weatherApi';

export default function WeatherDashboard({ onNavigateToDiagnose }) {
  const [presets, setPresets] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState('All');
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  // Initialize presets and load default farm
  useEffect(() => {
    getFarmPresets().then((list) => {
      setPresets(list);
      if (list && list.length > 0) {
        const defaultFarm = list[0]; // Nashik Agricultural Belt
        setSelectedLocation(defaultFarm);
        loadWeather(defaultFarm.latitude, defaultFarm.longitude, defaultFarm.name, 'All');
      }
    });
  }, []);

  const loadWeather = async (lat, lon, name, cropFilter = selectedCrop) => {
    setLoading(true);
    setError(null);
    try {
      const cropArg = cropFilter === 'All' ? null : cropFilter;
      const data = await getWeatherIntelligence(lat, lon, name, cropArg);
      setWeatherData(data);
    } catch (err) {
      console.error('Weather load error:', err);
      setError('Unable to fetch live agrometeorological data. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (preset) => {
    setSelectedLocation(preset);
    loadWeather(preset.latitude, preset.longitude, preset.name, selectedCrop);
  };

  const handleCropChange = (crop) => {
    setSelectedCrop(crop);
    if (selectedLocation) {
      loadWeather(selectedLocation.latitude, selectedLocation.longitude, selectedLocation.name, crop);
    }
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        const loc = {
          name: `My Field GPS (${pos.coords.latitude.toFixed(3)}°, ${pos.coords.longitude.toFixed(3)}°)`,
          region: 'Local Coordinates',
          country: 'Local',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          primary_crops: ['Tomato', 'Potato', 'Corn', 'Apple']
        };
        setSelectedLocation(loc);
        loadWeather(loc.latitude, loc.longitude, loc.name, selectedCrop);
      },
      (err) => {
        setIsDetectingGps(false);
        alert(`Could not acquire GPS position: ${err.message}. Defaulting to farm presets.`);
      },
      { timeout: 10000 }
    );
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'Severe': return '#ef4444';
      case 'High': return '#f97316';
      case 'Moderate': return '#eab308';
      case 'Low': return '#22c55e';
      default: return 'var(--text-emerald)';
    }
  };

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'Critical':
        return <span className="advisory-badge badge-critical">CRITICAL</span>;
      case 'Warning':
        return <span className="advisory-badge badge-warning">WARNING</span>;
      case 'Advisory':
        return <span className="advisory-badge badge-advisory">ADVISORY</span>;
      default:
        return <span className="advisory-badge badge-safe">OPTIMAL</span>;
    }
  };

  return (
    <div className="weather-container">
      {/* Header & Location Controls */}
      <div className="weather-header-row">
        <div>
          <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🌦️</span> Agrometeorological Weather Intelligence
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Real-time microclimate analytics correlated with crop epidemiology to forecast disease risk and guide field operations.
          </p>
        </div>

        <div className="weather-action-buttons">
          <button
            className="btn-gps"
            onClick={handleDetectGps}
            disabled={isDetectingGps}
          >
            {isDetectingGps ? '📡 Locating Field...' : '🎯 Detect My Field GPS'}
          </button>
        </div>
      </div>

      {/* Preset Farm Hubs Chips */}
      <div className="presets-bar">
        <span className="presets-label">Agricultural Basins:</span>
        <div className="presets-scroll">
          {presets.map((preset, idx) => {
            const isSelected = selectedLocation?.name === preset.name;
            return (
              <button
                key={idx}
                className={`preset-chip ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectPreset(preset)}
              >
                📍 {preset.name} ({preset.region})
              </button>
            );
          })}
        </div>
      </div>

      {/* Crop Filter Bar */}
      <div className="crop-filter-row">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Crop Risk Filter:
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['All', 'Tomato', 'Potato', 'Corn', 'Apple'].map((crop) => (
            <button
              key={crop}
              className={`crop-filter-chip ${selectedCrop === crop ? 'active' : ''}`}
              onClick={() => handleCropChange(crop)}
            >
              {crop === 'All' ? '🌱 All Crops' : crop === 'Tomato' ? '🍅 Tomato' : crop === 'Potato' ? '🥔 Potato' : crop === 'Corn' ? '🌽 Corn' : '🍏 Apple'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && (
        <div className="panel-card weather-loading-box">
          <div style={{ fontSize: '2.5rem', animation: 'spin 1.8s linear infinite' }}>🌦️</div>
          <h4 style={{ marginTop: '1rem', color: '#fff' }}>Fetching Field Telemetry & Pathogen Risk Index...</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Querying Open-Meteo satellites & calculating fungal spore dispersion models.
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="panel-card error-card">
          <div style={{ fontSize: '2.5rem' }}>⚠️</div>
          <h4 style={{ marginTop: '0.5rem', color: '#f87171' }}>Failed to Load Weather Data</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{error}</p>
          <button className="btn-secondary" style={{ marginTop: '1rem', width: 'auto' }} onClick={() => selectedLocation && loadWeather(selectedLocation.latitude, selectedLocation.longitude, selectedLocation.name)}>
            Retry Connection
          </button>
        </div>
      )}

      {weatherData && !loading && (
        <>
          {/* Top Row: Current Weather Hero + Disease Risk Radar */}
          <div className="weather-hero-grid">
            {/* Current Weather Card */}
            <div className="panel-card weather-main-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="location-tag">📍 {weatherData.location}</span>
                  <div className="temp-display">
                    <span className="weather-icon-large">{weatherData.current.weather_icon}</span>
                    <span className="temp-value">{weatherData.current.temperature_c.toFixed(1)}°C</span>
                  </div>
                  <div className="condition-label">{weatherData.current.weather_condition}</div>
                </div>

                <div className="telemetry-compact">
                  <div className="telemetry-item">
                    <span className="telemetry-label">Relative Humidity</span>
                    <span className="telemetry-val" style={{ color: weatherData.current.relative_humidity_pct > 80 ? '#f87171' : '#34d399' }}>
                      💧 {weatherData.current.relative_humidity_pct}%
                    </span>
                  </div>
                  <div className="telemetry-item">
                    <span className="telemetry-label">Precipitation / Rain</span>
                    <span className="telemetry-val" style={{ color: weatherData.current.precipitation_mm > 0 ? '#60a5fa' : 'var(--text-secondary)' }}>
                      🌧️ {weatherData.current.precipitation_mm} mm
                    </span>
                  </div>
                  <div className="telemetry-item">
                    <span className="telemetry-label">Wind Velocity</span>
                    <span className="telemetry-val">
                      💨 {weatherData.current.wind_speed_kmh.toFixed(1)} km/h
                    </span>
                  </div>
                </div>
              </div>

              <div className="weather-metric-bars">
                {/* Humidity Bar */}
                <div>
                  <div className="bar-header">
                    <span>Humidity Risk Threshold</span>
                    <span>{weatherData.current.relative_humidity_pct}% (Threshold: &gt;75%)</span>
                  </div>
                  <div className="metric-track">
                    <div
                      className="metric-fill"
                      style={{
                        width: `${Math.min(100, weatherData.current.relative_humidity_pct)}%`,
                        background: weatherData.current.relative_humidity_pct > 80
                          ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                          : 'linear-gradient(90deg, #10b981, #3b82f6)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Disease Propagation Risk Radar */}
            <div className="panel-card risk-radar-card" style={{ borderColor: getRiskColor(weatherData.risk_assessment.overall_risk_level) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🦠</span> Pathogen Propagation Risk
                </h3>
                <span
                  className="risk-level-badge"
                  style={{ background: `${getRiskColor(weatherData.risk_assessment.overall_risk_level)}20`, color: getRiskColor(weatherData.risk_assessment.overall_risk_level), border: `1px solid ${getRiskColor(weatherData.risk_assessment.overall_risk_level)}` }}
                >
                  {weatherData.risk_assessment.overall_risk_level.toUpperCase()} RISK
                </span>
              </div>

              <div className="risk-score-container">
                <div className="risk-number" style={{ color: getRiskColor(weatherData.risk_assessment.overall_risk_level) }}>
                  {weatherData.risk_assessment.overall_risk_score}
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}> /100</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="risk-summary">{weatherData.risk_assessment.summary}</div>
                </div>
              </div>

              {/* Sub-Pathogen Risk Badges */}
              <div className="pathogen-breakdown-row">
                <div className="pathogen-chip">
                  <span className="chip-label">Fungal Blights</span>
                  <span className="chip-score" style={{ color: getRiskColor(weatherData.risk_assessment.blight_risk) }}>
                    {weatherData.risk_assessment.blight_risk}
                  </span>
                </div>
                <div className="pathogen-chip">
                  <span className="chip-label">Bacterial Spot</span>
                  <span className="chip-score" style={{ color: getRiskColor(weatherData.risk_assessment.bacterial_risk) }}>
                    {weatherData.risk_assessment.bacterial_risk}
                  </span>
                </div>
                <div className="pathogen-chip">
                  <span className="chip-label">Corn Rust</span>
                  <span className="chip-score" style={{ color: getRiskColor(weatherData.risk_assessment.rust_risk) }}>
                    {weatherData.risk_assessment.rust_risk}
                  </span>
                </div>
              </div>

              {/* Contributing Factors */}
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  Microclimate Drivers:
                </div>
                <ul className="contributing-factors-list">
                  {weatherData.risk_assessment.contributing_factors.map((factor, i) => (
                    <li key={i}>{factor}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Section: Actionable Weather-Driven Agricultural Advisories */}
          <div style={{ marginTop: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🚜</span> Weather-Driven Farm Action Advisories
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Real-time agronomic adjustments for irrigation, spraying schedules, and preventive scouting.
                </p>
              </div>
              <button
                className="btn-secondary"
                style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                onClick={() => onNavigateToDiagnose && onNavigateToDiagnose()}
              >
                🌿 Inspect Leaf Symptoms
              </button>
            </div>

            <div className="advisories-grid">
              {weatherData.advisories.map((advisory, idx) => (
                <div key={idx} className="panel-card advisory-card">
                  <div className="advisory-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.4rem' }}>{advisory.icon}</span>
                      <div>
                        <span className="advisory-category">{advisory.category} Advisory</span>
                        <h4 className="advisory-title">{advisory.title}</h4>
                      </div>
                    </div>
                    {getUrgencyBadge(advisory.urgency)}
                  </div>
                  <p className="advisory-action">{advisory.action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section: 7-Day Agrometeorological Forecast */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📅</span> 7-Day Agrometeorological Forecast & Disease Trend
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Anticipate precipitation events and multi-day high humidity windows to schedule protective fungicide applications.
            </p>

            <div className="forecast-grid">
              {weatherData.daily_forecast.map((day, idx) => (
                <div key={idx} className="forecast-day-card">
                  <div className="forecast-date">
                    {idx === 0 ? 'Today' : new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="forecast-icon">{day.weather_icon}</div>
                  <div className="forecast-cond">{day.weather_condition}</div>
                  <div className="forecast-temps">
                    <span className="temp-high">{day.temperature_max_c.toFixed(0)}°</span>
                    <span className="temp-low">{day.temperature_min_c.toFixed(0)}°</span>
                  </div>
                  <div className="forecast-rain">
                    💧 {day.precipitation_probability_pct}% ({day.precipitation_sum_mm.toFixed(1)}mm)
                  </div>
                  <div
                    className="forecast-risk-pill"
                    style={{
                      background: `${getRiskColor(day.disease_risk_level)}20`,
                      color: getRiskColor(day.disease_risk_level),
                      border: `1px solid ${getRiskColor(day.disease_risk_level)}40`
                    }}
                  >
                    {day.disease_risk_level} Risk
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
