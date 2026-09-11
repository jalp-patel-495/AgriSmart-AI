import React, { useState, useEffect } from 'react';
import {
  getIrrigationAdvisory,
  getIoTTelemetry,
  getCropRecommendation,
  getSoilPresets,
  getAdvisoryHistory
} from '../services/smartFarmingApi';

export default function SmartFarmingDashboard() {
  const [subTab, setSubTab] = useState('irrigation'); // 'irrigation', 'crops', 'history'

  // --- Smart Irrigation State ---
  const [activeScenario, setActiveScenario] = useState('normal');
  const [iotData, setIotData] = useState(null);
  const [crop, setCrop] = useState('Tomato');
  const [soilType, setSoilType] = useState('Clay Loam');
  const [fieldSize, setFieldSize] = useState(2.0);
  const [moisture15, setMoisture15] = useState(33.8);
  const [moisture30, setMoisture30] = useState(37.5);
  const [ambientTemp, setAmbientTemp] = useState(28.0);
  const [humidity, setHumidity] = useState(62.0);
  const [rainForecast, setRainForecast] = useState(0.0);
  const [irrigationResult, setIrrigationResult] = useState(null);
  const [isCalculatingIrrigation, setIsCalculatingIrrigation] = useState(false);

  // --- Crop Recommendation State ---
  const [soilPresets, setSoilPresets] = useState([]);
  const [nitrogen, setNitrogen] = useState(85.0);
  const [phosphorus, setPhosphorus] = useState(48.0);
  const [potassium, setPotassium] = useState(42.0);
  const [ph, setPh] = useState(6.8);
  const [temp, setTemp] = useState(25.5);
  const [hum, setHum] = useState(75.0);
  const [rainfall, setRainfall] = useState(180.0);
  const [cropResult, setCropResult] = useState(null);
  const [isRecommendingCrop, setIsRecommendingCrop] = useState(false);

  // --- History State ---
  const [historyData, setHistoryData] = useState({ irrigation_logs: [], crop_recommendations: [] });

  // Initial Data Load
  useEffect(() => {
    loadIoT(activeScenario);
    getSoilPresets().then(setSoilPresets);
    loadHistory();
  }, []);

  const loadIoT = async (scenario) => {
    try {
      const data = await getIoTTelemetry(scenario);
      setIotData(data);
      if (data && data.current) {
        setMoisture15(data.current.soil_moisture_15cm);
        setMoisture30(data.current.soil_moisture_30cm);
        // Automatically trigger fresh irrigation evaluation
        runIrrigationCalc(data.current.soil_moisture_15cm, data.current.soil_moisture_30cm, crop, soilType, fieldSize, ambientTemp, humidity, rainForecast);
      }
    } catch (err) {
      console.warn('IoT load error:', err);
    }
  };

  const handleScenarioChange = (scenario) => {
    setActiveScenario(scenario);
    loadIoT(scenario);
  };

  const runIrrigationCalc = async (m15 = moisture15, m30 = moisture30, c = crop, s = soilType, f = fieldSize, t = ambientTemp, h = humidity, r = rainForecast) => {
    setIsCalculatingIrrigation(true);
    try {
      const res = await getIrrigationAdvisory({
        crop: c,
        soil_type: s,
        field_size_hectares: parseFloat(f),
        moisture_15cm: parseFloat(m15),
        moisture_30cm: parseFloat(m30),
        ambient_temp: parseFloat(t),
        humidity: parseFloat(h),
        rain_forecast_mm: parseFloat(r),
        irrigation_system: 'Drip Irrigation',
      });
      setIrrigationResult(res);
      loadHistory();
    } catch (err) {
      console.error('Irrigation calc error:', err);
    } finally {
      setIsCalculatingIrrigation(false);
    }
  };

  const handleRecommendCrop = async () => {
    setIsRecommendingCrop(true);
    try {
      const res = await getCropRecommendation({
        nitrogen: parseFloat(nitrogen),
        phosphorus: parseFloat(phosphorus),
        potassium: parseFloat(potassium),
        ph: parseFloat(ph),
        temperature: parseFloat(temp),
        humidity: parseFloat(hum),
        rainfall: parseFloat(rainfall),
      });
      setCropResult(res);
      loadHistory();
    } catch (err) {
      console.error('Crop recommendation error:', err);
    } finally {
      setIsRecommendingCrop(false);
    }
  };

  const applySoilPreset = (preset) => {
    setNitrogen(preset.default_n);
    setPhosphorus(preset.default_p);
    setPotassium(preset.default_k);
    setPh(preset.default_ph);
    setTemp(preset.default_temp);
    setHum(preset.default_humidity);
    setRainfall(preset.default_rainfall);
  };

  const loadHistory = async () => {
    try {
      const data = await getAdvisoryHistory();
      setHistoryData(data);
    } catch (_) {}
  };

  return (
    <div className="smart-farming-container">
      {/* Header */}
      <div className="smart-farming-header">
        <div>
          <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>💧</span> Smart Irrigation & AI Crop Recommendation
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Physics-based FAO-56 irrigation scheduling correlated with IoT soil telemetry and Random Forest crop suitability modeling.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="sub-tab-pills">
          <button
            className={`sub-tab-btn ${subTab === 'irrigation' ? 'active' : ''}`}
            onClick={() => setSubTab('irrigation')}
          >
            💧 Smart Irrigation & IoT
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'crops' ? 'active' : ''}`}
            onClick={() => {
              setSubTab('crops');
              if (!cropResult) handleRecommendCrop();
            }}
          >
            🌱 AI Crop Recommender
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setSubTab('history');
              loadHistory();
            }}
          >
            📜 History & Logs ({historyData.irrigation_logs.length + historyData.crop_recommendations.length})
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: SMART IRRIGATION & IOT SENSOR HUB
         ========================================================================= */}
      {subTab === 'irrigation' && (
        <div className="irrigation-view-grid">
          {/* Left Column: Simulated IoT Telemetry & Field Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* IoT Sensor Device Bar */}
            <div className="panel-card iot-device-banner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="pulsing-iot-dot" />
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#fff' }}>
                      {iotData ? iotData.current.device_id : 'AGRI-NODE-01'}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-emerald)', marginLeft: '0.6rem' }}>
                      📡 Online (LoRaWAN 868MHz)
                    </span>
                  </div>
                </div>

                <div className="scenario-switcher">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Test Scenario:</span>
                  <button
                    className={`scenario-btn ${activeScenario === 'normal' ? 'active' : ''}`}
                    onClick={() => handleScenarioChange('normal')}
                  >
                    🌿 Optimal
                  </button>
                  <button
                    className={`scenario-btn ${activeScenario === 'drought' ? 'active' : ''}`}
                    onClick={() => handleScenarioChange('drought')}
                  >
                    🌵 Drought
                  </button>
                  <button
                    className={`scenario-btn ${activeScenario === 'waterlogged' ? 'active' : ''}`}
                    onClick={() => handleScenarioChange('waterlogged')}
                  >
                    🌊 Waterlogged
                  </button>
                </div>
              </div>

              {/* IoT Live Dials */}
              {iotData && (
                <div className="iot-metrics-row">
                  <div className="iot-metric-box">
                    <span className="iot-label">Moisture (15cm Root Zone)</span>
                    <span className="iot-value" style={{ color: iotData.current.soil_moisture_15cm < 20 ? '#ef4444' : (iotData.current.soil_moisture_15cm > 45 ? '#3b82f6' : '#34d399') }}>
                      {iotData.current.soil_moisture_15cm}%
                    </span>
                    <span className="iot-sub">Active root intake</span>
                  </div>

                  <div className="iot-metric-box">
                    <span className="iot-label">Moisture (30cm Deep Subsoil)</span>
                    <span className="iot-value" style={{ color: iotData.current.soil_moisture_30cm < 22 ? '#ef4444' : '#34d399' }}>
                      {iotData.current.soil_moisture_30cm}%
                    </span>
                    <span className="iot-sub">Subsurface reservoir</span>
                  </div>

                  <div className="iot-metric-box">
                    <span className="iot-label">Soil Temperature</span>
                    <span className="iot-value">
                      {iotData.current.soil_temp}°C
                    </span>
                    <span className="iot-sub">Thermistor probe</span>
                  </div>

                  <div className="iot-metric-box">
                    <span className="iot-label">Electrical Conductivity</span>
                    <span className="iot-value">
                      {iotData.current.electrical_conductivity} dS/m
                    </span>
                    <span className="iot-sub">Salinity index</span>
                  </div>
                </div>
              )}
            </div>

            {/* Irrigation Parameters Form */}
            <div className="panel-card">
              <h3 className="panel-title" style={{ marginBottom: '1rem' }}>⚙️ Field & Agrometeorological Parameters</h3>
              
              <div className="form-grid-2">
                <div>
                  <label className="input-label">Target Crop</label>
                  <select
                    className="select-input"
                    value={crop}
                    onChange={(e) => {
                      setCrop(e.target.value);
                      runIrrigationCalc(moisture15, moisture30, e.target.value, soilType, fieldSize, ambientTemp, humidity, rainForecast);
                    }}
                  >
                    {['Tomato', 'Potato', 'Corn', 'Apple', 'Rice', 'Wheat', 'Cotton', 'Grapes', 'Banana'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Soil Texture Type</label>
                  <select
                    className="select-input"
                    value={soilType}
                    onChange={(e) => {
                      setSoilType(e.target.value);
                      runIrrigationCalc(moisture15, moisture30, crop, e.target.value, fieldSize, ambientTemp, humidity, rainForecast);
                    }}
                  >
                    {['Clay Loam', 'Sandy Loam', 'Loam', 'Black Cotton Soil', 'Silt Loam'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Field Size (Hectares)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    className="text-input"
                    value={fieldSize}
                    onChange={(e) => {
                      setFieldSize(e.target.value);
                      runIrrigationCalc(moisture15, moisture30, crop, soilType, e.target.value, ambientTemp, humidity, rainForecast);
                    }}
                  />
                </div>

                <div>
                  <label className="input-label">Rain Forecast (Next 24-48h mm)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="text-input"
                    value={rainForecast}
                    onChange={(e) => {
                      setRainForecast(e.target.value);
                      runIrrigationCalc(moisture15, moisture30, crop, soilType, fieldSize, ambientTemp, humidity, e.target.value);
                    }}
                  />
                </div>
              </div>

              {/* Moisture Adjustment Sliders */}
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Upper 15cm Moisture Override:</span>
                  <strong style={{ color: '#fff' }}>{moisture15}%</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="0.5"
                  value={moisture15}
                  className="slider-input"
                  onChange={(e) => {
                    setMoisture15(e.target.value);
                    runIrrigationCalc(e.target.value, moisture30, crop, soilType, fieldSize, ambientTemp, humidity, rainForecast);
                  }}
                />
              </div>

              <div style={{ marginTop: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Deep 30cm Subsoil Moisture Override:</span>
                  <strong style={{ color: '#fff' }}>{moisture30}%</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="0.5"
                  value={moisture30}
                  className="slider-input"
                  onChange={(e) => {
                    setMoisture30(e.target.value);
                    runIrrigationCalc(moisture15, e.target.value, crop, soilType, fieldSize, ambientTemp, humidity, rainForecast);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: AI Smart Irrigation Recommendation Card */}
          <div className="panel-card irrigation-decision-card">
            <div className="panel-header">
              <h3 className="panel-title">💧 FAO-56 Irrigation Decision Engine</h3>
              {isCalculatingIrrigation && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-emerald)' }}>⚡ Recalculating...</span>
              )}
            </div>

            {irrigationResult ? (
              <div>
                {/* Decision Banner */}
                <div
                  className="decision-status-banner"
                  style={{
                    background: `${irrigationResult.status_color}18`,
                    borderLeft: `4px solid ${irrigationResult.status_color}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      className="status-pill"
                      style={{
                        background: irrigationResult.status_color,
                        color: '#fff',
                      }}
                    >
                      {irrigationResult.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      FAO-56 Soil Moisture Deficit
                    </span>
                  </div>
                  <h3 style={{ color: '#fff', fontSize: '1.25rem', marginTop: '0.6rem' }}>
                    {irrigationResult.headline}
                  </h3>
                  <p style={{ color: '#d1d5db', fontSize: '0.88rem', marginTop: '0.35rem', lineHeight: 1.45 }}>
                    {irrigationResult.action_required}
                  </p>
                </div>

                {/* Key Execution Metrics Grid */}
                <div className="execution-metrics-grid">
                  <div className="metric-box">
                    <span className="metric-title">Water Volume / Ha</span>
                    <span className="metric-highlight">
                      {irrigationResult.water_amount_litres_per_ha.toLocaleString()} L
                    </span>
                    <span className="metric-desc">Per hectare requirement</span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-title">Total Field Water</span>
                    <span className="metric-highlight" style={{ color: '#60a5fa' }}>
                      {irrigationResult.total_water_litres.toLocaleString()} L
                    </span>
                    <span className="metric-desc">For {fieldSize} hectares</span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-title">Drip Run Time</span>
                    <span className="metric-highlight" style={{ color: '#fbbf24' }}>
                      {irrigationResult.drip_duration_minutes} mins
                    </span>
                    <span className="metric-desc">{(irrigationResult.drip_duration_minutes / 60).toFixed(1)} hours drip cycle</span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-title">Crop ETc Rate</span>
                    <span className="metric-highlight">
                      {irrigationResult.crop_et_mm_day} mm/day
                    </span>
                    <span className="metric-desc">Daily evapotranspiration</span>
                  </div>
                </div>

                {/* Scientific Deficit & Weather Factors */}
                <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Current Soil Moisture Deficit</span>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>{irrigationResult.soil_water_deficit_pct}% deficit</span>
                  </div>
                  <div className="metric-track" style={{ marginBottom: '0.75rem' }}>
                    <div
                      className="metric-fill"
                      style={{
                        width: `${Math.min(100, irrigationResult.soil_water_deficit_pct * 3)}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #ef4444)'
                      }}
                    />
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🌦️</span>
                    <span><strong>Weather Coordination:</strong> {irrigationResult.weather_adjustment_note}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                Loading irrigation calculations...
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: AI CROP RECOMMENDATION ENGINE
         ========================================================================= */}
      {subTab === 'crops' && (
        <div className="crops-view-grid">
          {/* Left Column: Soil & Climate Tuning Controls */}
          <div className="panel-card">
            <div className="panel-header">
              <h3 className="panel-title">🌱 Soil & Agro-Climatic Parameters</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-emerald)', fontWeight: 600 }}>
                22-Crop ML Model
              </span>
            </div>

            {/* Presets Chips */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Load Regional Agro-Climatic Profile:
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {soilPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    className="preset-chip"
                    onClick={() => applySoilPreset(preset)}
                  >
                    📍 {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Soil Nutrient Sliders */}
            <div className="nutrient-sliders">
              {/* Nitrogen */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Nitrogen (N): <strong>{nitrogen} kg/ha</strong></span>
                  <span className="nutrient-badge" style={{ color: nitrogen > 100 ? '#60a5fa' : '#34d399' }}>
                    {nitrogen > 100 ? 'High' : (nitrogen < 40 ? 'Low' : 'Adequate')}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  value={nitrogen}
                  className="slider-input"
                  onChange={(e) => setNitrogen(e.target.value)}
                />
              </div>

              {/* Phosphorus */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Phosphorus (P): <strong>{phosphorus} kg/ha</strong></span>
                  <span className="nutrient-badge" style={{ color: phosphorus > 80 ? '#fbbf24' : '#34d399' }}>
                    {phosphorus > 80 ? 'High' : (phosphorus < 25 ? 'Low' : 'Adequate')}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  value={phosphorus}
                  className="slider-input"
                  onChange={(e) => setPhosphorus(e.target.value)}
                />
              </div>

              {/* Potassium */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Potassium (K): <strong>{potassium} kg/ha</strong></span>
                  <span className="nutrient-badge" style={{ color: potassium > 100 ? '#fbbf24' : '#34d399' }}>
                    {potassium > 100 ? 'High' : (potassium < 25 ? 'Low' : 'Adequate')}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="210"
                  value={potassium}
                  className="slider-input"
                  onChange={(e) => setPotassium(e.target.value)}
                />
              </div>

              {/* Soil pH */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Soil pH: <strong>{ph}</strong></span>
                  <span className="nutrient-badge" style={{ color: ph < 6.0 ? '#f87171' : (ph > 7.5 ? '#60a5fa' : '#34d399') }}>
                    {ph < 6.0 ? 'Acidic' : (ph > 7.5 ? 'Alkaline' : 'Neutral')}
                  </span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="9.0"
                  step="0.1"
                  value={ph}
                  className="slider-input"
                  onChange={(e) => setPh(e.target.value)}
                />
              </div>

              {/* Climate Inputs Row */}
              <div className="form-grid-3" style={{ marginTop: '1rem' }}>
                <div>
                  <label className="input-label">Avg Temp (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="text-input"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Humidity (%)</label>
                  <input
                    type="number"
                    step="1"
                    className="text-input"
                    value={hum}
                    onChange={(e) => setHum(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Rainfall (mm)</label>
                  <input
                    type="number"
                    step="5"
                    className="text-input"
                    value={rainfall}
                    onChange={(e) => setRainfall(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Run Recommendation CTA */}
            <button
              className="btn-primary"
              style={{ marginTop: '1.5rem' }}
              disabled={isRecommendingCrop}
              onClick={handleRecommendCrop}
            >
              {isRecommendingCrop ? '🔬 Evaluating Agronomic Models...' : '🔍 Predict Optimal Crops'}
            </button>
          </div>

          {/* Right Column: Recommended Crop Ranked Cards */}
          <div>
            {cropResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🏆</span> Top Recommended Crops
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {cropResult.soil_summary}
                  </span>
                </div>

                {cropResult.top_recommendations.map((item, idx) => (
                  <div key={idx} className="panel-card recommended-crop-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="crop-rank-badge">#{idx + 1}</div>
                        <div>
                          <h4 style={{ fontSize: '1.35rem', color: '#fff', fontWeight: 800 }}>{item.crop}</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-emerald)', fontWeight: 600 }}>
                            {item.economic_potential}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span className="match-percent-label">{item.match_percentage}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Match Score</span>
                      </div>
                    </div>

                    <div className="crop-details-grid">
                      <div className="crop-detail-item">
                        <span className="detail-label">Water Need</span>
                        <span className="detail-val">💧 {item.water_requirement}</span>
                      </div>
                      <div className="crop-detail-item">
                        <span className="detail-label">Growth Cycle</span>
                        <span className="detail-val">⏳ {item.growth_duration}</span>
                      </div>
                      <div className="crop-detail-item">
                        <span className="detail-label">Sowing Season</span>
                        <span className="detail-val">☀️ {item.growing_season}</span>
                      </div>
                      <div className="crop-detail-item">
                        <span className="detail-label">Soil Affinity</span>
                        <span className="detail-val">🌱 {item.soil_suitability}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.82rem', color: '#d1d5db' }}>
                      💡 <strong>Cultivation Guideline:</strong> {item.agronomic_advice}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-card" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌱</div>
                <h4>Awaiting Soil Evaluation</h4>
                <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  Adjust soil nutrient sliders on the left or select a regional preset, then click Predict Optimal Crops.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: HISTORICAL ADVISORY LOGS (POSTGRESQL / SQLITE)
         ========================================================================= */}
      {subTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Irrigation Logs Table */}
          <div className="panel-card">
            <h3 className="panel-title" style={{ marginBottom: '1rem' }}>
              💧 Recent Irrigation Decision Records (Database Log)
            </h3>
            {historyData.irrigation_logs.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Timestamp</th>
                      <th>Crop</th>
                      <th>Soil Type</th>
                      <th>Moisture (15cm)</th>
                      <th>Status</th>
                      <th>Water Volume</th>
                      <th>Drip Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.irrigation_logs.map((log) => (
                      <tr key={log.id}>
                        <td>#{log.id}</td>
                        <td>{log.created_at}</td>
                        <td><strong>{log.crop}</strong></td>
                        <td>{log.soil}</td>
                        <td>{log.moisture_15cm}%</td>
                        <td>
                          <span className={`status-pill pill-${log.status.toLowerCase()}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>{log.water_litres_per_ha ? `${log.water_litres_per_ha.toLocaleString()} L/ha` : '0 L'}</td>
                        <td>{log.drip_mins} mins</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No irrigation logs recorded yet.</p>
            )}
          </div>

          {/* Crop Recommendation Logs Table */}
          <div className="panel-card">
            <h3 className="panel-title" style={{ marginBottom: '1rem' }}>
              🌱 Recent AI Crop Recommendations (Database Log)
            </h3>
            {historyData.crop_recommendations.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Timestamp</th>
                      <th>Top Recommended Crop</th>
                      <th>Confidence Match</th>
                      <th>Soil N-P-K</th>
                      <th>Soil pH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.crop_recommendations.map((rec) => (
                      <tr key={rec.id}>
                        <td>#{rec.id}</td>
                        <td>{rec.created_at}</td>
                        <td><strong style={{ color: 'var(--text-emerald)' }}>{rec.top_crop}</strong></td>
                        <td>{rec.confidence}</td>
                        <td>{rec.n_p_k}</td>
                        <td>{rec.ph}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No crop recommendations recorded yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
