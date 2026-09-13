import React, { useState, useEffect } from 'react';
import { fetchWeatherIntelligence } from '../services/weatherIntelligenceService';
import { fetchSustainabilityScore } from '../services/sustainabilityService';

const API_BASE = 'http://127.0.0.1:8000';

export default function Dashboard({
  onStartDiagnose,
  onNavigateTab,
  latestResult,
  currentUser,
  onWeatherUpdate,
}) {
  // Navigation helper
  const navigateTo = (tab, subTab = 'irrigation') => {
    if (onNavigateTab) {
      onNavigateTab(tab, subTab);
    } else if (tab === 'diagnose' && onStartDiagnose) {
      onStartDiagnose();
    }
  };

  // --- Real Telemetry States ---
  const [weatherData, setWeatherData] = useState({
    loading: true,
    data: null,
    error: false,
  });

  const [irrigationData, setIrrigationData] = useState({
    loading: true,
    status: null, // 'Required' | 'Not Required' | null
    lastLog: null,
  });

  const [cropRecData, setCropRecData] = useState({
    loading: true,
    recommendation: null,
  });

  const [yieldData, setYieldData] = useState(null);

  // Diagnostic history state (persisted via localStorage)
  const [recentAnalyses, setRecentAnalyses] = useState(() => {
    try {
      const saved = localStorage.getItem('agrismart_recent_analyses');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load cached analyses:', e);
    }
    return [
      {
        id: 1,
        date: 'Today, 09:15 AM',
        crop: 'Tomato',
        disease: 'Early Blight',
        confidence: '92.4%',
        confidence_score: 0.924,
        status: 'Diseased',
        pathogen: 'Alternaria solani',
        treatment: 'Apply copper-based fungicide; prune infected lower leaves.',
        imageName: 'field_sample_01.jpg',
      },
      {
        id: 2,
        date: 'Yesterday, 04:30 PM',
        crop: 'Potato',
        disease: 'Late Blight',
        confidence: '88.1%',
        confidence_score: 0.881,
        status: 'Diseased',
        pathogen: 'Phytophthora infestans',
        treatment: 'Apply cymoxanil or metalaxyl; prevent excessive foliage wetness.',
        imageName: 'potato_plot_b.jpg',
      },
      {
        id: 3,
        date: 'Sep 10, 11:20 AM',
        crop: 'Corn',
        disease: 'None (Healthy)',
        confidence: '94.2%',
        confidence_score: 0.942,
        status: 'Healthy',
        pathogen: null,
        treatment: 'Maintain current nitrogen top-dressing and irrigation intervals.',
        imageName: 'corn_field_north.jpg',
      },
    ];
  });

  // Modal state for Interactive Yield Predictor
  const [isYieldModalOpen, setIsYieldModalOpen] = useState(false);
  const [yieldInputs, setYieldInputs] = useState({
    crop: currentUser?.preferred_crop || 'Tomato',
    area_hectares: 2.5,
    rainfall_mm: 650,
    fertilizer_usage: 120,
    pesticide_usage: 2.0,
  });
  const [yieldPredicting, setYieldPredicting] = useState(false);
  const [yieldPredictionResult, setYieldPredictionResult] = useState(null);

  // Sustainability Score State (Bonus Module D)
  const [sustainabilityData, setSustainabilityData] = useState({
    loading: true,
    score: null,
    level: 'Data Unavailable',
    components: null,
    component_details: null,
    available_data: false,
    is_normalized: false,
    data_note: null,
    suggestions: [],
    disclaimer: 'Indicative score based on available project data. Not a certified environmental assessment.',
  });
  const [isSustainabilityModalOpen, setIsSustainabilityModalOpen] = useState(false);

  // Sync latest disease diagnosis into recent analyses history
  useEffect(() => {
    if (latestResult && latestResult.disease) {
      const newEntry = {
        id: Date.now(),
        date: 'Just now',
        crop: latestResult.crop || 'Field Crop',
        disease: latestResult.disease,
        confidence: latestResult.confidence || '90%',
        confidence_score: latestResult.confidence_score || 0.90,
        status: latestResult.status || 'Analyzed',
        pathogen: latestResult.pathogen || null,
        treatment: latestResult.treatment || null,
        imageName: 'live_camera_capture.jpg',
      };
      setRecentAnalyses((prev) => {
        const filtered = prev.filter((item) => item.id !== newEntry.id);
        const updated = [newEntry, ...filtered.slice(0, 9)];
        try {
          localStorage.setItem('agrismart_recent_analyses', JSON.stringify(updated));
        } catch (e) {
          console.warn('Storage sync failed:', e);
        }
        return updated;
      });
    }
  }, [latestResult]);

  // Load real API telemetry on mount
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch live Open-Meteo weather intelligence via centralized service
    const fetchWeather = async () => {
      try {
        const data = await fetchWeatherIntelligence({
          latitude: 22.5645, // Anand Agronomy Region, Gujarat
          longitude: 72.9289,
          crop: currentUser?.preferred_crop || latestResult?.crop || 'Tomato',
          soilMoisture: 32.0,
        });

        if (isMounted) {
          if (data && data.status === 'success' && data.weather) {
            setWeatherData({ loading: false, data: data, error: false });
            if (onWeatherUpdate) onWeatherUpdate(data);
          } else {
            setWeatherData({ loading: false, data: null, error: true });
          }
        }
      } catch (err) {
        console.warn('Weather intelligence fetch error:', err);
        if (isMounted) setWeatherData({ loading: false, data: null, error: true });
      }
    };

    // 2. Fetch Smart Farming history for irrigation & crop recommendation
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/smart-farming/history`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            // Irrigation status from latest database log
            if (data.irrigation_logs && data.irrigation_logs.length > 0) {
              const latestLog = data.irrigation_logs[0];
              const isRequired =
                latestLog.status === 'Scheduled' ||
                latestLog.status === 'Required' ||
                latestLog.water_litres_per_ha > 0;
              setIrrigationData({
                loading: false,
                status: isRequired ? 'Irrigation Required' : 'Not Required',
                lastLog: latestLog,
              });
            } else {
              setIrrigationData({ loading: false, status: null, lastLog: null });
            }

            // Crop recommendation from latest database log
            if (data.crop_recommendations && data.crop_recommendations.length > 0) {
              setCropRecData({
                loading: false,
                recommendation: data.crop_recommendations[0],
              });
            } else {
              setCropRecData({ loading: false, recommendation: null });
            }
          }
        } else {
          if (isMounted) {
            setIrrigationData({ loading: false, status: null, lastLog: null });
            setCropRecData({ loading: false, recommendation: null });
          }
        }
      } catch (err) {
        console.warn('History fetch error:', err);
        if (isMounted) {
          setIrrigationData({ loading: false, status: null, lastLog: null });
          setCropRecData({ loading: false, recommendation: null });
        }
      }
    };

    fetchWeather();
    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Sync Sustainability Score when underlying AI modules or telemetry update
  useEffect(() => {
    let isMounted = true;

    const updateSustainability = async () => {
      // 1. Gather Disease detection data
      const latestLeaf = recentAnalyses && recentAnalyses.length > 0 ? recentAnalyses[0] : (latestResult || null);
      let diseaseVal = null;
      let diseaseConf = null;
      let cropName = latestLeaf?.crop || currentUser?.preferred_crop || 'Tomato';

      if (latestLeaf) {
        diseaseVal = latestLeaf.disease || latestLeaf.status || null;
        diseaseConf = getRawConfidence(latestLeaf);
      }

      // 2. Gather Irrigation status
      let irrigationPred = null;
      let irrigationPrio = null;
      let soilM = null;
      if (irrigationData && irrigationData.status) {
        const isReq = irrigationData.status === 'Irrigation Required';
        irrigationPred = isReq ? 'YES' : 'NO';
        irrigationPrio = isReq ? 'HIGH' : 'NONE';
        soilM = irrigationData.lastLog?.moisture_15cm ?? 32.0;
      }

      // 3. Gather Weather context
      let rainProb = null;
      let forecastPrec = null;
      let wRisk = null;
      let temp = null;
      let hum = null;
      if (weatherData && weatherData.data && weatherData.data.weather) {
        rainProb = weatherData.data.weather.rain_probability ?? null;
        forecastPrec = weatherData.data.weather.forecast_precipitation ?? null;
        wRisk = weatherData.data.weather_risk ?? null;
        temp = weatherData.data.weather.temperature ?? null;
        hum = weatherData.data.weather.humidity ?? null;
      }

      // 4. Gather Crop Recommendation / Soil NPK data
      let nVal = null;
      let pVal = null;
      let kVal = null;
      try {
        const savedCropHist = JSON.parse(localStorage.getItem('agrismart_crop_real_history') || '[]');
        if (savedCropHist.length > 0) {
          const rec = savedCropHist[0];
          if (rec.crop) cropName = rec.crop;
          if (rec.npk) {
            const parts = rec.npk.split('-');
            if (parts.length === 3) {
              nVal = parseFloat(parts[0]);
              pVal = parseFloat(parts[1]);
              kVal = parseFloat(parts[2]);
            }
          }
        }
      } catch (_) {}

      if (nVal === null && cropRecData && cropRecData.recommendation) {
        const r = cropRecData.recommendation;
        if (r.top_crop) cropName = r.top_crop;
        if (r.n !== undefined && r.n !== null) nVal = parseFloat(r.n);
        if (r.p !== undefined && r.p !== null) pVal = parseFloat(r.p);
        if (r.k !== undefined && r.k !== null) kVal = parseFloat(r.k);
      }

      const payload = {
        crop: cropName,
        soil_moisture: soilM,
        temperature: temp,
        humidity: hum,
        nitrogen: nVal,
        phosphorus: pVal,
        potassium: kVal,
        rainfall: forecastPrec,
        irrigation_prediction: irrigationPred,
        irrigation_priority: irrigationPrio,
        disease: diseaseVal,
        disease_confidence: diseaseConf,
        rain_probability: rainProb,
        forecast_precipitation: forecastPrec,
        weather_risk: wRisk,
      };

      try {
        const res = await fetchSustainabilityScore(payload);
        if (isMounted && res && res.status === 'success') {
          setSustainabilityData({
            loading: false,
            score: res.sustainability_score,
            level: res.level,
            components: res.components,
            component_details: res.component_details,
            available_data: res.available_data,
            is_normalized: res.is_normalized,
            data_note: res.data_note,
            suggestions: res.suggestions,
            disclaimer: res.disclaimer,
          });
        }
      } catch (err) {
        console.warn('Sustainability computation error:', err);
      }
    };

    updateSustainability();

    return () => {
      isMounted = false;
    };
  }, [recentAnalyses, latestResult, irrigationData, weatherData, cropRecData, currentUser]);

  // Handle in-situ yield prediction
  const handleCalculateYield = async (e) => {
    e.preventDefault();
    setYieldLoading(true);
    setYieldError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/predict/advisory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop: yieldForm.crop,
          area: parseFloat(yieldForm.area),
          fertilizer: parseFloat(yieldForm.fertilizer),
          pesticide: parseFloat(yieldForm.pesticide),
          state: yieldForm.state,
          season: yieldForm.season,
          annual_rainfall: parseFloat(yieldForm.annual_rainfall),
        }),
      });

      if (!res.ok) {
        throw new Error(`Yield prediction returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.yield && data.yield.estimated !== 'Data unavailable') {
        const yieldResult = {
          estimated: data.yield.estimated,
          unit: data.yield.unit || 'Tonnes/Ha',
          crop: yieldForm.crop,
          date: new Date().toLocaleDateString(),
        };
        setYieldData(yieldResult);
        localStorage.setItem('agrismart_estimated_yield', JSON.stringify(yieldResult));
        setIsYieldModalOpen(false);
      } else {
        setYieldError('Unable to calculate yield with provided parameters. Please verify field inputs.');
      }
    } catch (err) {
      console.error('Yield prediction error:', err);
      setYieldError(err.message || 'Yield prediction failed. Server connection error.');
    } finally {
      setYieldLoading(false);
    }
  };

  // Determine latest disease result for Overview Card 1
  const latestAnalysis = recentAnalyses.length > 0 ? recentAnalyses[0] : null;

  // Helper for confidence score parsing
  const getRawConfidence = (item) => {
    if (!item) return 1.0;
    if (typeof item.confidence_score === 'number') return item.confidence_score;
    if (typeof item.confidence === 'string') {
      const num = parseFloat(item.confidence.replace('%', ''));
      return isNaN(num) ? 1.0 : num / 100.0;
    }
    return 1.0;
  };

  return (
    <div className="farmer-dashboard-root">
      {/* 1. DASHBOARD HERO */}
      <section className="dashboard-hero-section">
        <div className="dashboard-hero-content">
          <div className="hero-system-status">
            <span className="status-pulsing-dot"></span>
            <span className="status-text">AI System Ready</span>
          </div>
          <h1 className="hero-main-heading">Smart Farming Dashboard</h1>
          <p className="hero-sub-text">
            AI-powered insights for healthier crops, smarter irrigation, and better farming decisions.
          </p>
        </div>
      </section>

      {/* 2. FARM OVERVIEW (4 Cards) */}
      <section className="dashboard-overview-grid">
        {/* CARD 1: Crop Health */}
        <div className="overview-card" id="card-crop-health">
          <div className="card-top-header">
            <span className="card-emoji">🌿</span>
            <span className="card-badge-label">Leaf Diagnostics</span>
          </div>
          <div className="card-body">
            <div className="card-metric-title">Crop Health</div>
            {latestAnalysis ? (
              getRawConfidence(latestAnalysis) < 0.65 ? (
                <div>
                  <div className="metric-status-val status-warning">Needs Inspection</div>
                  <div className="metric-desc-text">Low Confidence — Further Inspection Needed</div>
                </div>
              ) : latestAnalysis.status === 'Healthy' || latestAnalysis.disease?.toLowerCase().includes('healthy') ? (
                <div>
                  <div className="metric-status-val status-healthy">Healthy</div>
                  <div className="metric-desc-text">{latestAnalysis.crop}: Foliage in optimal condition</div>
                </div>
              ) : (
                <div>
                  <div className="metric-status-val status-diseased">Disease Detected</div>
                  <div className="metric-desc-text">
                    {latestAnalysis.crop}: {latestAnalysis.disease} ({latestAnalysis.confidence})
                  </div>
                </div>
              )
            ) : (
              <div>
                <div className="metric-status-val status-unavailable">Data unavailable</div>
                <div className="metric-desc-text">No recent leaf analysis recorded</div>
              </div>
            )}
          </div>
          <div className="card-footer-action">
            <button className="card-inline-action-btn" onClick={() => navigateTo('diagnose')}>
              Analyze Leaf →
            </button>
          </div>
        </div>

        {/* CARD 2: Irrigation */}
        <div className="overview-card" id="card-irrigation">
          <div className="card-top-header">
            <span className="card-emoji">💧</span>
            <span className="card-badge-label">Moisture & Hydration</span>
          </div>
          <div className="card-body">
            <div className="card-metric-title">Irrigation</div>
            {irrigationData.loading ? (
              <div className="metric-status-val status-loading">Checking telemetry...</div>
            ) : irrigationData.status ? (
              <div>
                <div
                  className={`metric-status-val ${
                    irrigationData.status === 'Irrigation Required' ? 'status-alert' : 'status-healthy'
                  }`}
                >
                  {irrigationData.status}
                </div>
                <div className="metric-desc-text">
                  {irrigationData.status === 'Irrigation Required'
                    ? 'Root zone moisture deficit detected'
                    : 'Soil moisture currently adequate'}
                </div>
              </div>
            ) : (
              <div>
                <div className="metric-status-val status-unavailable">Data unavailable</div>
                <div className="metric-desc-text">No active irrigation telemetry</div>
              </div>
            )}
          </div>
          <div className="card-footer-action">
            <button
              className="card-inline-action-btn"
              onClick={() => navigateTo('smart-farming', 'irrigation')}
            >
              Check Irrigation →
            </button>
          </div>
        </div>

        {/* CARD 3: Weather */}
        <div className="overview-card" id="card-weather">
          <div className="card-top-header">
            <span className="card-emoji">🌦️</span>
            <span className="card-badge-label">Agrometeorology</span>
          </div>
          <div className="card-body">
            <div className="card-metric-title">Weather</div>
            {weatherData.loading ? (
              <div className="metric-status-val status-loading">Fetching live satellite...</div>
            ) : weatherData.data && weatherData.data.weather ? (
              <div>
                <div className="metric-status-val">
                  {Math.round(weatherData.data.weather.temperature)}°C
                </div>
                <div className="metric-desc-text" style={{ fontSize: '0.9rem', color: '#e2e8f0', marginTop: '0.25rem' }}>
                  Rain {weatherData.data.weather.rain_probability}% • Risk: <strong>{weatherData.data.weather_risk || 'LOW'}</strong>
                </div>
              </div>
            ) : (
              <div>
                <div className="metric-status-val status-unavailable">Data unavailable</div>
                <div className="metric-desc-text">Weather data unavailable</div>
              </div>
            )}
          </div>
          <div className="card-footer-action">
            <button className="card-inline-action-btn" onClick={() => navigateTo('weather')}>
              View Weather →
            </button>
          </div>
        </div>

        {/* CARD 4: Estimated Yield */}
        <div className="overview-card" id="card-yield">
          <div className="card-top-header">
            <span className="card-emoji">🌾</span>
            <span className="card-badge-label">Harvest Projection</span>
          </div>
          <div className="card-body">
            <div className="card-metric-title">Estimated Yield</div>
            {yieldData && yieldData.estimated ? (
              <div>
                <div className="metric-status-val status-healthy">
                  {yieldData.estimated} {yieldData.unit}
                </div>
                <div className="metric-desc-text">
                  Projected for {yieldData.crop || 'Field'} ({yieldData.date})
                </div>
              </div>
            ) : (
              <div>
                <div className="metric-status-val status-unavailable">Data unavailable</div>
                <div className="metric-desc-text">Run Yield Predictor to generate projection</div>
              </div>
            )}
          </div>
          <div className="card-footer-action">
            <button
              className="card-inline-action-btn"
              onClick={() => setIsYieldModalOpen(true)}
            >
              Predict Yield →
            </button>
          </div>
        </div>
      </section>

      {/* 3. QUICK ACTIONS */}
      <section className="dashboard-quick-actions-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-actions-grid">
          <button
            className="action-tile-btn"
            id="qa-analyze-leaf"
            onClick={() => navigateTo('diagnose')}
          >
            <span className="action-tile-icon">🌿</span>
            <span className="action-tile-text">Analyze Leaf</span>
          </button>

          <button
            className="action-tile-btn"
            id="qa-check-irrigation"
            onClick={() => navigateTo('smart-farming', 'irrigation')}
          >
            <span className="action-tile-icon">💧</span>
            <span className="action-tile-text">Check Irrigation</span>
          </button>

          <button
            className="action-tile-btn"
            id="qa-check-weather"
            onClick={() => navigateTo('weather')}
          >
            <span className="action-tile-icon">🌦️</span>
            <span className="action-tile-text">Check Weather</span>
          </button>

          <button
            className="action-tile-btn"
            id="qa-recommend-crop"
            onClick={() => navigateTo('smart-farming', 'crops')}
          >
            <span className="action-tile-icon">🌾</span>
            <span className="action-tile-text">Recommend Crop</span>
          </button>

          <button
            className="action-tile-btn"
            id="qa-predict-yield"
            onClick={() => setIsYieldModalOpen(true)}
          >
            <span className="action-tile-icon">📊</span>
            <span className="action-tile-text">Predict Yield</span>
          </button>

          <button
            className="action-tile-btn"
            id="qa-ask-copilot"
            onClick={() => navigateTo('assistant')}
          >
            <span className="action-tile-icon">🤖</span>
            <span className="action-tile-text">Ask AI Co-Pilot</span>
          </button>
        </div>
      </section>

      {/* 4. TWO-COLUMN INSIGHT SECTION: AI FARM INSIGHT + WEATHER SNAPSHOT */}
      <section className="dashboard-insights-two-col">
        {/* Left Column: AI Farm Insight */}
        <div className="insight-card-panel" id="panel-ai-insight">
          <div className="panel-header-row">
            <h3 className="panel-heading">🤖 AI Farm Insight</h3>
            <span className="panel-status-pill">Kisan Advisor</span>
          </div>

          <div className="ai-insight-content">
            <div className="insight-row">
              <span className="insight-label">Crop:</span>
              <span className="insight-value">
                {latestAnalysis?.crop || currentUser?.preferred_crop || 'Tomato'}
              </span>
            </div>

            <div className="insight-row">
              <span className="insight-label">Status:</span>
              <span className="insight-value">
                {latestAnalysis ? (
                  getRawConfidence(latestAnalysis) < 0.65 ? (
                    <span className="text-warning">Needs Inspection (Low Confidence)</span>
                  ) : latestAnalysis.status === 'Healthy' || latestAnalysis.disease?.toLowerCase().includes('healthy') ? (
                    <span className="text-healthy">Healthy</span>
                  ) : (
                    <span className="text-diseased">Disease detected ({latestAnalysis.disease})</span>
                  )
                ) : (
                  <span className="text-muted">No active infection recorded</span>
                )}
              </span>
            </div>

            <div className="insight-row">
              <span className="insight-label">Irrigation:</span>
              <span className="insight-value">
                {irrigationData.status === 'Irrigation Required' ? (
                  <span className="text-alert">Required</span>
                ) : irrigationData.status === 'Not Required' ? (
                  <span className="text-healthy">Not Required</span>
                ) : (
                  <span className="text-muted">Adequate</span>
                )}
              </span>
            </div>

            <div className="insight-row">
              <span className="insight-label">Weather:</span>
              <span className="insight-value">
                {weatherData.data?.weather ? (
                  `${weatherData.data.weather.temperature.toFixed(1)}°C • ${weatherData.data.weather.weather_condition} • ${weatherData.data.weather.rain_probability}% Rain Prob`
                ) : (
                  <span className="text-muted">Weather data unavailable</span>
                )}
              </span>
            </div>

            <div className="insight-recommendation-box">
              <div className="rec-box-title">Agronomic Recommendation:</div>
              <p className="rec-box-body">
                {weatherData.data?.recommendation ||
                  'Maintain balanced hydration and scout lower interior canopies for early foliar spots. Connect with Kisan Co-Pilot for customized advisory.'}
              </p>
            </div>
          </div>

          <div className="panel-footer-btn-wrapper">
            <button className="btn-primary-action" onClick={() => navigateTo('assistant')}>
              View Full Advice →
            </button>
          </div>
        </div>

        {/* Right Column: Weather Snapshot */}
        <div className="insight-card-panel" id="panel-weather-snapshot">
          <div className="panel-header-row">
            <h3 className="panel-heading">🌦️ Weather Snapshot</h3>
            {weatherData.data?.weather_risk && (
              <span
                className={`risk-badge risk-${weatherData.data.weather_risk.toLowerCase()}`}
              >
                Risk: {weatherData.data.weather_risk}
              </span>
            )}
          </div>

          {weatherData.loading ? (
            <div className="weather-snapshot-loading">Querying Open-Meteo API...</div>
          ) : weatherData.data && weatherData.data.weather ? (
            <div className="weather-snapshot-body">
              <div className="weather-temp-hero">
                <span className="temp-hero-digits">
                  {weatherData.data.weather.temperature.toFixed(1)}°C
                </span>
                <span className="weather-condition-pill">
                  {weatherData.data.weather.weather_condition}
                </span>
              </div>

              <div className="weather-telemetry-stats">
                <div className="telemetry-item">
                  <span className="telemetry-label">Humidity</span>
                  <span className="telemetry-value">{weatherData.data.weather.humidity}%</span>
                </div>
                <div className="telemetry-item">
                  <span className="telemetry-label">Rain Probability</span>
                  <span className="telemetry-value">{weatherData.data.weather.rain_probability}%</span>
                </div>
                <div className="telemetry-item">
                  <span className="telemetry-label">24–48h Forecast</span>
                  <span className="telemetry-value">{weatherData.data.weather.forecast_precipitation} mm</span>
                </div>
                <div className="telemetry-item">
                  <span className="telemetry-label">Weather Risk</span>
                  <span className="telemetry-value font-bold">{weatherData.data.weather_risk || 'LOW'}</span>
                </div>
              </div>

              <div className="weather-forecast-note">
                {weatherData.data.weather.rain_probability >= 60
                  ? 'Rain is likely in the next 24–48 hours. Conserve irrigation.'
                  : 'Favorable spraying and field cultivation conditions.'}
              </div>
            </div>
          ) : (
            <div className="weather-snapshot-unavailable">
              <p>Weather data unavailable</p>
              <span className="sub-hint">Check network connection or try again.</span>
            </div>
          )}

          <div className="panel-footer-btn-wrapper">
            <button className="btn-secondary-action" onClick={() => navigateTo('weather')}>
              View Weather →
            </button>
          </div>
        </div>
      </section>

      {/* 5. RECENT ANALYSIS */}
      <section className="dashboard-recent-analysis-section">
        <div className="section-header-flex">
          <div>
            <h2 className="section-title">Recent Analysis</h2>
            <p className="section-subtitle">Verified leaf disease detection results.</p>
          </div>
          <button className="btn-small-link" onClick={() => navigateTo('diagnose')}>
            + New Diagnosis
          </button>
        </div>

        {recentAnalyses.length === 0 ? (
          <div className="empty-analysis-card">
            <div className="empty-icon">🍃</div>
            <p className="empty-text">No recent leaf analyses recorded.</p>
            <button className="btn-primary-action" onClick={() => navigateTo('diagnose')}>
              Analyze First Leaf
            </button>
          </div>
        ) : (
          <div className="table-responsive-container">
            <table className="recent-analysis-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Crop</th>
                  <th>Result</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentAnalyses.map((item) => {
                  const rawConf = getRawConfidence(item);
                  const isLowConf = rawConf < 0.65;
                  const isHealthy =
                    item.status === 'Healthy' ||
                    item.disease?.toLowerCase().includes('healthy');

                  return (
                    <tr key={item.id || Math.random()}>
                      <td className="font-mono text-sm">{item.date || 'Just now'}</td>
                      <td className="font-semibold">{item.crop || 'Crop'}</td>
                      <td>
                        {/* MANDATORY SAFETY RULE: If confidence < 65%, suppress disease name */}
                        {isLowConf ? (
                          <span className="text-warning font-semibold">
                            Low Confidence — Further Inspection Needed
                          </span>
                        ) : (
                          <span>{item.disease}</span>
                        )}
                      </td>
                      <td>
                        <span className="confidence-pill">{item.confidence || '—'}</span>
                      </td>
                      <td>
                        {isLowConf ? (
                          <span className="badge badge-warning">Needs Inspection</span>
                        ) : isHealthy ? (
                          <span className="badge badge-healthy">Healthy</span>
                        ) : (
                          <span className="badge badge-diseased">Disease Detected</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="table-action-btn"
                          onClick={() => navigateTo('diagnose')}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. CROP RECOMMENDATION */}
      <section className="dashboard-crop-rec-section">
        <div className="panel-card crop-rec-card">
          <div className="panel-header-row">
            <h3 className="panel-heading">🌱 Crop Recommendation</h3>
            <span className="panel-status-pill">Soil N-P-K Engine</span>
          </div>

          <div className="crop-rec-body">
            {cropRecData.loading ? (
              <div className="text-muted">Loading crop recommendations...</div>
            ) : cropRecData.recommendation ? (
              <div className="crop-rec-active-content">
                <div className="crop-rec-main-row">
                  <span className="crop-rec-label">Recommended Crop:</span>
                  <strong className="crop-rec-highlight">
                    {cropRecData.recommendation.top_crop}
                  </strong>
                  <span className="crop-rec-conf">
                    ({cropRecData.recommendation.confidence} Match)
                  </span>
                </div>
                <div className="crop-rec-sub-info">
                  Soil Profile: N-P-K {cropRecData.recommendation.n_p_k} • pH {cropRecData.recommendation.ph} • Recorded on {cropRecData.recommendation.created_at}
                </div>
              </div>
            ) : (
              <div className="crop-rec-empty-content">
                <div className="crop-rec-empty-title">No recommendation available</div>
                <p className="crop-rec-empty-desc">
                  Input your soil Nitrogen, Phosphorus, Potassium, and pH levels in the Smart Farming module to get verified machine-learning crop suggestions.
                </p>
              </div>
            )}

            <div className="crop-rec-action-wrapper">
              <button
                className="btn-secondary-action"
                onClick={() => navigateTo('smart-farming', 'crops')}
              >
                {cropRecData.recommendation ? 'View Recommendation →' : 'Get Crop Recommendation →'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. INTERACTIVE YIELD PREDICTION MODAL */}
      {isYieldModalOpen && (
        <div className="dashboard-modal-overlay" onClick={() => setIsYieldModalOpen(false)}>
          <div
            className="dashboard-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">🌾 Harvest Yield Predictor</h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsYieldModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCalculateYield} className="modal-form">
              <p className="modal-desc">
                Uses the trained Random Forest agronomical yield model to estimate field production based on area, fertilization, and historical climate.
              </p>

              {yieldError && <div className="modal-error-banner">{yieldError}</div>}

              <div className="modal-form-grid">
                <div className="form-group">
                  <label className="form-label">Crop Type</label>
                  <select
                    className="form-input"
                    value={yieldForm.crop}
                    onChange={(e) => setYieldForm({ ...yieldForm, crop: e.target.value })}
                  >
                    <option value="Tomato">Tomato</option>
                    <option value="Potato">Potato</option>
                    <option value="Corn">Corn</option>
                    <option value="Rice">Rice</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Grape">Grape</option>
                    <option value="Bell Pepper">Bell Pepper</option>
                    <option value="Peach">Peach</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Field Area (Hectares)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="form-input"
                    value={yieldForm.area}
                    onChange={(e) => setYieldForm({ ...yieldForm, area: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fertilizer Rate (kg/ha)</label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    className="form-input"
                    value={yieldForm.fertilizer}
                    onChange={(e) => setYieldForm({ ...yieldForm, fertilizer: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pesticide Application (kg/ha)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="form-input"
                    value={yieldForm.pesticide}
                    onChange={(e) => setYieldForm({ ...yieldForm, pesticide: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State / Agronomic Region</label>
                  <input
                    type="text"
                    className="form-input"
                    value={yieldForm.state}
                    onChange={(e) => setYieldForm({ ...yieldForm, state: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Season</label>
                  <select
                    className="form-input"
                    value={yieldForm.season}
                    onChange={(e) => setYieldForm({ ...yieldForm, season: e.target.value })}
                  >
                    <option value="Kharif">Kharif</option>
                    <option value="Rabi">Rabi</option>
                    <option value="Whole Year">Whole Year</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setIsYieldModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={yieldLoading}
                >
                  {yieldLoading ? 'Calculating ML Yield...' : 'Calculate Estimated Yield'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
