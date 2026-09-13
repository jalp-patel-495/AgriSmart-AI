import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HomePage from './components/HomePage';
import Dashboard from './components/Dashboard';
import ImageUpload from './components/ImageUpload';
import ResultView from './components/ResultView';
import WeatherDashboard from './components/WeatherDashboard';
import SmartFarmingDashboard from './components/SmartFarmingDashboard';
import GenAIAssistant from './components/GenAIAssistant';
import AuthModal from './components/AuthModal';
import FloatingChatbotButton from './components/FloatingChatbotButton';
import { checkBackendHealth, predictCropDisease } from './services/api';
import { authApi } from './services/authApi';
import { resolveCrop, CANONICAL_CLASSES } from './utils/cropDiseaseResolver';
import { fetchWeatherIntelligence } from './services/weatherIntelligenceService';

export default function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState(() => authApi.getCurrentUser());
  // Navigation: before login defaults to 'home', after login defaults to 'dashboard'
  const [activeTab, setActiveTab] = useState(() => (authApi.getCurrentUser() ? 'dashboard' : 'home'));
  const [smartFarmingSubTab, setSmartFarmingSubTab] = useState('irrigation');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [classesData, setClassesData] = useState([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [pendingTab, setPendingTab] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [liveWeather, setLiveWeather] = useState(null);

  const getTabTitle = (tab) => {
    switch (tab) {
      case 'dashboard': return 'Farmer Dashboard';
      case 'diagnose': return 'Disease Detector Studio';
      case 'smart-farming': return 'Smart Irrigation Hub';
      case 'weather': return 'Weather Intelligence Engine';
      case 'assistant': return 'Kisan AI Co-Pilot';
      default: return 'Protected Module';
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleOpenAuth = (mode = 'login', targetTab = null) => {
    setAuthMode(mode);
    if (targetTab) {
      setPendingTab(targetTab);
    }
    setAuthModalOpen(true);
  };

  const handleNavigateProtectedTab = (tab) => {
    if (currentUser) {
      setActiveTab(tab);
    } else {
      handleOpenAuth('login', tab);
    }
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    showToast(`Welcome back, ${user.full_name}! Signed in successfully.`);
    setActiveTab(pendingTab || 'dashboard');
    setPendingTab(null);
  };

  const handleLogout = () => {
    authApi.logout();
    setCurrentUser(null);
    setActiveTab('home');
    showToast('You have signed out successfully.');
  };

  // Scientific safety checks for farm context
  const isLowConf = Boolean(
    result && (
      (typeof result.confidence_score === 'number' && result.confidence_score < 0.65) ||
      (typeof result.confidence === 'string' && parseFloat(result.confidence) < 65)
    )
  );
  const resolvedCrop = result ? resolveCrop(result) : null;

  // Dynamic context synchronized across all farm modules
  const farmContext = {
    crop: isLowConf
      ? (resolvedCrop ? `Possible Crop: ${resolvedCrop}` : 'Undetermined')
      : (resolvedCrop || result?.crop || currentUser?.preferred_crop || 'Tomato'),
    disease: isLowConf
      ? 'Not confidently identified'
      : (result?.disease || (liveWeather?.weather_risk === 'HIGH' ? 'Foliar Risk Alert' : 'Healthy Field')),
    confidence: result?.confidence || (result ? '90%' : 'High'),
    pathogen: isLowConf ? 'None' : (result?.pathogen || (result ? 'Detected Pathogen' : 'None')),
    farmer_note: isLowConf
      ? 'The model was unable to confidently identify the disease. Please upload a clearer image.'
      : undefined,
    temperature: liveWeather?.weather?.temperature ?? 28.0,
    humidity: liveWeather?.weather?.humidity ?? 70.0,
    rain_forecast_mm: liveWeather?.weather?.forecast_precipitation ?? 0.0,
    irrigation_status: liveWeather?.irrigation_prediction === 'YES'
      ? 'Irrigation Required (Low Soil Moisture)'
      : (liveWeather?.irrigation_prediction === 'NO' ? 'Soil Moisture Adequate' : 'Optimal Hydration'),
    soil_type: currentUser?.soil_type || 'Clay Loam',
    n_p_k: '85-48-42 kg/ha',
    farmer_name: currentUser?.full_name || 'Farmer',
    farm_name: currentUser?.farm_name || 'Family Farm',
    weather_risk: liveWeather?.weather_risk || 'LOW',
    weather_condition: liveWeather?.weather?.weather_condition || 'Clear Sky',
    weather_recommendation: liveWeather?.recommendation || 'Normal field operations.',
  };

  // Pre-load canonical 19 classes matching dataset/classes.json and best trained model
  useEffect(() => {
    setClassesData(CANONICAL_CLASSES);

    // Initial weather intelligence load
    fetchWeatherIntelligence()
      .then((data) => {
        if (data && data.status === 'success') {
          setLiveWeather(data);
        }
      })
      .catch((err) => console.warn('Weather auto-fetch deferred:', err));

    // Check backend health via api service
    checkBackendHealth().then((data) => {
      if (data && data.status === 'healthy') {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    });
  }, []);

  const handleDiagnose = async (file) => {
    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const data = await predictCropDisease(file);
      setResult(data);
      try {
        const existing = JSON.parse(localStorage.getItem('agrismart_recent_analyses') || '[]');
        const isLowConfEntry = (typeof data.confidence_score === 'number' && data.confidence_score < 0.65) ||
                               (typeof data.confidence === 'string' && parseFloat(data.confidence) < 65);
        const entryCrop = resolveCrop(data);
        const newEntry = {
          id: Date.now(),
          date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          crop: isLowConfEntry
            ? (entryCrop ? `Possible Crop: ${entryCrop}` : 'Undetermined')
            : (entryCrop || data.crop || 'Crop'),
          disease: isLowConfEntry ? 'Not confidently identified' : (data.disease || 'Condition'),
          confidence: data.confidence || '0%',
          confidence_score: data.confidence_score,
          status: isLowConfEntry ? 'Low Confidence' : (data.status || 'Analyzed'),
          pathogen: isLowConfEntry ? null : (data.pathogen || null),
          treatment: isLowConfEntry ? null : (data.treatment || null),
          imageName: file?.name || 'leaf_photo.jpg'
        };
        localStorage.setItem('agrismart_recent_analyses', JSON.stringify([newEntry, ...existing.slice(0, 9)]));
      } catch (storageErr) {
        console.warn('Could not cache recent analysis:', storageErr);
      }
    } catch (err) {
      console.warn('Backend inference failed or offline, checking fallback:', err);
      setError(err.message || 'AI inference request failed. Please check server connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="app-toast-banner">
          <span className="toast-icon">🌱</span>
          <span className="toast-text">{toastMessage}</span>
          <button className="toast-close" onClick={() => setToastMessage(null)}>✕</button>
        </div>
      )}

      {/* Global Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className={`main-content ${!currentUser && activeTab === 'home' ? 'main-content-full' : ''}`}>
        {/* Tab: Home Page (Only shown before login) */}
        {!currentUser && activeTab === 'home' && (
          <HomePage
            onExploreDashboard={() => handleNavigateProtectedTab('dashboard')}
            onOpenAuth={handleOpenAuth}
            currentUser={currentUser}
            onNavigateTab={handleNavigateProtectedTab}
          />
        )}

        {/* Require Login Barrier: Displayed if guest tries to access any protected tab */}
        {!currentUser && activeTab !== 'home' && (
          <div className="auth-required-container">
            <div className="auth-required-card">
              <div className="auth-required-icon">🔒</div>
              <h2 className="auth-required-title">Sign In Required</h2>
              <p className="auth-required-desc">
                Access to the <strong>{getTabTitle(activeTab)}</strong> requires an active account. Please sign in or create a free account to continue.
              </p>
              <div className="auth-required-btn-group">
                <button
                  className="auth-submit-btn"
                  onClick={() => handleOpenAuth('login', activeTab)}
                >
                  Sign In to Access {getTabTitle(activeTab)} →
                </button>
                <button
                  className="auth-secondary-btn"
                  onClick={() => handleOpenAuth('signup', activeTab)}
                >
                  Create New Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Protected Pages (Rendered only after authentication) */}
        {currentUser && (
          <>
            {/* Tab: Farmer Dashboard */}
            {(activeTab === 'dashboard' || activeTab === 'home') && (
              <Dashboard
                onStartDiagnose={() => setActiveTab('diagnose')}
                onNavigateTab={(tab, subTab = 'irrigation') => {
                  if (subTab) setSmartFarmingSubTab(subTab);
                  setActiveTab(tab);
                }}
                latestResult={result}
                currentUser={currentUser}
                classesData={classesData}
                onWeatherUpdate={setLiveWeather}
              />
            )}

            {/* Tab: Disease Detector Studio */}
            {activeTab === 'diagnose' && (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Disease Detection Studio</h2>
                      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>
                        Field-ready visual diagnostic tool validated on <strong>21,749 verified specimens</strong> across <strong>19 classes</strong> and <strong>7 crop species</strong>.
                      </p>
                    </div>

                    {/* Supported Crops compact info section */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.08)',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Supported Crops:
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {['Apple', 'Corn', 'Potato', 'Tomato', 'Grape', 'Bell Pepper', 'Peach'].map((c) => (
                          <span
                            key={c}
                            style={{
                              fontSize: '0.78rem',
                              color: '#a7f3d0',
                              fontWeight: 500,
                              background: 'rgba(16, 185, 129, 0.16)',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px'
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="workflow-grid">
                  <ImageUpload onDiagnose={handleDiagnose} isAnalyzing={isAnalyzing} />
                  <ResultView
                    result={result}
                    isAnalyzing={isAnalyzing}
                    error={error}
                    weatherData={liveWeather}
                    onNavigateToWeather={() => setActiveTab('weather')}
                    onNavigateToAssistant={() => setActiveTab('assistant')}
                  />
                </div>
              </div>
            )}

            {/* Tab: Weather Intelligence */}
            {activeTab === 'weather' && (
              <WeatherDashboard
                onNavigateToDiagnose={() => setActiveTab('diagnose')}
                onWeatherUpdate={setLiveWeather}
              />
            )}

            {/* Tab: Smart Farming & Precision Irrigation */}
            {activeTab === 'smart-farming' && (
              <SmartFarmingDashboard initialSubTab={smartFarmingSubTab} />
            )}

            {/* Tab: Kisan GenAI Assistant */}
            {activeTab === 'assistant' && (
              <GenAIAssistant farmContext={farmContext} />
            )}
          </>
        )}
      </main>

      {/* Floating Chatbot Button */}
      <FloatingChatbotButton
        activeTab={activeTab}
        onOpenAssistant={() => handleNavigateProtectedTab('assistant')}
      />

      {/* Authentication Modal (Login & Signup) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Footer (Rendered when not on Home Page which has its own footer) */}
      {activeTab !== 'home' && (
        <footer className="footer">
          <p>AgriSmart AI © 2026 • Intelligent Agricultural Health & Early Warning Diagnostic System</p>
        </footer>
      )}
    </div>
  );
}
