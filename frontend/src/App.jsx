import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// Layout & Route Guards
import RoleLayout from './components/layout/RoleLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Common / Auth
import LoginPage from './components/common/LoginPage';
import ProfileView from './components/common/ProfileView';
import AuthModal from './components/AuthModal';
import FloatingChatbotButton from './components/FloatingChatbotButton';
import HomePage from './components/HomePage';
import Navbar from './components/Navbar';
import GenAIAssistant from './components/GenAIAssistant';

// Farmer Views
import FarmerDashboard from './components/farmer/FarmerDashboard';
import FarmerDiseaseDetection from './components/farmer/FarmerDiseaseDetection';
import FarmerSmartIrrigation from './components/farmer/FarmerSmartIrrigation';
import FarmerMyCrops from './components/farmer/FarmerMyCrops';
import FarmerDiseaseHistory from './components/farmer/FarmerDiseaseHistory';
import FarmerTreatments from './components/farmer/FarmerTreatments';
import FarmerWeather from './components/farmer/FarmerWeather';

// Stakeholder Views
import StakeholderRoleDashboard from './components/stakeholder/StakeholderRoleDashboard';
import StakeholderAnalyticsView from './components/stakeholder/StakeholderAnalyticsView';
import StakeholderCropStatsView from './components/stakeholder/StakeholderCropStatsView';
import StakeholderDiseaseTrendsView from './components/stakeholder/StakeholderDiseaseTrendsView';
import StakeholderReportsView from './components/stakeholder/StakeholderReportsView';
import StakeholderActivityView from './components/stakeholder/StakeholderActivityView';

// Expert Views
import ExpertDashboard from './components/expert/ExpertDashboard';
import ExpertDiseaseCases from './components/expert/ExpertDiseaseCases';
import ExpertFarmerQueries from './components/expert/ExpertFarmerQueries';
import ExpertDiagnosisReview from './components/expert/ExpertDiagnosisReview';
import ExpertTreatmentsView from './components/expert/ExpertTreatmentsView';

// Admin Views
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUserManagement from './components/admin/AdminUserManagement';
import AdminCropManagement from './components/admin/AdminCropManagement';
import AdminDiseaseManagement from './components/admin/AdminDiseaseManagement';
import AdminDatasetAIView from './components/admin/AdminDatasetAIView';
import AdminReportsView from './components/admin/AdminReportsView';
import AdminSystemActivity from './components/admin/AdminSystemActivity';
import AdminSettingsView from './components/admin/AdminSettingsView';

// Services
import { authApi } from './services/authApi';
import { checkBackendHealth } from './services/api';

/**
 * Automatically routes authenticated users to their specific role dashboard
 */
