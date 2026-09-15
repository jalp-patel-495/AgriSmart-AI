import React, { useState, useEffect } from 'react';
import {
  predictRealIrrigation,
  getCropRecommendation,
  getSoilPresets,
  getAdvisoryHistory,
  getCropsCatalog,
  getCropTrainingMeans,
} from '../../services/smartFarmingApi';
import { fetchWeatherIntelligence } from '../../services/weatherIntelligenceService';

// Predefined test scenarios to quickly populate field parameters
const PRESET_SCENARIOS = {
  optimal: {
    label: '🌿 Optimal (60% Moisture)',
    soilMoisture: 60.0,
    temperature: 24.0,
    humidity: 65.0,
    rainfall: 0.0,
  },
  drought: {
    label: '🌵 Drought (15% Moisture)',
    soilMoisture: 15.0,
    temperature: 34.0,
    humidity: 35.0,
    rainfall: 0.0,
  },
  saturated: {
    label: '🌊 Saturated (85% Moisture)',
    soilMoisture: 85.0,
    temperature: 22.0,
    humidity: 85.0,
    rainfall: 15.0,
  },
};

export default function FarmerSmartIrrigation() {
  // Top Active Tab: 'irrigation' (default), 'crops', 'history'
  const [activeTab, setActiveTab] = useState('irrigation');

  // ==========================================
  // SMART IRRIGATION STATE
  // ==========================================
  const [activeScenario, setActiveScenario] = useState(null);
  const [soilMoisture, setSoilMoisture] = useState(25.0);
  const [temperature, setTemperature] = useState(30.0);
  const [humidity, setHumidity] = useState(55.0);
  const [rainfall, setRainfall] = useState(0.0);

  // Weather telemetry context
  const [weatherOverlay, setWeatherOverlay] = useState(null);
  const [isSyncingWeather, setIsSyncingWeather] = useState(false);

  // Inference state
  const [irrigationResult, setIrrigationResult] = useState(null);
  const [isAnalyzingIrrigation, setIsAnalyzingIrrigation] = useState(false);
  const [irrigationError, setIrrigationError] = useState(null);

  // ==========================================
  // AI CROP RECOMMENDER STATE
  // ==========================================
  const [soilPresets, setSoilPresets] = useState([]);
  const [cropsCatalog, setCropsCatalog] = useState([]);
  const [cropTrainingMeans, setCropTrainingMeans] = useState({});
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  const [nitrogen, setNitrogen] = useState(85.0);
  const [phosphorus, setPhosphorus] = useState(48.0);
  const [potassium, setPotassium] = useState(42.0);
  const [cropTemp, setCropTemp] = useState(25.5);
  const [cropHum, setCropHum] = useState(75.0);
  const [ph, setPh] = useState(6.8);
  const [cropRainfall, setCropRainfall] = useState(180.0);

  const [cropModelVersion, setCropModelVersion] = useState('95class');
  const [cropResult, setCropResult] = useState(null);
  const [isRecommendingCrop, setIsRecommendingCrop] = useState(false);
  const [cropError, setCropError] = useState(null);
  const [selectedTestCrop, setSelectedTestCrop] = useState(null);
  const [testingProfile, setTestingProfile] = useState(null);

  // ==========================================
  // PERSISTED REAL HISTORY STATE
  // ==========================================
  const [irrigationHistory, setIrrigationHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('agrismart_irrigation_real_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [cropHistory, setCropHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('agrismart_crop_real_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Initial load: soil presets, crop catalog, training means, and DB history
  useEffect(() => {
    getSoilPresets().then((data) => {
      if (Array.isArray(data)) setSoilPresets(data);
    });
    getCropsCatalog().then((data) => {
      if (Array.isArray(data) && data.length > 0) setCropsCatalog(data);
    });
    getCropTrainingMeans().then((means) => {
      if (means && typeof means === 'object') setCropTrainingMeans(means);
    });
    getAdvisoryHistory().then((data) => {
      if (data) {
        if (Array.isArray(data.irrigation_logs) && data.irrigation_logs.length > 0) {
          setIrrigationHistory((prev) => {
            if (prev.length === 0) {
              const mapped = data.irrigation_logs.map((log) => ({
                id: log.id,
                date: log.created_at || 'Recorded session',
                crop: log.crop || 'Field Plot',
                inputs: `Moisture: ${log.moisture_15cm}%, Soil: ${log.soil || 'Loam'}`,
                prediction: log.status === 'Immediate' || log.status === 'Required' ? 'YES' : 'NO',
                confidence: '95.0%',
                priority: log.status === 'Immediate' ? 'HIGH' : 'NORMAL',
                recommendation: log.status === 'Immediate'
                  ? 'The irrigation model predicts that irrigation is required under the provided conditions.'
                  : 'Optimal soil moisture: The irrigation model predicts that irrigation is not required.',
              }));
              try {
                localStorage.setItem('agrismart_irrigation_real_history', JSON.stringify(mapped));
              } catch (_) {}
              return mapped;
            }
            return prev;
          });
        }

        if (Array.isArray(data.crop_recommendations) && data.crop_recommendations.length > 0) {
          setCropHistory((prev) => {
            if (prev.length === 0) {
              const mapped = data.crop_recommendations.map((rec) => ({
                id: rec.id,
                date: rec.created_at || 'Recorded session',
                crop: rec.top_crop,
                inputs: `N-P-K: ${rec.n_p_k}, pH: ${rec.ph}`,
                prediction: rec.top_crop,
                confidence: rec.confidence || '90.0%',
                recommendation: `${rec.top_crop} is recommended based on soil nutrient balance and regional climate.`,
              }));
              try {
                localStorage.setItem('agrismart_crop_real_history', JSON.stringify(mapped));
              } catch (_) {}
              return mapped;
            }
            return prev;
          });
        }
      }
    });
  }, []);

  // --- Quick Scenario Preset Handler ---
  const handleSelectScenario = (key) => {
    setActiveScenario(key);
    const scen = PRESET_SCENARIOS[key];
    if (scen) {
      setSoilMoisture(scen.soilMoisture);
      setTemperature(scen.temperature);
      setHumidity(scen.humidity);
      setRainfall(scen.rainfall);
    }
  };

  // --- Weather Sync Handler ---
  const handleSyncWeather = async () => {
    setIsSyncingWeather(true);
    try {
      const data = await fetchWeatherIntelligence({
        latitude: 22.5645,
        longitude: 72.9289,
        soilMoisture: Number(soilMoisture),
        temperature: Number(temperature),
        humidity: Number(humidity),
      });

      if (data && data.status === 'success' && data.weather) {
        setTemperature(parseFloat(data.weather.temperature.toFixed(1)));
        setHumidity(data.weather.humidity);
        setRainfall(data.weather.forecast_precipitation || 0.0);
        setWeatherOverlay(data);
      }
    } catch (err) {
      console.warn('Weather sync error:', err);
    } finally {
      setIsSyncingWeather(false);
    }
  };

  // --- Run Real Irrigation Model Inference ---
  const handleAnalyzeIrrigation = async () => {
    setIrrigationError(null);

    if (
      soilMoisture === '' || isNaN(soilMoisture) ||
      temperature === '' || isNaN(temperature) ||
      humidity === '' || isNaN(humidity)
    ) {
      setIrrigationError('Please enter valid numerical values for Soil Moisture, Temperature, and Humidity.');
      return;
    }

    setIsAnalyzingIrrigation(true);
    try {
      const parsedMoisture = parseFloat(soilMoisture);
      const parsedTemp = parseFloat(temperature);
      const parsedHum = parseFloat(humidity);
      const parsedRain = rainfall !== '' && !isNaN(rainfall) ? parseFloat(rainfall) : 0.0;

      // 1. Call real irrigation model through backend API
      const res = await predictRealIrrigation({
        soil_moisture: parsedMoisture,
        temperature: parsedTemp,
        humidity: parsedHum,
        rainfall: parsedRain,
      });

      // 2. Refresh weather context if possible
      let weatherData = weatherOverlay;
      try {
        const wRes = await fetchWeatherIntelligence({
          latitude: 22.5645,
          longitude: 72.9289,
          soilMoisture: parsedMoisture,
          temperature: parsedTemp,
          humidity: parsedHum,
        });
        if (wRes && wRes.status === 'success') {
          weatherData = wRes;
          setWeatherOverlay(wRes);
        }
      } catch (_) {}

      // Format confidence percentage
      const confNum = typeof res.confidence === 'number' ? res.confidence : parseFloat(res.confidence || 0.95);
      const confStr = `${Math.round(confNum * 100)}%`;

      const resultPayload = {
        required: res.required,
        prediction: res.prediction || (res.required ? 'YES' : 'NO'),
        confidence: confStr,
        confidence_raw: confNum,
        priority: res.priority || (res.required ? 'HIGH' : 'NONE'),
        recommendation: res.recommendation || (res.required
          ? 'The irrigation model predicts that irrigation is required under the provided conditions.'
          : 'Optimal soil moisture: The irrigation model predicts that irrigation is not required under the provided conditions.'),
        weather: weatherData,
        submittedInputs: {
          soilMoisture: parsedMoisture,
          temperature: parsedTemp,
          humidity: parsedHum,
          rainfall: parsedRain,
        },
      };

      setIrrigationResult(resultPayload);

      // 3. Persist log to real history
      const now = new Date();
      const newLog = {
        id: Date.now(),
        date: now.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        crop: 'Field Plot',
        inputs: `Moisture: ${parsedMoisture}%, Temp: ${parsedTemp}°C, Humidity: ${parsedHum}%, Rain: ${parsedRain}mm`,
        prediction: resultPayload.prediction,
        confidence: confStr,
        priority: resultPayload.priority,
        recommendation: resultPayload.recommendation,
      };

      setIrrigationHistory((prev) => {
        const updated = [newLog, ...prev.slice(0, 24)];
        try {
          localStorage.setItem('agrismart_irrigation_real_history', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    } catch (err) {
      console.error('Irrigation analysis error:', err);
      setIrrigationError(err.message || 'Unable to generate irrigation recommendation. Please try again.');
    } finally {
      setIsAnalyzingIrrigation(false);
    }
  };

  // --- Run Real Crop Recommendation Model Inference ---
  const handleRecommendCrop = async () => {
    setCropError(null);

    if (
      nitrogen === '' || isNaN(nitrogen) ||
      phosphorus === '' || isNaN(phosphorus) ||
      potassium === '' || isNaN(potassium) ||
      cropTemp === '' || isNaN(cropTemp) ||
      cropHum === '' || isNaN(cropHum) ||
      ph === '' || isNaN(ph) ||
      cropRainfall === '' || isNaN(cropRainfall)
    ) {
      setCropError('Please provide all 7 soil and agro-climate parameters (N, P, K, pH, Temperature, Humidity, Rainfall).');
      return;
    }

    setIsRecommendingCrop(true);
    try {
      const payload = {
        nitrogen: parseFloat(nitrogen),
        phosphorus: parseFloat(phosphorus),
        potassium: parseFloat(potassium),
        ph: parseFloat(ph),
        temperature: parseFloat(cropTemp),
        humidity: parseFloat(cropHum),
        rainfall: parseFloat(cropRainfall),
        model_version: cropModelVersion,
      };

      const res = await getCropRecommendation(payload);
      const topRecs = res.top_recommendations || [];
      const primaryRec = topRecs.length > 0 ? topRecs[0] : null;
      const topCrop = primaryRec ? primaryRec.crop : (res.recommended_crop || 'Wheat');
      const conf = primaryRec ? primaryRec.match_percentage : (res.confidence ? `${Math.round(res.confidence * 100)}%` : '92%');

      const cropResPayload = {
        crop: topCrop,
        confidence: conf,
        top_recommendations: topRecs,
        model_version: res.model_version || cropModelVersion,
        is_experimental: (res.model_version || cropModelVersion) === '95class',
        recommended_profile: primaryRec || {},
        inputs: payload,
      };

      setCropResult(cropResPayload);

      // Persist log to real history
      const now = new Date();
      const newRec = {
        id: Date.now(),
        date: now.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        crop: topCrop,
        inputs: `N: ${payload.nitrogen}, P: ${payload.phosphorus}, K: ${payload.potassium}, pH: ${payload.ph}, Rain: ${payload.rainfall}mm`,
        prediction: `${topCrop} (${conf})`,
        confidence: conf,
        recommendation: `${topCrop} is highly suitable for your soil N-P-K nutrient balance and climatic profile.`,
      };

      setCropHistory((prev) => {
        const updated = [newRec, ...prev.slice(0, 24)];
        try {
          localStorage.setItem('agrismart_crop_real_history', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    } catch (err) {
      console.error('Crop recommendation error:', err);
      setCropError(err.message || 'Unable to generate crop recommendation. Please try again.');
    } finally {
      setIsRecommendingCrop(false);
    }
  };

  const applySoilPreset = (preset) => {
    setNitrogen(preset.default_n);
    setPhosphorus(preset.default_p);
    setPotassium(preset.default_k);
    setPh(preset.default_ph);
    setCropTemp(preset.default_temp);
    setCropHum(preset.default_humidity);
    setCropRainfall(preset.default_rainfall);
  };

  const handleTestCropPreset = (cropItem) => {
    if (!cropItem || !cropItem.crop_name) return;
    const canonicalName = cropItem.crop_name;

    setCropResult(null);
    setCropError(null);
    setSelectedTestCrop(canonicalName);
    setTestingProfile(cropItem);

    const cropKey = canonicalName.toLowerCase().trim();
    const meanData = cropTrainingMeans[cropKey] ||
      (cropKey.includes('maize') || cropKey.includes('corn') ? cropTrainingMeans['maize'] : null) ||
      (cropKey.includes('brinjal') || cropKey.includes('eggplant') ? cropTrainingMeans['brinjal / eggplant'] : null);

    if (meanData) {
      setNitrogen(parseFloat(meanData.nitrogen.toFixed(1)));
      setPhosphorus(parseFloat(meanData.phosphorus.toFixed(1)));
      setPotassium(parseFloat(meanData.potassium.toFixed(1)));
      setCropTemp(parseFloat(meanData.temperature.toFixed(1)));
      setCropHum(parseFloat(meanData.humidity.toFixed(1)));
      setPh(parseFloat(meanData.ph.toFixed(2)));
      setCropRainfall(parseFloat(meanData.rainfall.toFixed(1)));
    } else {
      const tMin = cropItem.temperature_min_c ?? 20;
      const tMax = cropItem.temperature_max_c ?? 30;
      const rMin = cropItem.rainfall_min_mm ?? 500;
      const rMax = cropItem.rainfall_max_mm ?? 1000;
      const phMin = cropItem.ph_min ?? 6.0;
      const phMax = cropItem.ph_max ?? 7.5;

      setCropTemp(parseFloat(((tMin + tMax) / 2).toFixed(1)));
      setCropRainfall(parseFloat(((rMin + rMax) / 2).toFixed(0)));
      setPh(parseFloat(((phMin + phMax) / 2).toFixed(1)));
      setCropHum(
        cropItem.humidity_preference === 'high' ? 80.0 :
        cropItem.humidity_preference === 'low' ? 40.0 : 65.0
      );
      setNitrogen(80.0);
      setPhosphorus(45.0);
      setPotassium(45.0);
    }

    setShowCatalogModal(false);
    setActiveTab('crops');
  };

  const CROP_CATEGORIES = ['All', 'Cereal', 'Pulse', 'Vegetable', 'Fruit', 'Oilseed', 'Spice', 'Commercial', 'Fibre', 'Medicinal', 'Fodder'];

  const filteredCrops = cropsCatalog.filter((c) => {
    const term = catalogSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      c.crop_name?.toLowerCase().includes(term) ||
      c.scientific_name?.toLowerCase().includes(term) ||
      c.hindi_name?.toLowerCase().includes(term) ||
      c.gujarati_name?.toLowerCase().includes(term) ||
      c.crop_category?.toLowerCase().includes(term);

    const matchesCategory =
      catalogCategory === 'All' ||
      c.crop_category?.toLowerCase().includes(catalogCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  const handleClearHistory = () => {
    setIrrigationHistory([]);
    setCropHistory([]);
    try {
      localStorage.removeItem('agrismart_irrigation_real_history');
      localStorage.removeItem('agrismart_crop_real_history');
    } catch (_) {}
  };

  return (
    <div className="role-page-container smart-farming-container">
      {/* =========================================================
          1. PAGE HEADER
         ========================================================= */}
      <div className="smart-farming-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <span>💧</span> Smart Irrigation & AI Crop Recommendation
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
            AI-powered irrigation decision support and crop suitability recommendations.
          </p>
        </div>

        {/* Top Navigation Tabs */}
        <div className="sub-tab-pills">
          <button
            className={`sub-tab-btn ${activeTab === 'irrigation' ? 'active' : ''}`}
            onClick={() => setActiveTab('irrigation')}
          >
            💧 Smart Irrigation
          </button>
          <button
            className={`sub-tab-btn ${activeTab === 'crops' ? 'active' : ''}`}
            onClick={() => setActiveTab('crops')}
          >
            🌱 AI Crop Recommender{' '}
            <span style={{
              fontSize: '0.68rem',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.5)',
              borderRadius: '4px',
              padding: '0.1rem 0.35rem',
              marginLeft: '0.35rem',
              fontWeight: 700
            }}>
              95 Crops
            </span>
          </button>
          <button
            className={`sub-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📋 History & Logs
          </button>
        </div>
      </div>

      {/* =========================================================
          2. SMART IRRIGATION TAB
         ========================================================= */}
      {activeTab === 'irrigation' && (
        <div className="irrigation-view-grid">
          {/* -----------------------------------------------------
              LEFT COLUMN: Field & Environmental Parameters
             ----------------------------------------------------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Quick Test Scenarios */}
            <div className="panel-card" style={{ padding: '0.85rem 1.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Quick Presets:</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>
                    Load typical conditions
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {Object.entries(PRESET_SCENARIOS).map(([key, item]) => (
                    <button
                      key={key}
                      className={`scenario-btn ${activeScenario === key ? 'active' : ''}`}
                      onClick={() => handleSelectScenario(key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Field & Environmental Parameters Card */}
            <div className="panel-card">
              <h3 className="panel-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399' }}>
                <span>🌱</span> Field & Environmental Parameters
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. Soil Moisture (%) with Interactive Slider & Number Input */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="input-label" style={{ margin: 0, fontWeight: 700 }}>
                      🌱 Soil Moisture (%)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={soilMoisture}
                        onChange={(e) => {
                          setSoilMoisture(e.target.value);
                          setActiveScenario(null);
                        }}
                        style={{
                          width: '70px',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          color: '#fff',
                          padding: '0.25rem 0.5rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                        }}
                      />
                      <span style={{
                        color: soilMoisture < 25 ? '#ef4444' : soilMoisture > 75 ? '#60a5fa' : '#34d399',
                        fontWeight: 800,
                        fontSize: '0.85rem'
                      }}>
                        {soilMoisture < 25 ? 'DEFICIT' : soilMoisture > 75 ? 'HIGH' : 'ADEQUATE'}
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={soilMoisture}
                    className="slider-input"
                    onChange={(e) => {
                      setSoilMoisture(e.target.value);
                      setActiveScenario(null);
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    <span>0% (Critical Dry)</span>
                    <span>50% (Comfortable)</span>
                    <span>100% (Saturated)</span>
                  </div>
                </div>

                {/* 2. Temperature & Humidity in 2-column form */}
                <div className="form-grid-2">
                  <div>
                    <label className="input-label">🌡️ Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="text-input"
                      value={temperature}
                      onChange={(e) => {
                        setTemperature(e.target.value);
                        setActiveScenario(null);
                      }}
                      placeholder="e.g. 28.0"
                    />
                  </div>

                  <div>
                    <label className="input-label">💧 Humidity (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      className="text-input"
                      value={humidity}
                      onChange={(e) => {
                        setHumidity(e.target.value);
                        setActiveScenario(null);
                      }}
                      placeholder="e.g. 65"
                    />
                  </div>
                </div>

                {/* 3. Contextual Rainfall & Weather Sync */}
                <div style={{
                  padding: '1rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '1rem' }}>🌦️</span>
                      <strong style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>Weather Context (Optional)</strong>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '0.3rem 0.65rem' }}
                      onClick={handleSyncWeather}
                      disabled={isSyncingWeather}
                    >
                      {isSyncingWeather ? '📡 Syncing...' : '📡 Sync Live Weather'}
                    </button>
                  </div>

                  <div>
                    <label className="input-label">🌧️ Rainfall (mm)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="text-input"
                      value={rainfall}
                      onChange={(e) => setRainfall(e.target.value)}
                      placeholder="Rainfall expected or recent (mm)"
                    />
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                      Provides meteorological context to accompany the soil moisture prediction.
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {irrigationError && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: 'var(--radius-md)',
                    color: '#fca5a5',
                    fontSize: '0.85rem'
                  }}>
                    ⚠️ {irrigationError}
                  </div>
                )}

                {/* Action Button: [Analyze Irrigation] */}
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    padding: '0.85rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                  disabled={isAnalyzingIrrigation}
                  onClick={handleAnalyzeIrrigation}
                >
                  {isAnalyzingIrrigation ? (
                    <>
                      <span className="spinner-icon">⚡</span>
                      <span>Running Smart Irrigation Model...</span>
                    </>
                  ) : (
                    <>
                      <span>💧</span>
                      <span>Analyze Irrigation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* -----------------------------------------------------
              RIGHT COLUMN: AI Irrigation Decision & Input Summary
             ----------------------------------------------------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="panel-card irrigation-decision-card">
              <div className="panel-header" style={{ marginBottom: '1rem' }}>
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399' }}>
                  <span>💧</span> AI Irrigation Decision
                </h3>
                {isAnalyzingIrrigation && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-emerald)' }}>⚡ Evaluating model...</span>
                )}
              </div>

              {irrigationResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* ===================================================
                      4. INPUT SUMMARY CARDS (Compact Cards)
                     =================================================== */}
                  <div>
                    <div style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.05em',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                    }}>
                      Observed Environmental Parameters:
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                      gap: '0.65rem'
                    }}>
                      <div className="metric-box" style={{ padding: '0.65rem 0.85rem' }}>
                        <span className="metric-title">Soil Moisture</span>
                        <div className="metric-highlight" style={{ fontSize: '1.4rem' }}>
                          {irrigationResult.submittedInputs.soilMoisture} %
                        </div>
                        <span className="metric-desc">Sensor reading</span>
                      </div>

                      <div className="metric-box" style={{ padding: '0.65rem 0.85rem' }}>
                        <span className="metric-title">Temperature</span>
                        <div className="metric-highlight" style={{ fontSize: '1.4rem', color: '#f59e0b' }}>
                          {irrigationResult.submittedInputs.temperature} °C
                        </div>
                        <span className="metric-desc">Ambient temp</span>
                      </div>

                      <div className="metric-box" style={{ padding: '0.65rem 0.85rem' }}>
                        <span className="metric-title">Humidity</span>
                        <div className="metric-highlight" style={{ fontSize: '1.4rem', color: '#38bdf8' }}>
                          {irrigationResult.submittedInputs.humidity} %
                        </div>
                        <span className="metric-desc">Relative humidity</span>
                      </div>

                      <div className="metric-box" style={{ padding: '0.65rem 0.85rem' }}>
                        <span className="metric-title">Rainfall</span>
                        <div className="metric-highlight" style={{ fontSize: '1.4rem', color: '#60a5fa' }}>
                          {irrigationResult.submittedInputs.rainfall} mm
                        </div>
                        <span className="metric-desc">Contextual rain</span>
                      </div>
                    </div>
                  </div>

                  {/* ===================================================
                      5. IRRIGATION STATUS (Large Status Card)
                     =================================================== */}
                  <div
                    className="decision-status-banner"
                    style={{
                      background: irrigationResult.required
                        ? 'linear-gradient(145deg, rgba(239, 68, 68, 0.16), rgba(15, 23, 42, 0.85))'
                        : 'linear-gradient(145deg, rgba(16, 185, 129, 0.16), rgba(15, 23, 42, 0.85))',
                      border: `1px solid ${irrigationResult.required ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)'}`,
                      borderLeft: `6px solid ${irrigationResult.required ? '#ef4444' : '#10b981'}`,
                      borderRadius: 'var(--radius-lg, 14px)',
                      padding: '1.4rem',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                    }}
                  >
                    {/* Top Row: Title + Decision Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <h2 style={{
                        color: '#fff',
                        fontSize: '1.45rem',
                        fontWeight: 800,
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}>
                        {irrigationResult.required ? (
                          <><span>💧</span> Irrigation Recommended</>
                        ) : (
                          <><span>🌱</span> Irrigation Not Required</>
                        )}
                      </h2>

                      <span
                        className="status-pill"
                        style={{
                          background: irrigationResult.required ? '#ef4444' : '#10b981',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          padding: '0.35rem 0.9rem',
                          borderRadius: '999px',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {irrigationResult.required ? 'IRRIGATION: YES' : 'IRRIGATION: NO'}
                      </span>
                    </div>

                    {/* Meta Row: Confidence & Priority */}
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginTop: '0.85rem',
                      paddingBottom: '0.85rem',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Confidence:</span>
                        <strong style={{ color: '#fff', fontWeight: 800 }}>{irrigationResult.confidence}</strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Priority:</span>
                        <span
                          style={{
                            fontWeight: 800,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            background:
                              irrigationResult.priority === 'HIGH'
                                ? 'rgba(239, 68, 68, 0.25)'
                                : irrigationResult.priority === 'MEDIUM'
                                ? 'rgba(234, 179, 8, 0.25)'
                                : 'rgba(16, 185, 129, 0.25)',
                            color:
                              irrigationResult.priority === 'HIGH'
                                ? '#fca5a5'
                                : irrigationResult.priority === 'MEDIUM'
                                ? '#fde047'
                                : '#6ee7b7',
                            border: `1px solid ${
                              irrigationResult.priority === 'HIGH'
                                ? '#ef4444'
                                : irrigationResult.priority === 'MEDIUM'
                                ? '#eab308'
                                : '#10b981'
                            }`,
                          }}
                        >
                          {irrigationResult.priority}
                        </span>
                      </div>
                    </div>

                    {/* Recommendation Message */}
                    <div style={{ marginTop: '0.85rem' }}>
                      <div style={{
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        marginBottom: '0.3rem',
                      }}>
                        Recommendation:
                      </div>
                      <p style={{
                        color: '#f1f5f9',
                        fontSize: '0.98rem',
                        lineHeight: 1.5,
                        margin: 0,
                        fontWeight: 500,
                      }}>
                        {irrigationResult.recommendation}
                      </p>
                    </div>
                  </div>

                  {/* Agrometeorological Weather Advisory (if synced) */}
                  {irrigationResult.weather && irrigationResult.weather.recommendation && (
                    <div style={{
                      padding: '0.85rem 1rem',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        color: '#38bdf8',
                        fontWeight: 700,
                        marginBottom: '0.3rem',
                      }}>
                        <span>🌦️ Agrometeorological Advisory</span>
                        {irrigationResult.weather.weather && (
                          <span style={{ color: '#94a3b8' }}>
                            Rain Probability: {irrigationResult.weather.weather.rain_probability}%
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.45 }}>
                        {irrigationResult.weather.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '3.5rem 1rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.6rem' }}>💧</div>
                  <h4 style={{ color: '#e2e8f0', fontSize: '1.1rem', margin: '0 0 0.4rem 0' }}>
                    Awaiting Irrigation Analysis
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '360px', margin: 0, lineHeight: 1.45 }}>
                    Adjust soil moisture, temperature, and humidity parameters on the left, then click <strong>Analyze Irrigation</strong> to run the trained model.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          3. AI CROP RECOMMENDER TAB
         ========================================================= */}
      {activeTab === 'crops' && (
        <div className="crops-view-grid">
          {/* Left Column: Soil & Climate Parameters */}
          <div className="panel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399' }}>
                <span>🌱</span> Soil & Climate Parameters
              </h3>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.74rem', padding: '0.3rem 0.65rem', background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#6ee7b7' }}
                onClick={() => setShowCatalogModal(true)}
              >
                🔍 Browse 95 Crops
              </button>
            </div>

            {/* Model Engine Selector */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '0.35rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                type="button"
                onClick={() => setCropModelVersion('95class')}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: cropModelVersion === '95class' ? 'rgba(234, 179, 8, 0.25)' : 'transparent',
                  color: cropModelVersion === '95class' ? '#facc15' : '#94a3b8',
                  border: cropModelVersion === '95class' ? '1px solid #facc15' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                🧪 95-Crop
              </button>
              <button
                type="button"
                onClick={() => setCropModelVersion('22class')}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: cropModelVersion === '22class' ? 'var(--primary-600)' : 'transparent',
                  color: cropModelVersion === '22class' ? '#fff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                🌱 22-Crop Production
              </button>
            </div>

            {/* Test Crop Selected Banner */}
            {selectedTestCrop && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.65rem 1rem',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>🧪</span>
                  <div>
                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#34d399', fontWeight: 700 }}>
                      Testing Benchmark Profile
                    </span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{selectedTestCrop}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTestCrop(null);
                    setTestingProfile(null);
                    setCropResult(null);
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.2rem 0.55rem',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                  }}
                >
                  ✕ Clear
                </button>
              </div>
            )}

            {/* Quick-Fill Agro-Climatic Presets */}
            {soilPresets.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="input-label" style={{ marginBottom: '0.35rem' }}>
                  📍 Quick-Fill Agro-Climatic Region:
                </label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {soilPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      className="preset-chip"
                      onClick={() => applySoilPreset(preset)}
                      style={{ fontSize: '0.74rem', padding: '0.3rem 0.65rem' }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inputs: N, P, K, pH, Temp, Humidity, Rainfall */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-grid-3">
                <div>
                  <label className="input-label">Nitrogen (N)</label>
                  <input
                    type="number"
                    step="1"
                    className="text-input"
                    value={nitrogen}
                    onChange={(e) => setNitrogen(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Phosphorus (P)</label>
                  <input
                    type="number"
                    step="1"
                    className="text-input"
                    value={phosphorus}
                    onChange={(e) => setPhosphorus(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Potassium (K)</label>
                  <input
                    type="number"
                    step="1"
                    className="text-input"
                    value={potassium}
                    onChange={(e) => setPotassium(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="input-label">Soil pH (3.5 - 10.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="3.5"
                    max="10.0"
                    className="text-input"
                    value={ph}
                    onChange={(e) => setPh(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="text-input"
                    value={cropTemp}
                    onChange={(e) => setCropTemp(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="input-label">Humidity (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="text-input"
                    value={cropHum}
                    onChange={(e) => setCropHum(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Rainfall (mm)</label>
                  <input
                    type="number"
                    step="5"
                    className="text-input"
                    value={cropRainfall}
                    onChange={(e) => setCropRainfall(e.target.value)}
                  />
                </div>
              </div>

              {cropError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  borderRadius: 'var(--radius-md)',
                  color: '#fca5a5',
                  fontSize: '0.85rem'
                }}>
                  ⚠️ {cropError}
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: '0.5rem', fontWeight: 700 }}
                disabled={isRecommendingCrop}
                onClick={handleRecommendCrop}
              >
                {isRecommendingCrop ? '🔬 Evaluating Agronomic Models...' : '🌱 Recommend Crop'}
              </button>
            </div>
          </div>

          {/* Right Column: AI Recommended Crop & Alternatives */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="panel-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-emerald)', fontWeight: 700 }}>
                  🤖 AI Recommended Crop
                </span>
                {cropResult && (
                  <span style={{
                    fontSize: '0.72rem',
                    color: cropResult.is_experimental ? '#facc15' : '#34d399',
                    background: cropResult.is_experimental ? 'rgba(234, 179, 8, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                    padding: '0.18rem 0.55rem',
                    borderRadius: '999px',
                    border: `1px solid ${cropResult.is_experimental ? '#facc15' : 'rgba(52, 211, 153, 0.3)'}`,
                    fontWeight: 700
                  }}>
                    {cropResult.is_experimental ? '95-Class Model' : '22-Class Production Model'}
                  </span>
                )}
              </div>

              {cropResult ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '2.1rem', color: '#fff', fontWeight: 800, margin: '0.2rem 0' }}>
                        {cropResult.crop}
                      </h3>
                      {cropResult.recommended_profile?.scientific_name && cropResult.recommended_profile.scientific_name !== 'N/A' && (
                        <div style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.88rem' }}>
                          {cropResult.recommended_profile.scientific_name}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>
                        {cropResult.confidence}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Probability / Confidence
                      </span>
                    </div>
                  </div>

                  {/* Top 3 Alternatives */}
                  {cropResult.top_recommendations && cropResult.top_recommendations.length > 1 && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.85rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        🌾 Top Alternatives (Model-Ranked):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {cropResult.top_recommendations.slice(1, 4).map((alt, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.45rem 0.75rem',
                              background: 'rgba(255, 255, 255, 0.04)',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '3px solid #10b981'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>#{idx + 2}</span>
                              <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{alt.crop}</strong>
                              {alt.crop_category && (
                                <span style={{ fontSize: '0.68rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                  {alt.crop_category}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.82rem', color: '#a7f3d0', fontWeight: 600 }}>
                              {alt.match_percentage} Match
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submitted Parameters Summary */}
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>
                      Submitted Input Summary:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '0.45rem' }}>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>N</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.nitrogen} kg/ha</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>P</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.phosphorus} kg/ha</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>K</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.potassium} kg/ha</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>pH</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.ph}</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Temp</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.temperature}°C</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Humidity</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.humidity}%</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Rainfall</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.rainfall} mm</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌾</div>
                  <h4 style={{ color: '#e2e8f0', margin: '0 0 0.35rem 0' }}>Awaiting Soil Parameters</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Enter your soil laboratory N-P-K, pH, and climate parameters on the left, then click <strong>Recommend Crop</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Testing Crop Profile Details (if test crop was selected) */}
            {selectedTestCrop && testingProfile && (
              <div className="panel-card" style={{ padding: '1.25rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📖</span> Reference Profile: {selectedTestCrop}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem' }}>
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Category</span>
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{testingProfile.crop_category || 'Field Crop'}</strong>
                  </div>
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Season</span>
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{testingProfile.growing_season || 'Seasonal'}</strong>
                  </div>
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>pH Range</span>
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>
                      {testingProfile.ph_min !== undefined ? `${testingProfile.ph_min} - ${testingProfile.ph_max}` : '6.0 - 7.5'}
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Water Need</span>
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{testingProfile.water_requirement || 'Moderate'}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          4. HISTORY & LOGS TAB
         ========================================================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                <span>📋</span> History & Logs
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                Historical records of smart irrigation inferences and AI crop recommendations.
              </p>
            </div>
            {(irrigationHistory.length > 0 || cropHistory.length > 0) && (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                onClick={handleClearHistory}
              >
                Clear History
              </button>
            )}
          </div>

          {/* Irrigation Prediction History Table */}
          <div className="panel-card">
            <h4 className="panel-title" style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399' }}>
              <span>💧</span> Irrigation Predictions
            </h4>
            {irrigationHistory.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '130px' }}>Date</th>
                      <th style={{ minWidth: '100px' }}>Crop</th>
                      <th style={{ minWidth: '220px' }}>Inputs</th>
                      <th style={{ minWidth: '110px' }}>Prediction</th>
                      <th style={{ minWidth: '90px' }}>Confidence</th>
                      <th style={{ minWidth: '260px' }}>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {irrigationHistory.map((log) => (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>{log.date}</td>
                        <td><strong style={{ color: '#fff' }}>{log.crop || 'Field Plot'}</strong></td>
                        <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{log.inputs}</td>
                        <td>
                          <span
                            className="status-pill"
                            style={{
                              background: log.prediction === 'YES' ? '#ef4444' : '#10b981',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.6rem',
                            }}
                          >
                            {log.prediction === 'YES' ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td><strong>{log.confidence}</strong></td>
                        <td style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                          {log.recommendation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                No irrigation prediction history available. Run an inference in the Smart Irrigation tab to see records here.
              </p>
            )}
          </div>

          {/* Crop Recommendation History Table */}
          <div className="panel-card">
            <h4 className="panel-title" style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399' }}>
              <span>🌱</span> Crop Recommendations
            </h4>
            {cropHistory.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '130px' }}>Date</th>
                      <th style={{ minWidth: '120px' }}>Crop</th>
                      <th style={{ minWidth: '220px' }}>Inputs</th>
                      <th style={{ minWidth: '140px' }}>Prediction</th>
                      <th style={{ minWidth: '90px' }}>Confidence</th>
                      <th style={{ minWidth: '260px' }}>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cropHistory.map((rec) => (
                      <tr key={rec.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>{rec.date}</td>
                        <td><strong style={{ color: 'var(--text-emerald)' }}>{rec.crop}</strong></td>
                        <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{rec.inputs}</td>
                        <td><strong>{rec.prediction}</strong></td>
                        <td><strong>{rec.confidence}</strong></td>
                        <td style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                          {rec.recommendation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                No crop recommendation history available.
              </p>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: 95 Global Crop Classes Catalog
         ========================================================= */}
      {showCatalogModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
          onClick={() => setShowCatalogModal(false)}
        >
          <div
            style={{
              background: '#0b131f',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: 'var(--radius-lg, 16px)',
              width: '100%',
              maxWidth: '960px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.6)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🌐</span> Global Crop Classes Catalog ({filteredCrops.length} of {cropsCatalog.length || 95})
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Literature agronomic benchmarks. Click &quot;Test Crop&quot; to populate real training parameter means.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                onClick={() => setShowCatalogModal(false)}
              >
                ✕ Close
              </button>
            </div>

            {/* Search & Category Filter Controls */}
            <div style={{ padding: '1rem 1.5rem', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by crop, scientific name, Hindi, Gujarati, or category..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="text-input"
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
                {catalogSearch && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0 0.8rem' }}
                    onClick={() => setCatalogSearch('')}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {CROP_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    style={{
                      fontSize: '0.74rem',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '999px',
                      border: '1px solid',
                      borderColor: catalogCategory === cat ? '#10b981' : 'rgba(255, 255, 255, 0.12)',
                      background: catalogCategory === cat ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: catalogCategory === cat ? '#6ee7b7' : '#cbd5e1',
                      cursor: 'pointer',
                      fontWeight: catalogCategory === cat ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Crops Grid */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {filteredCrops.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
                  {filteredCrops.map((c) => (
                    <div
                      key={c.crop_name || c.id || c.scientific_name}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 'var(--radius-md, 10px)',
                        padding: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '0.35rem' }}>
                          <h4 style={{ margin: 0, color: '#fff', fontSize: '0.98rem', fontWeight: 700 }}>
                            {c.crop_name}
                          </h4>
                          <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                            {c.crop_category}
                          </span>
                        </div>

                        {c.scientific_name && (
                          <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                            {c.scientific_name}
                          </div>
                        )}

                        {(c.hindi_name || c.gujarati_name) && (
                          <div style={{ fontSize: '0.75rem', color: '#a7f3d0', marginBottom: '0.5rem' }}>
                            {c.hindi_name && <span>हिंदी: <strong>{c.hindi_name}</strong> </span>}
                            {c.gujarati_name && <span>| ગુજ: <strong>{c.gujarati_name}</strong></span>}
                          </div>
                        )}

                        <div style={{ fontSize: '0.74rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div>💧 Water: <strong>{c.water_requirement || 'Moderate'}</strong></div>
                          <div>🌡️ Temp: <strong>{c.temperature_min_c ?? 15} - {c.temperature_max_c ?? 35}°C</strong></div>
                          <div>🌧️ Rain: <strong>{c.rainfall_min_mm ?? 400} - {c.rainfall_max_mm ?? 1200} mm</strong></div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-primary"
                        style={{ marginTop: '0.75rem', fontSize: '0.74rem', padding: '0.35rem 0.6rem', width: '100%' }}
                        onClick={() => handleTestCropPreset(c)}
                      >
                        🧪 Test This Crop
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '0.9rem' }}>No crops match your search or category filter.</p>
                </div>
              )}
            </div>

            <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(0, 0, 0, 0.4)', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.73rem', color: '#94a3b8' }}>
              ℹ️ Literature dataset profiles from FAO Ecocrop and ICAR. Suitable for exploratory testing and prototyping.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
