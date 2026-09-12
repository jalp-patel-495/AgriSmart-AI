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

export default function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState(() => authApi.getCurrentUser());
  // Navigation: before login defaults to 'home', after login defaults to 'dashboard'
  const [activeTab, setActiveTab] = useState(() => (authApi.getCurrentUser() ? 'dashboard' : 'home'));
  const [backendStatus, setBackendStatus] = useState('checking');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [classesData, setClassesData] = useState([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [pendingTab, setPendingTab] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

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

  // Dynamic context synchronized across all farm modules
  const farmContext = {
    crop: result?.crop || currentUser?.preferred_crop || 'Tomato',
    disease: result?.disease || 'Early Blight',
    confidence: result?.confidence || '92%',
    pathogen: result?.pathogen || 'Alternaria solani (Fungus)',
    temperature: 28.0,
    humidity: 78.0,
    rain_forecast_mm: 1.5,
    irrigation_status: 'Immediate Deficit (820,000 L/ha)',
    soil_type: 'Clay Loam',
    n_p_k: '85-48-42 kg/ha',
    farmer_name: currentUser?.full_name || 'Farmer',
    farm_name: currentUser?.farm_name || 'Family Farm',
  };

  // Pre-loaded canonical classes matching dataset/classes.json
  useEffect(() => {
    const defaultClasses = [
      { id: 0, name: "Apple___Apple_scab", crop: "Apple", disease: "Apple Scab", status: "Diseased", pathogen: "Venturia inaequalis (Fungus)", symptoms: "Dull olive-green or brown velvety spots on leaves.", treatment: "Apply sulfur or copper fungicides during early bud break." },
      { id: 1, name: "Apple___Black_rot", crop: "Apple", disease: "Black Rot", status: "Diseased", pathogen: "Botryosphaeria obtusa (Fungus)", symptoms: "Frog-eye circular leaf spots with purple margins.", treatment: "Prune dead wood. Apply captan or mancozeb sprays." },
      { id: 2, name: "Apple___healthy", crop: "Apple", disease: "None (Healthy)", status: "Healthy", pathogen: "None", symptoms: "Vibrant emerald green leaves, unblemished foliage.", treatment: "Maintain regular irrigation and balanced organic fertilizers." },
      { id: 3, name: "Corn___Common_rust", crop: "Corn", disease: "Common Rust", status: "Diseased", pathogen: "Puccinia sorghi (Fungus)", symptoms: "Cinnamon-brown oval powdery pustules on leaves.", treatment: "Deploy rust-resistant hybrids. Apply triazole fungicides if severe." },
      { id: 4, name: "Corn___Northern_Leaf_Blight", crop: "Corn", disease: "Northern Leaf Blight", status: "Diseased", pathogen: "Exserohilum turcicum (Fungus)", symptoms: "Long elliptical grayish-green cigar-shaped lesions.", treatment: "Crop rotation and early foliar fungicide applications." },
      { id: 5, name: "Corn___healthy", crop: "Corn", disease: "None (Healthy)", status: "Healthy", pathogen: "None", symptoms: "Uniform deep green leaves, no fungal lesions.", treatment: "Ensure nitrogen supply and monitor soil drainage." },
      { id: 6, name: "Potato___Early_blight", crop: "Potato", disease: "Early Blight", status: "Diseased", pathogen: "Alternaria solani (Fungus)", symptoms: "Target-board concentric rings with yellow chlorosis.", treatment: "Apply chlorothalonil or copper-based sprays every 7-10 days." },
      { id: 7, name: "Potato___Late_blight", crop: "Potato", disease: "Late Blight", status: "Diseased", pathogen: "Phytophthora infestans (Oomycete)", symptoms: "Rapidly spreading water-soaked black lesions with white sporulation.", treatment: "Use certified disease-free tubers; apply cymoxanil or metalaxyl." },
      { id: 8, name: "Potato___healthy", crop: "Potato", disease: "None (Healthy)", status: "Healthy", pathogen: "None", symptoms: "Lush dark-green compound leaves without lesions.", treatment: "Hill soil properly and rotate with non-solanaceous crops." },
      { id: 9, name: "Tomato___Bacterial_spot", crop: "Tomato", disease: "Bacterial Spot", status: "Diseased", pathogen: "Xanthomonas perforans (Bacteria)", symptoms: "Small water-soaked dark circular lesions with yellow halos.", treatment: "Spray fixed copper mixed with mancozeb. Avoid overhead sprinklers." },
      { id: 10, name: "Tomato___Early_blight", crop: "Tomato", disease: "Early Blight", status: "Diseased", pathogen: "Alternaria solani (Fungus)", symptoms: "Dark brown target-like rings on lower foliage and progressive defoliation.", treatment: "Mulch base, prune lower leaves, and apply copper fungicide." },
      { id: 11, name: "Tomato___Late_blight", crop: "Tomato", disease: "Late Blight", status: "Diseased", pathogen: "Phytophthora infestans (Oomycete)", symptoms: "Large greasy brown necrotic patches with stem rot in humid conditions.", treatment: "Remove heavily infected foliage. Apply protective copper soap sprays." },
      { id: 12, name: "Tomato___healthy", crop: "Tomato", disease: "None (Healthy)", status: "Healthy", pathogen: "None", symptoms: "Crisp emerald foliage with vigorous green growth.", treatment: "Maintain consistent drip hydration and calcium-rich fertile soil." }
    ];
    setClassesData(defaultClasses);

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
                classesData={classesData}
              />
            )}

            {/* Tab: Disease Detector Studio */}
            {activeTab === 'diagnose' && (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Disease Detection Studio</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Field-ready visual diagnostic tool trained on 15,014 verified plant leaf specimens.
                    Upload or capture high-resolution leaf photos to detect pathologies.
                  </p>
                </div>

                <div className="workflow-grid">
                  <ImageUpload onDiagnose={handleDiagnose} isAnalyzing={isAnalyzing} />
                  <ResultView
                    result={result}
                    isAnalyzing={isAnalyzing}
                    error={error}
                    onNavigateToWeather={() => setActiveTab('weather')}
                    onNavigateToAssistant={() => setActiveTab('assistant')}
                  />
                </div>
              </div>
            )}

            {/* Tab: Weather Intelligence */}
            {activeTab === 'weather' && (
              <WeatherDashboard onNavigateToDiagnose={() => setActiveTab('diagnose')} />
            )}

            {/* Tab: Smart Farming & Precision Irrigation */}
            {activeTab === 'smart-farming' && (
              <SmartFarmingDashboard />
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