function RoleDashboardRedirect({ currentUser }) {
  const user = currentUser || authApi.getCurrentUser();
  if (!user) return <Navigate to="/" replace />;
  const role = (user.role || 'FARMER').toUpperCase();
  if (role === 'AGRICULTURAL_STAKEHOLDER') return <Navigate to="/stakeholder/dashboard" replace />;
  if (role === 'AGRICULTURAL_EXPERT') return <Navigate to="/expert/dashboard" replace />;
  if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/farmer/dashboard" replace />;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Active Session State
  const [currentUser, setCurrentUser] = useState(() => authApi.getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [backendStatus, setBackendStatus] = useState('checking');

  // Backend Health Ping
  useEffect(() => {
    const verifyHealth = async () => {
      try {
        await checkBackendHealth();
        setBackendStatus('online');
      } catch (err) {
        setBackendStatus('offline');
      }
    };
    verifyHealth();
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setAuthModalOpen(false);
    const role = (user.role || 'FARMER').toUpperCase();
    if (role === 'AGRICULTURAL_STAKEHOLDER') {
      navigate('/stakeholder/dashboard');
    } else if (role === 'AGRICULTURAL_EXPERT') {
      navigate('/expert/dashboard');
    } else if (role === 'ADMIN') {
      navigate('/admin/dashboard');
    } else {
      navigate('/farmer/dashboard');
    }
  };

  const handleLogout = () => {
    authApi.logout();
    setCurrentUser(null);
    navigate('/', { replace: true });
  };

  const handleProfileUpdated = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  return (
    <div className="app-root">
      <Routes>
        {/* Public Landing & Login */}
        <Route
          path="/"
          element={
            currentUser ? (
              <RoleDashboardRedirect currentUser={currentUser} />
            ) : (
              <div>
                <Navbar
                  activeTab="home"
                  setActiveTab={(tab) => {
                    if (tab === 'login') {
                      navigate('/login');
                    } else if (tab === 'signup') {
                      navigate('/signup');
                    }
                  }}
                  backendStatus={backendStatus}
                  currentUser={null}
                  onOpenAuth={(mode) => {
                    if (mode === 'signup') {
                      navigate('/signup');
                    } else {
                      navigate('/login');
                    }
                  }}
                  onLogout={handleLogout}
                />
                <HomePage
                  onOpenAuth={(mode) => {
                    if (mode === 'signup') {
                      navigate('/signup');
                    } else {
                      navigate('/login');
                    }
                  }}
                  onExploreClick={() => navigate('/login')}
                />
              </div>
            )
          }
        />

        <Route
          path="/home"
          element={<Navigate to="/" replace />}
        />

        <Route
          path="/login"
          element={<LoginPage initialMode="login" onAuthSuccess={handleAuthSuccess} />}
        />

        <Route
          path="/signup"
          element={<LoginPage initialMode="signup" onAuthSuccess={handleAuthSuccess} />}
        />

        <Route
          path="/register"
          element={<Navigate to="/signup" replace />}
        />

        {/* Universal Redirect */}
        <Route
          path="/dashboard"
          element={<RoleDashboardRedirect currentUser={currentUser} />}
        />

        {/* =======================================================
            1. FARMER PROTECTED ROUTES (/farmer/*)
            ======================================================= */}
        <Route
          path="/farmer"
          element={
            <ProtectedRoute requiredRoles={['FARMER']}>
              <RoleLayout
                currentUser={currentUser}
                onLogout={handleLogout}
                onRefreshUser={() => setCurrentUser(authApi.getCurrentUser())}
              />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/farmer/dashboard" replace />} />
          <Route path="dashboard" element={<FarmerDashboard />} />
          <Route path="disease-detection" element={<FarmerDiseaseDetection />} />
          <Route path="irrigation" element={<FarmerSmartIrrigation />} />
          <Route path="my-crops" element={<FarmerMyCrops />} />
          <Route path="disease-history" element={<FarmerDiseaseHistory />} />
          <Route path="treatments" element={<FarmerTreatments />} />
          <Route path="weather" element={<FarmerWeather />} />
          <Route
            path="profile"
            element={
              <ProfileView
                currentUser={currentUser}
                onProfileUpdated={handleProfileUpdated}
                onLogout={handleLogout}
              />
            }
          />
        </Route>

        {/* =======================================================
            2. STAKEHOLDER PROTECTED ROUTES (/stakeholder/*)
            ======================================================= */}
        <Route
          path="/stakeholder"
          element={
            <ProtectedRoute requiredRoles={['AGRICULTURAL_STAKEHOLDER', 'ADMIN']}>
              <RoleLayout
                currentUser={currentUser}
                onLogout={handleLogout}
                onRefreshUser={() => setCurrentUser(authApi.getCurrentUser())}
              />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/stakeholder/dashboard" replace />} />
          <Route path="dashboard" element={<StakeholderRoleDashboard />} />
          <Route path="analytics" element={<StakeholderAnalyticsView />} />
          <Route path="crop-statistics" element={<StakeholderCropStatsView />} />
          <Route path="disease-trends" element={<StakeholderDiseaseTrendsView />} />
          <Route path="reports" element={<StakeholderReportsView />} />
          <Route path="activity" element={<StakeholderActivityView />} />
          <Route
            path="profile"
            element={
              <ProfileView
                currentUser={currentUser}
                onProfileUpdated={handleProfileUpdated}
                onLogout={handleLogout}
              />
            }
          />
        </Route>

        {/* =======================================================
            3. EXPERT PROTECTED ROUTES (/expert/*)
            ======================================================= */}
        <Route
          path="/expert"
          element={
            <ProtectedRoute requiredRoles={['AGRICULTURAL_EXPERT', 'ADMIN']}>
              <RoleLayout
                currentUser={currentUser}
                onLogout={handleLogout}
                onRefreshUser={() => setCurrentUser(authApi.getCurrentUser())}
              />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/expert/dashboard" replace />} />
          <Route path="dashboard" element={<ExpertDashboard />} />
          <Route path="cases" element={<ExpertDiseaseCases />} />
          <Route path="queries" element={<ExpertFarmerQueries />} />
          <Route path="diagnosis-review" element={<ExpertDiagnosisReview />} />
          <Route path="treatments" element={<ExpertTreatmentsView />} />
          <Route
            path="profile"
            element={
              <ProfileView
                currentUser={currentUser}
                onProfileUpdated={handleProfileUpdated}
                onLogout={handleLogout}
              />
            }
          />
        </Route>

        {/* =======================================================
            4. ADMIN PROTECTED ROUTES (/admin/*)
            ======================================================= */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRoles={['ADMIN']}>
              <RoleLayout
                currentUser={currentUser}
                onLogout={handleLogout}
                onRefreshUser={() => setCurrentUser(authApi.getCurrentUser())}
              />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUserManagement />} />
          <Route path="crops" element={<AdminCropManagement />} />
          <Route path="diseases" element={<AdminDiseaseManagement />} />
          <Route path="ai-model" element={<AdminDatasetAIView />} />
          <Route path="reports" element={<AdminReportsView />} />
          <Route path="activity" element={<AdminSystemActivity />} />
          <Route path="settings" element={<AdminSettingsView />} />
          <Route
            path="profile"
            element={
              <ProfileView
                currentUser={currentUser}
                onProfileUpdated={handleProfileUpdated}
                onLogout={handleLogout}
              />
            }
          />
        </Route>

        {/* Fallback 404 Route */}
        <Route
          path="*"
          element={<RoleDashboardRedirect currentUser={currentUser} />}
        />
      </Routes>

      {/* Floating Chatbot Assistant */}
      <FloatingChatbotButton
        activeTab="assistant"
        onOpenAssistant={() => {
          const role = (currentUser?.role || 'FARMER').toUpperCase();
          if (role === 'FARMER') navigate('/farmer/dashboard');
          else if (role === 'AGRICULTURAL_STAKEHOLDER') navigate('/stakeholder/dashboard');
          else if (role === 'AGRICULTURAL_EXPERT') navigate('/expert/dashboard');
          else navigate('/admin/dashboard');
        }}
      />

      {/* Legacy AuthModal fallback if triggered */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
