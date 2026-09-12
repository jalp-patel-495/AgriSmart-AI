import React, { useState } from 'react';
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

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [farmLocation, setFarmLocation] = useState('Punjab, India');

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authApi.login(loginEmail, loginPassword);
      onAuthSuccess(user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authApi.signup({
        full_name: fullName,
        email: signupEmail,
        password: signupPassword,
        farm_location: farmLocation || 'Punjab, India',
        farm_name: 'Family Homestead Farm',
        preferred_crop: 'Wheat',
        role: 'farmer',
      });
      onAuthSuccess(user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {/* Modal Header */}
        <div className="auth-header">
          <div className="auth-brand-badge">
            <span>🌱</span>
          </div>
          <h2 className="auth-title">
            {mode === 'login' ? 'Welcome Back to AgriSmart' : 'Join AgriSmart AI'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Access your precision diagnosis, IoT soil telemetry, and micro-climate advisories'
              : 'Empower your crop health management with cutting-edge AI and agronomy'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); }}
          >
            Create Account
          </button>
        </div>


        {error && (
          <div className="auth-error-banner">
            <span className="auth-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <div className="input-icon-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="farmer@agrismart.ai"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="input-icon-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard →'}
            </button>
          </form>
        ) : (
          /* Signup Form */
          <form className="auth-form" onSubmit={handleSignupSubmit}>
            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <div className="input-icon-wrapper">
                <span className="input-icon">👤</span>
                <input
                  id="signup-name"
                  type="text"
                  required
                  placeholder="Enter Your Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-email">Email Address</label>
              <div className="input-icon-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="Enter Your Email Address"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-password">Password (min. 6 chars)</label>
              <div className="input-icon-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter Your Password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-region">Region / Location</label>
              <div className="input-icon-wrapper">
                <span className="input-icon">📍</span>
                <select
                  id="signup-region"
                  className="auth-select"
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  required
                >
                  <option value="" disabled>Select Your Region / Location</option>
                  {REGIONS_LIST.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
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
