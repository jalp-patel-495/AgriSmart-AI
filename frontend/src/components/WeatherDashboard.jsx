import React, { useState, useEffect } from 'react';
import {
  fetchWeatherIntelligence,
  getFarmPresets,
} from '../services/weatherIntelligenceService';

const SUPPORTED_CROPS = [
  'All Crops',
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
  'Tomato',
];

export default function WeatherDashboard({ onNavigateToDiagnose, onWeatherUpdate }) {
  const [presets, setPresets] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isGpsMode, setIsGpsMode] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState('All Crops');

  const [weatherResponse, setWeatherResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isReasoningOpen, setIsReasoningOpen] = useState(true);

  // Initialize presets and default to first preset (Nashik)
  useEffect(() => {
    getFarmPresets().then((list) => {
      setPresets(list);
      if (list && list.length > 0) {
        const defaultFarm = list[0];
        setSelectedLocation(defaultFarm);
        loadWeather(defaultFarm.latitude, defaultFarm.longitude, defaultFarm.name, 'All Crops');
      }
    });
  }, []);

  const loadWeather = async (lat, lon, locationName, cropFilter = selectedCrop) => {
    setLoading(true);
    setGpsError(null);

    const cropParam = cropFilter === 'All Crops' ? null : cropFilter;
    const data = await fetchWeatherIntelligence({
      latitude: lat,
      longitude: lon,
      crop: cropParam,
      soilMoisture: 30.0,
    });

    setWeatherResponse(data);
    setLoading(false);

    if (onWeatherUpdate && data && data.status === 'success') {
      onWeatherUpdate(data);
    }
  };

  const handleSelectPreset = (preset) => {
    setIsGpsMode(false);
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
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        setIsGpsMode(true);
        const userLoc = {
          name: 'Your Field',
          region: 'GPS Detected',
          country: 'Local',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setSelectedLocation(userLoc);
        loadWeather(userLoc.latitude, userLoc.longitude, userLoc.name, selectedCrop);
      },
      (err) => {
        setIsDetectingGps(false);
        console.warn('Geolocation error:', err);
        setGpsError('Location permission is required to detect your field weather. Please allow location access or select an agricultural basin preset.');
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'HIGH':
        return '#ef4444';
      case 'MEDIUM':
        return '#f59e0b';
      case 'LOW':
        return '#10b981';
      default:
        return '#34d399';
    }
  };

  const cropEmoji = (crop) => {
    switch (crop) {
      case 'Apple': return '🍎';
      case 'Blueberry': return '🫐';
      case 'Cherry': return '🍒';
      case 'Corn': return '🌽';
      case 'Grape': return '🍇';
      case 'Orange': return '🍊';
      case 'Peach': return '🍑';
      case 'Bell Pepper': return '🫑';
      case 'Potato': return '🥔';
      case 'Raspberry': return '🫐';
      case 'Soybean': return '🌱';
      case 'Squash': return '🎃';
      case 'Strawberry': return '🍓';
      case 'Tomato': return '🍅';
      case 'All Crops': return '🌱';
      default: return '🌱';
    }
  };

  const isWeatherAvailable = weatherResponse && weatherResponse.status === 'success' && weatherResponse.weather;

  return (
    <div className="weather-container">
      {/* 1. Header & Location Controls */}
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
            {isDetectingGps ? '📡 Acquiring Field GPS...' : '🎯 Detect My Field GPS'}
          </button>
        </div>
      </div>

      {/* GPS Permission Error Banner */}
      {gpsError && (
        <div
          className="panel-card error-card"
          style={{
            marginBottom: '1rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            background: 'rgba(245, 158, 11, 0.1)',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#fde68a', fontSize: '0.95rem' }}>Location Permission Notice</div>
            <p style={{ color: '#fef3c7', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
              {gpsError}
            </p>
          </div>
        </div>
      )}

      {/* Active Location Display */}
      {selectedLocation && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            borderRadius: '0.75rem',
            padding: '0.75rem 1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📍</span>
            <strong style={{ color: '#fff', fontSize: '1rem' }}>
              {isGpsMode ? 'Your Field' : selectedLocation.name}
            </strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              (Latitude: {Number(selectedLocation.latitude).toFixed(4)}°, Longitude: {Number(selectedLocation.longitude).toFixed(4)}°)
            </span>
          </div>
          {isGpsMode && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                border: '1px solid rgba(52, 211, 153, 0.4)',
              }}
            >
              GPS Verified
            </span>
          )}
        </div>
      )}

      {/* Preset Farm Hubs Chips */}
      <div className="presets-bar">
        <span className="presets-label">Agricultural Basin Presets:</span>
        <div className="presets-scroll">
          {presets.map((preset, idx) => {
            const isSelected = !isGpsMode && selectedLocation?.name === preset.name;
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

      {/* 2. Crop Risk Filter Bar (14 Supported Crops) */}
      <div className="crop-filter-row">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Crop Risk Filter:
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {SUPPORTED_CROPS.map((crop) => (
            <button
              key={crop}
              className={`crop-filter-chip ${selectedCrop === crop ? 'active' : ''}`}
              onClick={() => handleCropChange(crop)}
            >
              {cropEmoji(crop)} {crop}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Loading State */}
      {loading && (
        <div className="panel-card weather-loading-box">
          <div style={{ fontSize: '2.5rem', animation: 'spin 1.8s linear infinite' }}>🌦️</div>
          <h4 style={{ marginTop: '1rem', color: '#fff' }}>Loading weather intelligence...</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Querying Open-Meteo high-resolution atmospheric models for your field coordinates.
          </p>
        </div>
      )}

      {/* 4. API Error / Weather Unavailable State */}
      {!loading && (!isWeatherAvailable || weatherResponse?.status === 'weather_unavailable') && (
        <div className="panel-card error-card">
          <div style={{ fontSize: '2.5rem' }}>🌦️</div>
          <h4 style={{ marginTop: '0.5rem', color: '#f87171' }}>Weather Data Unavailable</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Weather data is currently unavailable. Please try again later.
          </p>
          <button
            className="btn-secondary"
            style={{ marginTop: '1rem', width: 'auto' }}
            onClick={() => selectedLocation && loadWeather(selectedLocation.latitude, selectedLocation.longitude, selectedLocation.name)}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 5. Main Weather Intelligence Content */}
      {!loading && isWeatherAvailable && (
        <>
          {/* Top Row: Current Weather Hero + Dynamic Weather Risk */}
          <div className="weather-hero-grid">
            {/* Current Weather Card */}
            <div className="panel-card weather-main-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="location-tag">
                    📍 {isGpsMode ? 'Your Field' : selectedLocation?.name}
                  </span>
                  <div className="temp-display">
                    <span className="weather-icon-large">
                      {weatherResponse.weather.weather_icon || '🌤️'}
                    </span>
                    <span className="temp-value">
                      {weatherResponse.weather.temperature.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="condition-label">
                    {weatherResponse.weather.weather_condition}
                  </div>
                </div>

                <div className="telemetry-compact">
                  <div className="telemetry-item">
                    <span className="telemetry-label">Relative Humidity</span>
                    <span
                      className="telemetry-val"
                      style={{
                        color: weatherResponse.weather.humidity > 75 ? '#f87171' : '#34d399',
                      }}
                    >
                      💧 {weatherResponse.weather.humidity}%
                    </span>
                  </div>
                  <div className="telemetry-item">
                    <span className="telemetry-label">Rain Probability</span>
                    <span
                      className="telemetry-val"
                      style={{
                        color: weatherResponse.weather.rain_probability >= 60 ? '#60a5fa' : 'var(--text-secondary)',
                      }}
                    >
                      🌧️ {weatherResponse.weather.rain_probability}%
                    </span>
                  </div>
                  <div className="telemetry-item">
                    <span className="telemetry-label">24–48h Forecast Precip</span>
                    <span className="telemetry-val">
                      🌊 {weatherResponse.weather.forecast_precipitation} mm
                    </span>
                  </div>
                  {weatherResponse.weather.wind_speed_kmh !== null && weatherResponse.weather.wind_speed_kmh !== undefined && (
                    <div className="telemetry-item">
                      <span className="telemetry-label">Wind Velocity</span>
                      <span className="telemetry-val">
                        💨 {weatherResponse.weather.wind_speed_kmh.toFixed(1)} km/h
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="weather-metric-bars">
                <div>
                  <div className="bar-header">
                    <span>Humidity Risk Threshold</span>
                    <span>{weatherResponse.weather.humidity}% (Threshold: &gt;75%)</span>
                  </div>
                  <div className="metric-track">
                    <div
                      className="metric-fill"
                      style={{
                        width: `${Math.min(100, weatherResponse.weather.humidity)}%`,
                        background:
                          weatherResponse.weather.humidity > 75
                            ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                            : 'linear-gradient(90deg, #10b981, #3b82f6)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Weather Risk Card (Replacing unsupported 100/100 score) */}
            <div
              className="panel-card risk-radar-card"
              style={{ borderColor: getRiskColor(weatherResponse.weather_risk) }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <span>⚠️</span> Weather Risk
                </h3>
                <span
                  className="risk-level-badge"
                  style={{
                    background: `${getRiskColor(weatherResponse.weather_risk)}25`,
                    color: getRiskColor(weatherResponse.weather_risk),
                    border: `1px solid ${getRiskColor(weatherResponse.weather_risk)}`,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                  }}
                >
                  {weatherResponse.weather_risk} RISK
                </span>
              </div>

              <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: getRiskColor(weatherResponse.weather_risk) }}>
                  {weatherResponse.weather_risk}
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.45, margin: '0.35rem 0 0 0' }}>
                  {weatherResponse.weather_risk === 'HIGH'
                    ? 'High atmospheric moisture and rain probability present elevated stress on field operations and foliar health.'
                    : weatherResponse.weather_risk === 'MEDIUM'
                    ? 'Moderate agrometeorological indicators detected. Scout interior rows and verify irrigation schedule.'
                    : 'Mild, favorable atmospheric conditions. Normal field operations can proceed.'}
                </p>
              </div>

              {/* Verified Backend Reasoning */}
              <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.35rem', fontWeight: 700 }}>
                  Agrometeorological Drivers:
                </div>
                <ul className="contributing-factors-list" style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {weatherResponse.reasoning && weatherResponse.reasoning.length > 0 ? (
                    weatherResponse.reasoning.map((factor, i) => (
                      <li key={i} style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                        {factor}
                      </li>
                    ))
                  ) : (
                    <li style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Normal atmospheric conditions</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* 6. Section: Weather-Driven Farm Action Advisories */}
          <div style={{ marginTop: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <span>🚜</span> Weather-Driven Farm Action Advisories
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Real-time agronomic adjustments for irrigation scheduling and disease monitoring.
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
              {/* Primary Agrometeorological Recommendation */}
              <div className="panel-card advisory-card">
                <div className="advisory-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>📢</span>
                    <div>
                      <span className="advisory-category">Primary Action</span>
                      <h4 className="advisory-title">Field Management Recommendation</h4>
                    </div>
                  </div>
                  <span
                    className="advisory-badge"
                    style={{
                      background: `${getRiskColor(weatherResponse.weather_risk)}25`,
                      color: getRiskColor(weatherResponse.weather_risk),
                      border: `1px solid ${getRiskColor(weatherResponse.weather_risk)}`,
                    }}
                  >
                    {weatherResponse.weather_risk} PRIORITY
                  </span>
                </div>
                <p className="advisory-action" style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9' }}>
                  {weatherResponse.recommendation}
                </p>
              </div>

              {/* 7. Irrigation Advisory */}
              <div className="panel-card advisory-card">
                <div className="advisory-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>💧</span>
                    <div>
                      <span className="advisory-category">Irrigation Advisory</span>
                      <h4 className="advisory-title">
                        {weatherResponse.irrigation_prediction === 'YES'
                          ? 'Irrigation Required'
                          : weatherResponse.irrigation_prediction === 'NO'
                          ? 'Irrigation Not Required'
                          : 'Irrigation Telemetry Unavailable'}
                      </h4>
                    </div>
                  </div>
                  <span
                    className={`advisory-badge ${
                      weatherResponse.irrigation_prediction === 'YES' ? 'badge-warning' : 'badge-safe'
                    }`}
                  >
                    {weatherResponse.irrigation_prediction === 'YES' ? 'REQUIRED' : 'ADEQUATE'}
                  </span>
                </div>
                <p className="advisory-action">
                  {weatherResponse.irrigation_prediction === 'YES' ? (
                    weatherResponse.weather.rain_probability >= 60 ? (
                      <span>
                        🌧️ <strong>Rain is likely ({weatherResponse.weather.rain_probability}%).</strong> Delay irrigation to avoid soil saturation and nutrient runoff.
                      </span>
                    ) : (
                      <span>
                        ☀️ <strong>Soil moisture is low and rain is unlikely.</strong> Irrigation is recommended under current conditions.
                      </span>
                    )
                  ) : weatherResponse.irrigation_prediction === 'NO' ? (
                    <span>
                      ✅ <strong>Soil moisture is currently sufficient.</strong> No irrigation needed now.
                    </span>
                  ) : (
                    <span>Soil moisture telemetry not provided; irrigation model could not evaluate deficit.</span>
                  )}
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  Note: The ML irrigation model evaluates soil moisture, temperature, and humidity; rainfall acts as an external weather decision layer.
                </div>
              </div>

              {/* 8. Disease Monitoring Advisory */}
              <div className="panel-card advisory-card">
                <div className="advisory-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>🦠</span>
                    <div>
                      <span className="advisory-category">Pathogen Monitoring</span>
                      <h4 className="advisory-title">
                        {weatherResponse.disease_monitoring ? 'Disease Monitoring' : 'Foliar Health'}
                      </h4>
                    </div>
                  </div>
                  <span className="advisory-badge badge-advisory">MONITORING</span>
                </div>
                <p className="advisory-action">
                  {weatherResponse.disease_monitoring ? (
                    weatherResponse.disease_monitoring.includes('Low Confidence') ? (
                      <span style={{ color: '#fbbf24' }}>
                        ⚠️ <strong>Low Confidence — Further Inspection Needed.</strong> Please upload a clearer leaf image in Disease Detector. Confirmed disease information and chemical treatment are suppressed.
                      </span>
                    ) : (
                      <span>{weatherResponse.disease_monitoring}</span>
                    )
                  ) : weatherResponse.weather.humidity >= 75 ? (
                    <span>
                      High ambient humidity ({weatherResponse.weather.humidity}%) presents elevated moisture conditions. Inspect lower interior canopies regularly.
                    </span>
                  ) : (
                    <span>
                      Current atmospheric conditions do not indicate high disease development pressure. Continue standard preventive scouting.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 9. Expandable Reasoning Section */}
          <div className="panel-card" style={{ marginTop: '1.5rem', padding: '1.25rem 1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setIsReasoningOpen(!isReasoningOpen)}
            >
              <h4 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔍</span> Why this recommendation?
              </h4>
              <span style={{ color: '#34d399', fontSize: '1.2rem', userSelect: 'none' }}>
                {isReasoningOpen ? '▲' : '▼'}
              </span>
            </div>

            {isReasoningOpen && (
              <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
                  Transparent deterministic justifications computed by the AgriSmart AI agrometeorological engine:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {weatherResponse.reasoning && weatherResponse.reasoning.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#f1f5f9',
                      }}
                    >
                      <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 10. Real Open-Meteo Forecast Cards */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📅</span> Verified Open-Meteo Forecast
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Real multi-day forecast dates, precipitation probabilities, and agrometeorological disease risk trends.
            </p>

            <div className="forecast-grid">
              {weatherResponse.daily_forecast && weatherResponse.daily_forecast.length > 0 ? (
                weatherResponse.daily_forecast.map((day, idx) => (
                  <div key={idx} className="forecast-day-card">
                    <div className="forecast-date">
                      {idx === 0
                        ? 'Today'
                        : new Date(day.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                    </div>
                    <div className="forecast-icon">{day.weather_icon || '🌤️'}</div>
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
                        border: `1px solid ${getRiskColor(day.disease_risk_level)}40`,
                      }}
                    >
                      {day.disease_risk_level} Risk
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
                  Forecast for next 24–48 hours: {weatherResponse.weather.forecast_precipitation} mm rain expected with {weatherResponse.weather.rain_probability}% precipitation probability.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
