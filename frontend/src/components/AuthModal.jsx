import React, { useState, useEffect } from 'react';
import { authApi } from '../services/authApi';

const REGIONS_LIST = [
  'Punjab, India',
  'Haryana, India',
  'Gujarat, India',
  'Maharashtra, India',
  'Uttar Pradesh, India',
  'Madhya Pradesh, India',
  'Rajasthan, India',
  'Bihar, India',
  'West Bengal, India',
  'Andhra Pradesh, India',
  'Telangana, India',
  'Karnataka, India',
  'Tamil Nadu, India',
  'Kerala, India',
  'Odisha, India',
  'Assam, India',
  'Chhattisgarh, India',
  'Jharkhand, India',
  'Himachal Pradesh, India',
  'Uttarakhand, India',
  'Jammu & Kashmir, India',
  'Delhi / NCR, India',
  'Goa, India',
  'Arunachal Pradesh, India',
  'Manipur, India',
  'Meghalaya, India',
  'Mizoram, India',
  'Nagaland, India',
  'Sikkim, India',
  'Tripura, India',
  'Ladakh, India',
  'Other / Global Agricultural Region'
];

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Login form state (clean defaults, no prefilled credentials)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [farmLocation, setFarmLocation] = useState('Punjab, India');
  const [signupRole, setSignupRole] = useState('FARMER');
  const [organizationName, setOrganizationName] = useState('');
  const [stakeholderType, setStakeholderType] = useState('Farmer Producer Organization');

  // Synchronize modal tab mode with initialMode and clear previous errors
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [initialMode, isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sanitizeAuthError = (errMessage, currentMode) => {
    if (!errMessage) {
      return currentMode === 'login'
        ? 'Unable to sign in right now. Please try again.'
        : 'Unable to create account right now. Please try again.';
    }
    const lower = String(errMessage).toLowerCase();
    if (lower.includes('invalid email or password') || lower.includes('invalid credentials')) {
      return 'Invalid email or password. Please try again.';
    }
    if (lower.includes('already exists')) {
      return 'An account with this email already exists.';
    }
    if (lower.includes('password must be at least 6') || lower.includes('at least 6 characters')) {
      return 'Password must be at least 6 characters long.';
    }
    if (lower.includes('valid email')) {
      return 'Please enter a valid email address.';
    }
    if (lower.includes('deactivated')) {
      return 'This account is deactivated. Please contact an administrator.';
    }
    return currentMode === 'login'
      ? 'Unable to sign in right now. Please try again.'
      : 'Unable to create account right now. Please try again.';
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authApi.login(loginEmail.trim(), loginPassword);
      onAuthSuccess(user);
      onClose();
    } catch (err) {
      setError(sanitizeAuthError(err.message, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    setError(null);
    setLoading(true);
    try {
      const user = await authApi.demoLogin(role);
      onAuthSuccess(user);
      onClose();
    } catch (err) {
      setError(sanitizeAuthError(err.message, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let farmName = 'Family Homestead Farm';
      if (signupRole === 'AGRICULTURAL_STAKEHOLDER') {
        farmName = organizationName.trim() || 'Agricultural Stakeholder Operations';
      } else if (signupRole === 'AGRICULTURAL_EXPERT') {
        farmName = 'Agricultural Extension Center';
      }

      const user = await authApi.signup({
        full_name: fullName.trim(),
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
        farm_location: farmLocation || 'Punjab, India',
        farm_name: farmName,
        preferred_crop: 'Wheat',
        role: signupRole,
        organization_name: signupRole === 'AGRICULTURAL_STAKEHOLDER' ? (organizationName.trim() || null) : null,
        stakeholder_type: signupRole === 'AGRICULTURAL_STAKEHOLDER' ? stakeholderType : null,
      });
      onAuthSuccess(user);
      onClose();
    } catch (err) {
      setError(sanitizeAuthError(err.message, 'signup'));
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close authentication modal"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="auth-header">
          <div className="auth-brand-badge" aria-hidden="true">
            <span>🌱</span>
          </div>
          <h2 id="auth-modal-title" className="auth-title">
            {mode === 'login' ? 'Welcome Back to AgriSmart AI' : 'Join AgriSmart AI'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in to access your intelligent farming tools and AI-powered insights.'
              : 'Create your account and start using AI-powered agriculture tools.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert" aria-live="polite">
            <span className="auth-error-icon" aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <div className="input-icon-wrapper">
                <span className="input-icon" aria-hidden="true">✉️</span>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="input-icon-wrapper">
                <span className="input-icon" aria-hidden="true">🔒</span>
                <input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  className="has-toggle-btn"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  <EyeIcon visible={showLoginPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="auth-signin-submit-btn"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In to Dashboard →'}
            </button>

            {/* Instant Demo Login Bar */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.65rem', textAlign: 'center' }}>
                ⚡ Instant One-Click Demo Access
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  id="demo-login-farmer-btn"
                  className="demo-login-btn"
                  onClick={() => handleDemoLogin('farmer')}
                  disabled={loading}
                  style={{
                    padding: '0.6rem 0.5rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#a7f3d0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontWeight: 600,
                  }}
                >
                  🌾 Demo Farmer
                </button>
                <button
                  type="button"
                  id="demo-login-stakeholder-btn"
                  className="demo-login-btn"
                  onClick={() => handleDemoLogin('stakeholder')}
                  disabled={loading}
                  style={{
                    padding: '0.6rem 0.5rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(14, 165, 233, 0.15)',
                    border: '1px solid rgba(14, 165, 233, 0.4)',
                    color: '#7dd3fc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontWeight: 700,
                  }}
                >
                  🌐 Demo Stakeholder
                </button>
                <button
                  type="button"
                  id="demo-login-expert-btn"
                  className="demo-login-btn"
                  onClick={() => handleDemoLogin('expert')}
                  disabled={loading}
                  style={{
                    padding: '0.6rem 0.5rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#93c5fd',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontWeight: 600,
                  }}
                >
                  🔬 Demo Expert
                </button>
                <button
                  type="button"
                  id="demo-login-admin-btn"
                  className="demo-login-btn"
                  onClick={() => handleDemoLogin('admin')}
                  disabled={loading}
                  style={{
                    padding: '0.6rem 0.5rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontWeight: 600,
                  }}
                >
                  🛠️ Demo Admin
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Signup Form */
          <form className="auth-form" onSubmit={handleSignupSubmit}>
            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <div className="input-icon-wrapper">
                <span className="input-icon" aria-hidden="true">👤</span>
                <input
                  id="signup-name"
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-email">Email Address</label>
              <div className="input-icon-wrapper">
                <span className="input-icon" aria-hidden="true">✉️</span>
                <input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <div className="input-icon-wrapper">
                <span className="input-icon" aria-hidden="true">🔒</span>
                <input
                  id="signup-password"
                  type={showSignupPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Create a password (min 6 chars)"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  autoComplete="new-password"
                  className="has-toggle-btn"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowSignupPassword((prev) => !prev)}
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  <EyeIcon visible={showSignupPassword} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-region">Region / Operational Area</label>
              <div className="input-icon-wrapper">
                <span className="input-icon" aria-hidden="true">📍</span>
                <select
                  id="signup-region"
                  className="auth-select"
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  required
                >
                  <option value="" disabled>Select your region</option>
                  {REGIONS_LIST.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Selection Grid: Farmer, Stakeholder, Expert */}
            <div className="form-group">
              <label htmlFor="signup-role-group">Account Role / Persona</label>
              <div id="signup-role-group" className="signup-role-grid" role="radiogroup" aria-label="Account Role" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {/* 1. Farmer */}
                <button
                  type="button"
                  id="signup-role-farmer"
                  className={`signup-role-card ${signupRole === 'FARMER' ? 'active farmer' : ''}`}
                  onClick={() => setSignupRole('FARMER')}
                  role="radio"
                  aria-checked={signupRole === 'FARMER'}
                >
                  <span className="signup-role-icon" aria-hidden="true">🌾</span>
                  <div className="signup-role-meta">
                    <span className="signup-role-title">Farmer</span>
                    <span className="signup-role-desc">Get farm-level AI recommendations and crop insights.</span>
                  </div>
                </button>

                {/* 2. Agricultural Stakeholder */}
                <button
                  type="button"
                  id="signup-role-stakeholder"
                  className={`signup-role-card ${signupRole === 'AGRICULTURAL_STAKEHOLDER' ? 'active stakeholder' : ''}`}
                  onClick={() => setSignupRole('AGRICULTURAL_STAKEHOLDER')}
                  role="radio"
                  aria-checked={signupRole === 'AGRICULTURAL_STAKEHOLDER'}
                  style={{
                    borderColor: signupRole === 'AGRICULTURAL_STAKEHOLDER' ? '#38bdf8' : undefined,
                    background: signupRole === 'AGRICULTURAL_STAKEHOLDER' ? 'rgba(14, 165, 233, 0.15)' : undefined,
                  }}
                >
                  <span className="signup-role-icon" aria-hidden="true">🌐</span>
                  <div className="signup-role-meta">
                    <span className="signup-role-title" style={{ color: signupRole === 'AGRICULTURAL_STAKEHOLDER' ? '#7dd3fc' : undefined }}>
                      Agricultural Stakeholder
                    </span>
                    <span className="signup-role-desc">Monitor agricultural intelligence, risks, crops, and regions.</span>
                  </div>
                </button>

                {/* 3. Agricultural Expert */}
                <button
                  type="button"
                  id="signup-role-expert"
                  className={`signup-role-card ${signupRole === 'AGRICULTURAL_EXPERT' ? 'active expert' : ''}`}
                  onClick={() => setSignupRole('AGRICULTURAL_EXPERT')}
                  role="radio"
                  aria-checked={signupRole === 'AGRICULTURAL_EXPERT'}
                >
                  <span className="signup-role-icon" aria-hidden="true">🔬</span>
                  <div className="signup-role-meta">
                    <span className="signup-role-title">Agricultural Expert</span>
                    <span className="signup-role-desc">Review and validate agricultural and AI-generated results.</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Optional Stakeholder Profile Fields */}
            {signupRole === 'AGRICULTURAL_STAKEHOLDER' && (
              <div style={{
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem',
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#7dd3fc', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🏢 Stakeholder Organization Profile (Optional)
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="signup-org-name" style={{ fontSize: '0.82rem' }}>Organization / Entity Name</label>
                  <input
                    id="signup-org-name"
                    type="text"
                    placeholder="e.g. Kisan FPO Alliance / Agri-Procurement Ltd."
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', fontSize: '0.88rem' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="signup-org-type" style={{ fontSize: '0.82rem' }}>Stakeholder Category</label>
                  <select
                    id="signup-org-type"
                    value={stakeholderType}
                    onChange={(e) => setStakeholderType(e.target.value)}
                    className="auth-select"
                    style={{ fontSize: '0.88rem' }}
                  >
                    <option value="Farmer Producer Organization">Farmer Producer Organization (FPO)</option>
                    <option value="Agribusiness">Agribusiness &amp; Food Processing</option>
                    <option value="Procurement / Buyer">Procurement &amp; Commodity Buyer</option>
                    <option value="Government / Public Sector">Government / Agricultural Extension</option>
                    <option value="Agricultural Research / Academic">Agricultural Research / Academic</option>
                    <option value="NGO / Sustainability Organization">NGO / Sustainability Organization</option>
                    <option value="Agricultural Input Provider">Agricultural Input Provider</option>
                    <option value="Financial / Insurance organization">Financial / Crop Insurance Organization</option>
                    <option value="Other agricultural organization">Other Agricultural Organization</option>
                  </select>
                </div>
              </div>
            )}

            <button
              type="submit"
              id="auth-signup-submit-btn"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account & Launch →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
