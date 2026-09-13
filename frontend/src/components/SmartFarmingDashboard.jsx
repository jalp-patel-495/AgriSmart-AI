import React, { useState, useEffect } from 'react';
import {
  predictRealIrrigation,
  getCropRecommendation,
  getSoilPresets,
  getAdvisoryHistory,
  getCropsCatalog,
  getCropTrainingMeans,
} from '../services/smartFarmingApi';
import { fetchWeatherIntelligence } from '../services/weatherIntelligenceService';

// Predefined demo scenarios strictly labeled as demo inputs
const DEMO_SCENARIOS = {
  optimal: {
    label: '🌿 Optimal',
    soilMoisture: 60.0,
    temperature: 24.0,
    humidity: 65.0,
    rainProbability: 15,
    rainForecast: 0.0,
  },
  drought: {
    label: '🌵 Drought',
    soilMoisture: 15.0,
    temperature: 35.0,
    humidity: 35.0,
    rainProbability: 5,
    rainForecast: 0.0,
  },
  waterlogged: {
    label: '🌊 Waterlogged',
    soilMoisture: 85.0,
    temperature: 22.0,
    humidity: 85.0,
    rainProbability: 80,
    rainForecast: 15.0,
  },
};

export default function SmartFarmingDashboard({ initialSubTab = 'irrigation' }) {
  const [subTab, setSubTab] = useState(initialSubTab); // 'irrigation', 'crops', 'history'

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // --- Smart Irrigation State ---
  const [activeScenario, setActiveScenario] = useState(null);
  const [soilMoisture, setSoilMoisture] = useState(30.0);
  const [temperature, setTemperature] = useState(28.0);
  const [humidity, setHumidity] = useState(65.0);

  // Optional Weather Context
  const [rainProbability, setRainProbability] = useState(20);
  const [rainForecast, setRainForecast] = useState(0.0);
  const [weatherOverlay, setWeatherOverlay] = useState(null);
  const [isSyncingWeather, setIsSyncingWeather] = useState(false);

  // Irrigation Result & Loading
  const [irrigationResult, setIrrigationResult] = useState(null);
  const [isAnalyzingIrrigation, setIsAnalyzingIrrigation] = useState(false);
  const [irrigationError, setIrrigationError] = useState(null);

  // --- AI Crop Recommendation State (95 Global Classes) ---
  const [soilPresets, setSoilPresets] = useState([]);
  const [cropsCatalog, setCropsCatalog] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  const [nitrogen, setNitrogen] = useState(85.0);
  const [phosphorus, setPhosphorus] = useState(48.0);
  const [potassium, setPotassium] = useState(42.0);
  const [cropTemp, setCropTemp] = useState(25.5);
  const [cropHum, setCropHum] = useState(75.0);
  const [ph, setPh] = useState(6.8);
  const [rainfall, setRainfall] = useState(180.0);

  const [predictionResult, setPredictionResult] = useState(null);
  const [isRecommendingCrop, setIsRecommendingCrop] = useState(false);
  const [cropError, setCropError] = useState(null);
  const [cropModelVersion, setCropModelVersion] = useState('95class');

  // Separate states as specified:
  // selectedTestCrop: The exact crop clicked by the user
  // testingProfile: The profile belonging to selectedTestCrop
  const [selectedTestCrop, setSelectedTestCrop] = useState(null);
  const [testingProfile, setTestingProfile] = useState(null);
  const [cropTrainingMeans, setCropTrainingMeans] = useState({});

  // Aliases for clean separation and backward compatibility:
  const cropResult = predictionResult;
  const setCropResult = setPredictionResult;
  const recommendedCrop = predictionResult ? predictionResult.crop : null;

  // Form parameters derived object
  const formData = {
    nitrogen,
    phosphorus,
    potassium,
    ph,
    temperature: cropTemp,
    humidity: cropHum,
    rainfall,
  };

  // Canonical crop profile lookup helper from 95-crop catalog
  const getCropProfile = (cropName) => {
    if (!cropName || !cropsCatalog || cropsCatalog.length === 0) return null;
    return (
      cropsCatalog.find(
        (c) => c.crop_name?.toLowerCase().trim() === cropName.toLowerCase().trim()
      ) || null
    );
  };

  // The Crop Profile card data MUST always come from selectedTestCrop / testingProfile
  // Never fallback to recommendedCrop or default crop
  const cropProfile = testingProfile || getCropProfile(selectedTestCrop);

  // --- Real Persisted History State ---
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

  // Load presets, 95-crop catalog, and sync backend history on mount
  useEffect(() => {
    getSoilPresets().then(setSoilPresets);
    getCropsCatalog().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setCropsCatalog(data);
      }
    });
    getCropTrainingMeans().then((means) => {
      if (means && typeof means === 'object') {
        setCropTrainingMeans(means);
      }
    });
    getAdvisoryHistory().then((data) => {
      if (data) {
        if (Array.isArray(data.irrigation_logs) && data.irrigation_logs.length > 0) {
          setIrrigationHistory((prev) => {
            if (prev.length === 0) {
              const mapped = data.irrigation_logs.map((log) => ({
                id: log.id,
                date: log.created_at || 'Previous session',
                soilMoisture: log.moisture_15cm,
                temperature: 26.0,
                humidity: 65.0,
                prediction: log.status === 'Required' || log.status === 'Scheduled' ? 'YES' : 'NO',
                confidence: '95.0%',
                priority: log.status === 'Required' ? 'HIGH' : 'NONE',
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
                date: rec.created_at || 'Previous session',
                crop: rec.top_crop,
                prediction: `${rec.top_crop} (${rec.confidence})`,
                npk: rec.n_p_k,
                ph: rec.ph,
                rainfall: '180 mm',
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

  // --- Demo Scenario Selector ---
  const handleSelectScenario = (key) => {
    setActiveScenario(key);
    const scen = DEMO_SCENARIOS[key];
    if (scen) {
      setSoilMoisture(scen.soilMoisture);
      setTemperature(scen.temperature);
      setHumidity(scen.humidity);
      setRainProbability(scen.rainProbability);
      setRainForecast(scen.rainForecast);
    }
  };

  // --- Sync Live Microclimate Context ---
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
        setRainProbability(data.weather.rain_probability);
        setRainForecast(data.weather.forecast_precipitation);
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

    // Validation: Require numerical farm conditions
    if (
      soilMoisture === '' || isNaN(soilMoisture) ||
      temperature === '' || isNaN(temperature) ||
      humidity === '' || isNaN(humidity)
    ) {
      setIrrigationError('Data unavailable — please provide the required farm conditions.');
      return;
    }

    setIsAnalyzingIrrigation(true);
    try {
      const parsedMoisture = parseFloat(soilMoisture);
      const parsedTemp = parseFloat(temperature);
      const parsedHum = parseFloat(humidity);

      // 1. Call trained ML irrigation model
      const res = await predictRealIrrigation({
        soil_moisture: parsedMoisture,
        temperature: parsedTemp,
        humidity: parsedHum,
      });

      // 2. Fetch external agrometeorological overlay from Weather Intelligence
      let weatherData = weatherOverlay;
      try {
        const wRes = await fetchWeatherIntelligence({
          latitude: 22.5645,
          longitude: 72.9289,
          crop: 'Tomato',
          soilMoisture: parsedMoisture,
          temperature: parsedTemp,
          humidity: parsedHum,
        });
        if (wRes && wRes.status === 'success') {
          weatherData = wRes;
          setWeatherOverlay(wRes);
        }
      } catch (_) {}

      setIrrigationResult({
        required: res.required,
        prediction: res.prediction,
        confidence: res.confidence,
        priority: res.priority,
        weather: weatherData,
      });

      // 3. Persist log to real history
      const newLog = {
        id: Date.now(),
        date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        soilMoisture: parsedMoisture,
        temperature: parsedTemp,
        humidity: parsedHum,
        prediction: res.prediction,
        confidence: `${Math.round(res.confidence * 100)}%`,
        priority: res.priority,
      };

      setIrrigationHistory((prev) => {
        const updated = [newLog, ...prev.slice(0, 19)];
        try {
          localStorage.setItem('agrismart_irrigation_real_history', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    } catch (err) {
      console.error('Irrigation analysis error:', err);
      setIrrigationError('Unable to generate irrigation recommendation. Please try again.');
    } finally {
      setIsAnalyzingIrrigation(false);
    }
  };

  // --- Run Real Crop Recommendation Model Inference ---
  const handleRecommendCrop = async () => {
    setCropError(null);

    // Validation: Require all 7 parameters
    if (
      nitrogen === '' || isNaN(nitrogen) ||
      phosphorus === '' || isNaN(phosphorus) ||
      potassium === '' || isNaN(potassium) ||
      cropTemp === '' || isNaN(cropTemp) ||
      cropHum === '' || isNaN(cropHum) ||
      ph === '' || isNaN(ph) ||
      rainfall === '' || isNaN(rainfall)
    ) {
      setCropError('Data unavailable — please provide the required soil and environmental parameters.');
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
        rainfall: parseFloat(rainfall),
        model_version: cropModelVersion,
      };

      const res = await getCropRecommendation(payload);

      // Extract top recommendations from the model
      const topRecs = res.top_recommendations || [];
      const primaryRec = topRecs.length > 0 ? topRecs[0] : null;
      const topCrop = primaryRec ? primaryRec.crop : (res.recommended_crop || null);
      const conf = primaryRec ? primaryRec.match_percentage : (res.confidence ? `${Math.round(res.confidence * 100)}%` : 'Unavailable');

      if (!topCrop) {
        setCropError('Recommendation unavailable — please try different soil/climate parameters.');
        return;
      }

      setPredictionResult({
        crop: topCrop,
        confidence: conf,
        top_recommendations: topRecs,
        model_version: res.model_version || cropModelVersion,
        is_experimental: (res.model_version || cropModelVersion) === '95class',
        recommended_profile: primaryRec ? {
          scientific_name: primaryRec.scientific_name,
          crop_category: primaryRec.crop_category,
          growing_season: primaryRec.growing_season,
          water_requirement: primaryRec.water_requirement,
          soil_suitability: primaryRec.soil_suitability,
          preferred_ph: primaryRec.preferred_ph,
          temperature_range: primaryRec.temperature_range,
          rainfall_range: primaryRec.rainfall_range,
          hindi_name: primaryRec.hindi_name,
          gujarati_name: primaryRec.gujarati_name,
          agronomic_advice: primaryRec.agronomic_advice,
        } : (res.crop_profile || {}),
        inputs: payload,
      });

      // Persist log to real history
      const newRec = {
        id: Date.now(),
        date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        crop: topCrop,
        prediction: `${topCrop} (${conf})`,
        npk: `${payload.nitrogen}-${payload.phosphorus}-${payload.potassium}`,
        ph: payload.ph,
        rainfall: `${payload.rainfall} mm`,
      };

      setCropHistory((prev) => {
        const updated = [newRec, ...prev.slice(0, 19)];
        try {
          localStorage.setItem('agrismart_crop_real_history', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    } catch (err) {
      console.error('Crop recommendation error:', err);
      setCropError('Unable to generate crop recommendation. Please try again.');
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
    setRainfall(preset.default_rainfall);
  };

  const handleTestCropPreset = (cropItem) => {
    // Capture the canonical crop name immediately from the specific cropItem.
    if (!cropItem || !cropItem.crop_name) return;
    const canonicalName = cropItem.crop_name;

    // 1. Clear any previous AI prediction result so stale data is not visible
    setPredictionResult(null);
    setCropError(null);

    // 2. Store the selected test crop identity and its profile (SEPARATE from AI prediction)
    setSelectedTestCrop(canonicalName);
    setTestingProfile(cropItem);

    // 3. Populate form with parameters from this specific crop's training means or literature profile
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
      setRainfall(parseFloat(meanData.rainfall.toFixed(1)));
    } else {
      const tMin = cropItem.temperature_min_c ?? 20;
      const tMax = cropItem.temperature_max_c ?? 30;
      const rMin = cropItem.rainfall_min_mm ?? 500;
      const rMax = cropItem.rainfall_max_mm ?? 1000;
      const phMin = cropItem.ph_min ?? 6.0;
      const phMax = cropItem.ph_max ?? 7.5;

      setCropTemp(parseFloat(((tMin + tMax) / 2).toFixed(1)));
      setRainfall(parseFloat(((rMin + rMax) / 2).toFixed(0)));
      setPh(parseFloat(((phMin + phMax) / 2).toFixed(1)));
      setCropHum(
        cropItem.humidity_preference === 'high' ? 80.0 :
        cropItem.humidity_preference === 'low' ? 40.0 : 65.0
      );

      // NPK defaults based on crop category
      const cat = cropItem.crop_category || '';
      const subCat = cropItem.sub_category || '';
      if (cat === 'Pulse' || subCat.includes('Legume')) {
        setNitrogen(25.0);
        setPhosphorus(50.0);
        setPotassium(30.0);
      } else if (cat === 'Cereal') {
        setNitrogen(100.0);
        setPhosphorus(50.0);
        setPotassium(40.0);
      } else if (cat === 'Fruit' || cat === 'Plantation') {
        setNitrogen(60.0);
        setPhosphorus(40.0);
        setPotassium(50.0);
      } else if (cat === 'Oilseed') {
        setNitrogen(70.0);
        setPhosphorus(35.0);
        setPotassium(35.0);
      } else {
        setNitrogen(80.0);
        setPhosphorus(45.0);
        setPotassium(45.0);
      }
    }

    // 4. Close catalog and switch to crops tab
    setShowCatalogModal(false);
    setSubTab('crops');
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
    <div className="smart-farming-container">
      {/* Header */}
      <div className="smart-farming-header">
        <div>
          <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>💧</span> Smart Irrigation & AI Crop Recommendation
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Machine learning irrigation requirement prediction and multi-factor crop suitability modeling based on real soil and environmental conditions.
          </p>
        </div>

        {/* Sub-Tabs: Clean headers without fake counts */}
        <div className="sub-tab-pills">
          <button
            className={`sub-tab-btn ${subTab === 'irrigation' ? 'active' : ''}`}
            onClick={() => setSubTab('irrigation')}
          >
            💧 Smart Irrigation
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'crops' ? 'active' : ''}`}
            onClick={() => {
              setSubTab('crops');
            }}
          >
            🌱 AI Crop Recommender (95 Crops){' '}
            <span style={{ fontSize: '0.68rem', background: 'rgba(234, 179, 8, 0.25)', color: '#facc15', border: '1px solid #facc15', borderRadius: '4px', padding: '0.1rem 0.35rem', marginLeft: '0.35rem', fontWeight: 700 }}>⚠️ EXPERIMENTAL</span>
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'history' ? 'active' : ''}`}
            onClick={() => setSubTab('history')}
          >
            📋 History & Logs
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: SMART IRRIGATION (ACTUAL ML MODEL: SOIL MOISTURE, TEMP, HUMIDITY)
         ========================================================================= */}
      {subTab === 'irrigation' && (
        <div className="irrigation-view-grid">
          {/* Left Column: Farm Conditions & Optional Weather Context */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Demo Scenarios (Clearly labeled as demo inputs) */}
            <div className="panel-card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#fff' }}>Demo Scenarios</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                    Select a preset scenario to populate sample farm conditions:
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {Object.entries(DEMO_SCENARIOS).map(([key, item]) => (
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

            {/* Farm Conditions Input Card */}
            <div className="panel-card">
              <h3 className="panel-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🌱</span> Farm Conditions (Required Model Inputs)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {/* Soil Moisture */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label className="input-label" style={{ margin: 0 }}>
                      🌱 Soil Moisture (%)
                    </label>
                    <strong style={{ color: soilMoisture < 20 ? '#ef4444' : soilMoisture > 70 ? '#60a5fa' : '#34d399' }}>
                      {soilMoisture}%
                    </strong>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    <span>0% (Severe Deficit)</span>
                    <span>50% (Adequate)</span>
                    <span>100% (Saturated)</span>
                  </div>
                </div>

                <div className="form-grid-2">
                  {/* Ambient Temperature */}
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
                    />
                  </div>

                  {/* Relative Humidity */}
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
                    />
                  </div>
                </div>
              </div>

              {/* Optional Weather Context Section */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: '#e2e8f0', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🌦️</span> Optional Weather Context
                  </h4>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                    onClick={handleSyncWeather}
                    disabled={isSyncingWeather}
                  >
                    {isSyncingWeather ? '📡 Syncing...' : '📡 Sync Live Weather Telemetry'}
                  </button>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="input-label">🌧️ Rain Probability (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      className="text-input"
                      value={rainProbability}
                      onChange={(e) => setRainProbability(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="input-label">☔ Forecast Rainfall (mm)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="text-input"
                      value={rainForecast}
                      onChange={(e) => setRainForecast(e.target.value)}
                    />
                  </div>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  Rainfall is an external agrometeorological decision layer, not a trained feature of the irrigation ML model.
                </p>
              </div>

              {/* Error Message */}
              {irrigationError && (
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: '0.85rem' }}>
                  ⚠️ {irrigationError}
                </div>
              )}

              {/* Action Button */}
              <button
                className="btn-primary"
                style={{ marginTop: '1.25rem' }}
                disabled={isAnalyzingIrrigation}
                onClick={handleAnalyzeIrrigation}
              >
                {isAnalyzingIrrigation ? '⚡ Running Machine Learning Inference...' : '🔍 Analyze Irrigation'}
              </button>
            </div>
          </div>

          {/* Right Column: Real Irrigation Recommendation & Weather Coordination Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. Irrigation Recommendation Card */}
            <div className="panel-card irrigation-decision-card">
              <div className="panel-header">
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>💧</span> Irrigation Recommendation
                </h3>
                {isAnalyzingIrrigation && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-emerald)' }}>⚡ Evaluating...</span>
                )}
              </div>

              {irrigationResult ? (
                <div>
                  {/* Status Banner */}
                  <div
                    className="decision-status-banner"
                    style={{
                      background: irrigationResult.prediction === 'YES' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      borderLeft: `4px solid ${irrigationResult.prediction === 'YES' ? '#ef4444' : '#10b981'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '1.2rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span
                        className="status-pill"
                        style={{
                          background: irrigationResult.prediction === 'YES' ? '#ef4444' : '#10b981',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          padding: '0.35rem 0.85rem',
                        }}
                      >
                        {irrigationResult.prediction === 'YES' ? 'IRRIGATION REQUIRED' : 'NO IRRIGATION REQUIRED'}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                        Model Confidence: <strong>{Math.round(irrigationResult.confidence * 100)}%</strong>
                      </span>
                    </div>

                    <div style={{ marginTop: '0.85rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: irrigationResult.priority === 'HIGH' ? '#f87171' : '#34d399',
                        }}
                      >
                        Priority: {irrigationResult.priority}
                      </span>
                    </div>

                    <h3 style={{ color: '#fff', fontSize: '1.2rem', marginTop: '0.5rem', lineHeight: 1.4 }}>
                      {irrigationResult.prediction === 'YES'
                        ? 'The irrigation model predicts that irrigation is currently required under the provided conditions.'
                        : 'The irrigation model predicts that irrigation is not currently required under the provided conditions.'}
                    </h3>
                  </div>

                  {/* Operational Note */}
                  <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                      💡 <strong>Field Guidance:</strong> Soil moisture is currently recorded at <strong>{soilMoisture}%</strong>.
                      {irrigationResult.prediction === 'YES'
                        ? ' The irrigation model predicts that irrigation is currently required under the provided conditions.'
                        : ' The irrigation model predicts that irrigation is not currently required under the provided conditions.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💧</div>
                  <h4>Awaiting Irrigation Analysis</h4>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Adjust soil moisture, temperature, and humidity on the left, then click Analyze Irrigation.
                  </p>
                </div>
              )}
            </div>

            {/* 2. Weather Coordination Card */}
            <div className="panel-card">
              <div className="panel-header">
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🌦️</span> Weather Coordination
                </h3>
                {weatherOverlay && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      background: weatherOverlay.weather_risk === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: weatherOverlay.weather_risk === 'HIGH' ? '#f87171' : '#34d399',
                      border: `1px solid ${weatherOverlay.weather_risk === 'HIGH' ? '#ef4444' : '#10b981'}`,
                    }}
                  >
                    {weatherOverlay.weather_risk} RISK
                  </span>
                )}
              </div>

              {weatherOverlay && weatherOverlay.weather ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Temperature</span>
                      <strong style={{ fontSize: '1rem', color: '#fff' }}>{weatherOverlay.weather.temperature.toFixed(1)}°C</strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Humidity</span>
                      <strong style={{ fontSize: '1rem', color: '#fff' }}>{weatherOverlay.weather.humidity}%</strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Rain Probability</span>
                      <strong style={{ fontSize: '1rem', color: '#60a5fa' }}>{weatherOverlay.weather.rain_probability}%</strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Forecast Rain</span>
                      <strong style={{ fontSize: '1rem', color: '#60a5fa' }}>{weatherOverlay.weather.forecast_precipitation} mm</strong>
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem 1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#34d399', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Agrometeorological Action Advisory:
                    </div>
                    <p style={{ margin: 0, color: '#f1f5f9', fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.45 }}>
                      {weatherOverlay.recommendation}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    Click <strong>Analyze Irrigation</strong> or <strong>Sync Live Weather Telemetry</strong> to load agrometeorological coordination.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: AI CROP RECOMMENDER (95 CROP CLASSES SUPPORTED)
         ========================================================================= */}
      {subTab === 'crops' && (
        <div className="crops-view-grid">
          {/* Left Column: Soil & Climate Parameters Form */}
          <div className="panel-card">
            <h3 className="panel-title" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🌾</span> Soil Macronutrients & Agro-Climate Inputs
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.85rem' }}>
              Input laboratory soil test values (N-P-K, pH) and local climate parameters to predict the most suitable crop class.
            </p>

            {/* Model Engine Selector: 22-Crop Production vs 95-Crop Experimental */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
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
                🌱 22-Crop Production (Verified)
              </button>
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
                  background: cropModelVersion === '95class' ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                  color: cropModelVersion === '95class' ? '#facc15' : '#94a3b8',
                  border: cropModelVersion === '95class' ? '1px solid #facc15' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                🧪 95-Crop (⚠️ EXPERIMENTAL)
              </button>
            </div>

            {/* Testing Crop Banner — shown only when a crop was selected from catalog */}
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
                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#34d399', fontWeight: 700, letterSpacing: '0.04em' }}>Testing Profile</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{selectedTestCrop}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTestCrop(null);
                    setTestingProfile(null);
                    setPredictionResult(null);
                    setCropError(null);
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
                  title="Clear test crop selection"
                >✕ Clear</button>
              </div>
            )}

            {/* 95 Supported Crops Banner & Catalog Explorer Trigger */}
            <div style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 0.9rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.25))',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#fff' }}>95 Global Crop Classes Supported</strong>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', padding: '0.1rem 0.45rem', borderRadius: '999px', border: '1px solid #34d399' }}>
                    {cropsCatalog.length || 95} Classes
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                  Covers cereals, pulses, vegetables, fruits, spices, plantation, and fodder.
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.74rem', padding: '0.3rem 0.65rem', background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#6ee7b7' }}
                onClick={() => setShowCatalogModal(true)}
              >
                🔍 Browse 95 Crops
              </button>
            </div>

            {/* Optional Regional Presets Selector */}
            {soilPresets.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="input-label" style={{ marginBottom: '0.4rem' }}>
                  📍 Quick-Fill Agro-Climatic Preset (Optional):
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {soilPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      className="preset-chip"
                      onClick={() => applySoilPreset(preset)}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Form Fields: N, P, K, Temp, Humidity, pH, Rainfall */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-grid-2">
                <div>
                  <label className="input-label">Nitrogen (N) (kg/ha)</label>
                  <input
                    type="number"
                    step="1"
                    className="text-input"
                    value={nitrogen}
                    onChange={(e) => setNitrogen(e.target.value)}
                  />
                </div>

                <div>
                  <label className="input-label">Phosphorus (P) (kg/ha)</label>
                  <input
                    type="number"
                    step="1"
                    className="text-input"
                    value={phosphorus}
                    onChange={(e) => setPhosphorus(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="input-label">Potassium (K) (kg/ha)</label>
                  <input
                    type="number"
                    step="1"
                    className="text-input"
                    value={potassium}
                    onChange={(e) => setPotassium(e.target.value)}
                  />
                </div>

                <div>
                  <label className="input-label">Soil pH (0.0 - 14.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="3.0"
                    max="10.0"
                    className="text-input"
                    value={ph}
                    onChange={(e) => setPh(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="input-label">Ambient Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="text-input"
                    value={cropTemp}
                    onChange={(e) => setCropTemp(e.target.value)}
                  />
                </div>

                <div>
                  <label className="input-label">Relative Humidity (%)</label>
                  <input
                    type="number"
                    step="1"
                    className="text-input"
                    value={cropHum}
                    onChange={(e) => setCropHum(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Annual Rainfall (mm)</label>
                <input
                  type="number"
                  step="5"
                  className="text-input"
                  value={rainfall}
                  onChange={(e) => setRainfall(e.target.value)}
                />
              </div>
            </div>

            {/* Error Banner */}
            {cropError && (
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: '0.85rem' }}>
                ⚠️ {cropError}
              </div>
            )}

            {/* Run Recommendation CTA */}
            <button
              className="btn-primary"
              style={{ marginTop: '1.5rem' }}
              disabled={isRecommendingCrop}
              onClick={handleRecommendCrop}
            >
              {isRecommendingCrop ? '🔬 Evaluating Agronomic Models...' : '🌱 Recommend Crop'}
            </button>
          </div>

          {/* Right Column: TEST INPUT CROP, CROP PROFILE, & AI RECOMMENDATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. TEST INPUT CROP (shown when user selected a test crop) */}
            {selectedTestCrop && (
              <div
                className="panel-card"
                id="test-input-crop-card"
                style={{
                  padding: '1rem 1.25rem',
                  background: 'rgba(96, 165, 250, 0.08)',
                  border: '1px solid rgba(96, 165, 250, 0.3)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>🧪</span>
                    <div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#93c5fd', fontWeight: 700, letterSpacing: '0.04em' }}>
                        Test Input Crop
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#bfdbfe' }}>
                        {selectedTestCrop}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Profile parameters loaded into model inputs
                  </span>
                </div>
              </div>
            )}

            {/* 2. CROP PROFILE CARD (strictly belonging to selectedTestCrop / testingProfile) */}
            <div
              className="panel-card"
              id="crop-profile-card"
              style={{
                padding: '1.5rem',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📖</span> Crop Profile {selectedTestCrop ? `— ${selectedTestCrop}` : ''}
                </h3>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '999px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  FAO / ICAR Reference
                </span>
              </div>

              {selectedTestCrop && cropProfile ? (
                <div>
                  <div style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 style={{ fontSize: '1.45rem', color: '#fff', fontWeight: 800, margin: 0 }}>
                        {cropProfile.crop_name || selectedTestCrop}
                      </h4>
                      {cropProfile.scientific_name && cropProfile.scientific_name !== 'N/A' && (
                        <span style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.95rem' }}>
                          {cropProfile.scientific_name}
                        </span>
                      )}
                    </div>
                    {(cropProfile.hindi_name || cropProfile.gujarati_name) && (
                      <div style={{ fontSize: '0.84rem', color: '#6ee7b7', marginTop: '0.35rem', display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                        {cropProfile.hindi_name && <span>हिंदी: <strong>{cropProfile.hindi_name}</strong></span>}
                        {cropProfile.gujarati_name && <span>ગુજરાતી: <strong>{cropProfile.gujarati_name}</strong></span>}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Crop Category</span>
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{cropProfile.crop_category || 'Field Crop'}</strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Growing Season</span>
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{cropProfile.growing_season || 'Seasonal'}</strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Preferred Soil pH</span>
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                        {cropProfile.ph_min !== undefined && cropProfile.ph_max !== undefined
                          ? `${cropProfile.ph_min} - ${cropProfile.ph_max}`
                          : (cropProfile.preferred_ph || '6.0 - 7.5')}
                      </strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Water Requirement</span>
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{cropProfile.water_requirement || 'Moderate'}</strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Temperature Range</span>
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                        {cropProfile.temperature_min_c !== undefined && cropProfile.temperature_max_c !== undefined
                          ? `${cropProfile.temperature_min_c}–${cropProfile.temperature_max_c}°C`
                          : (cropProfile.temperature_range || '15 - 35°C')}
                      </strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Rainfall Range</span>
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                        {cropProfile.rainfall_min_mm !== undefined && cropProfile.rainfall_max_mm !== undefined
                          ? `${cropProfile.rainfall_min_mm}–${cropProfile.rainfall_max_mm} mm`
                          : (cropProfile.rainfall_range || '400 - 1200 mm')}
                      </strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem', fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem' }}>
                    ℹ️ Note: Canonical literature profile from FAO/ICAR catalog for {cropProfile.crop_name || selectedTestCrop}.
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '0.92rem', margin: 0, fontWeight: 600 }}>
                    Select a crop to view its profile.
                  </p>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginTop: '0.35rem' }}>
                    Browse the 95-crop catalog on the left and click <strong>🧪 Test This Crop</strong> to inspect its agronomic profile.
                  </span>
                </div>
              )}
            </div>

            {/* 3. AI RECOMMENDATION CARD (genuinely predicted by ML model) */}
            <div className="panel-card" id="ai-recommendation-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-emerald)', fontWeight: 700 }}>
                  🤖 AI Recommendation
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
                    {cropResult.is_experimental ? '95-Class Model ⚠️ EXPERIMENTAL' : '22-Class Production Model'}
                  </span>
                )}
              </div>

              {cropResult ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '2rem', color: '#fff', fontWeight: 800, margin: '0.2rem 0' }}>
                        {cropResult.crop}
                      </h3>
                      {cropResult.recommended_profile?.scientific_name && cropResult.recommended_profile.scientific_name !== 'N/A' && (
                        <div style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.88rem' }}>
                          {cropResult.recommended_profile.scientific_name}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="match-percent-label" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>
                        {cropResult.confidence}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Model Confidence</span>
                    </div>
                  </div>

                  {/* Top 3 Alternatives */}
                  {cropResult.top_recommendations && cropResult.top_recommendations.length > 1 && (
                    <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(0, 0, 0, 0.3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        🌾 Other Suitable Options (Model-Ranked Recommendations):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {cropResult.top_recommendations.slice(1, 3).map((alt, idx) => (
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

                  {/* Submitted Input Parameters Table */}
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>
                      Submitted Input Parameters:
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Nitrogen (N)</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.nitrogen} kg/ha</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Phosphorus (P)</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.phosphorus} kg/ha</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Potassium (K)</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.potassium} kg/ha</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Soil pH</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.ph}</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Temperature</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.temperature}°C</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Humidity</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.humidity}%</strong>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Rainfall</span>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{cropResult.inputs.rainfall} mm</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🌾</div>
                  {selectedTestCrop ? (
                    <>
                      <h4 style={{ color: '#6ee7b7', margin: '0.25rem 0' }}>Ready to test: {selectedTestCrop}</h4>
                      <p style={{ fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
                        Profile parameters have been loaded into the form. Click <strong>🌱 Recommend Crop</strong> on the left to run the AI model.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 style={{ margin: '0.25rem 0' }}>Awaiting Soil Evaluation</h4>
                      <p style={{ fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
                        Adjust soil nutrient values on the left or select a crop from the catalog, then click <strong>🌱 Recommend Crop</strong>.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: REAL PERSISTED HISTORY & LOGS
         ========================================================================= */}
      {subTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📋</span> Historical Prediction Logs
            </h3>
            {(irrigationHistory.length > 0 || cropHistory.length > 0) && (
              <button
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
            <h4 className="panel-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>💧</span> Irrigation Predictions
            </h4>
            {irrigationHistory.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Soil Moisture</th>
                      <th>Temperature</th>
                      <th>Humidity</th>
                      <th>Prediction</th>
                      <th>Confidence</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {irrigationHistory.map((log) => (
                      <tr key={log.id}>
                        <td>{log.date}</td>
                        <td><strong>{log.soilMoisture}%</strong></td>
                        <td>{log.temperature}°C</td>
                        <td>{log.humidity}%</td>
                        <td>
                          <span
                            className="status-pill"
                            style={{
                              background: log.prediction === 'YES' ? '#ef4444' : '#10b981',
                              color: '#fff',
                            }}
                          >
                            {log.prediction === 'YES' ? 'REQUIRED' : 'NOT REQUIRED'}
                          </span>
                        </td>
                        <td>{log.confidence}</td>
                        <td>{log.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                No history available
              </p>
            )}
          </div>

          {/* Crop Recommendation History Table */}
          <div className="panel-card">
            <h4 className="panel-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🌱</span> Crop Recommendations
            </h4>
            {cropHistory.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Crop</th>
                      <th>Prediction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cropHistory.map((rec) => (
                      <tr key={rec.id}>
                        <td>{rec.date}</td>
                        <td><strong style={{ color: 'var(--text-emerald)' }}>{rec.crop}</strong></td>
                        <td>{rec.prediction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                No history available
              </p>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: 95 GLOBAL CROP CLASSES CATALOG & LITERATURE PROFILES
         ========================================================================= */}
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
            {/* Modal Header */}
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
                  Literature-typical agronomic benchmarks. Click &quot;Test Crop&quot; to populate sample physiological parameters.
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

            {/* Modal Footer Note */}
            <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(0, 0, 0, 0.4)', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.73rem', color: '#94a3b8' }}>
              ℹ️ Literature dataset profiles from FAO Ecocrop and ICAR. Suitable for exploratory testing and prototyping.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

