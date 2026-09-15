import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authApi } from '../../services/authApi';

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
  'Other / Global Agricultural Region'
];

export default function LoginPage({ onAuthSuccess, initialMode = 'login' }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Mode state: 'login' or 'signup'
  const [mode, setMode] = useState(initialMode);

  // Sync mode if initialMode prop or path changes (e.g. navigating between /login and /signup)
  useEffect(() => {
    if (location.pathname === '/signup' || initialMode === 'signup') {
      setMode('signup');
    } else {
      setMode('login');
    }
    setError('');
  }, [location.pathname, initialMode]);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [signupRole, setSignupRole] = useState('FARMER');
  const [farmLocation, setFarmLocation] = useState('Punjab, India');
  const [organizationName, setOrganizationName] = useState('');
  const [stakeholderType, setStakeholderType] = useState('Farmer Producer Organization');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectByRole = (user) => {
    const role = (user?.role || 'FARMER').toUpperCase();
    const fromPath = location.state?.from?.pathname;

    // If there's a target path from state, check if authorized
    if (fromPath) {
      if (fromPath.startsWith('/farmer') && role === 'FARMER') return navigate(fromPath);
      if (fromPath.startsWith('/stakeholder') && (role === 'AGRICULTURAL_STAKEHOLDER' || role === 'ADMIN')) return navigate(fromPath);
      if (fromPath.startsWith('/expert') && (role === 'AGRICULTURAL_EXPERT' || role === 'ADMIN')) return navigate(fromPath);
      if (fromPath.startsWith('/admin') && role === 'ADMIN') return navigate(fromPath);
    }

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

  const handleStandardLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await authApi.login(email.trim(), password);
      if (onAuthSuccess) onAuthSuccess(user);
      redirectByRole(user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleStandardSignup = async (e) => {
    e.preventDefault();
    setError('');
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
        email: email.trim().toLowerCase(),
        password: password,
        farm_name: farmName,
        farm_location: farmLocation,
        preferred_crop: 'Tomato',
        role: signupRole,
        organization_name: signupRole === 'AGRICULTURAL_STAKEHOLDER' ? (organizationName.trim() || undefined) : undefined,
        stakeholder_type: signupRole === 'AGRICULTURAL_STAKEHOLDER' ? stakeholderType : undefined,
      });

      if (onAuthSuccess) onAuthSuccess(user);
      redirectByRole(user);
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-brand-icon">🌱</div>
          <h1 className="login-app-title">
            AgriSmart <span className="highlight-ai">AI</span>
          </h1>
          <p className="login-app-subtitle">
            Role-Based Agricultural Health & Disease Diagnostic Intelligence
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="login-mode-tabs" style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            type="button"
            className={`login-mode-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1,
              padding: '0.55rem 1rem',
              borderRadius: '7px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              background: mode === 'login' ? '#34d399' : 'transparent',
              color: mode === 'login' ? '#064e3b' : '#94a3b8',
              transition: 'all 0.2s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`login-mode-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); }}
            style={{
              flex: 1,
              padding: '0.55rem 1rem',
              borderRadius: '7px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              background: mode === 'signup' ? '#34d399' : 'transparent',
              color: mode === 'signup' ? '#064e3b' : '#94a3b8',
              transition: 'all 0.2s ease',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="login-error-banner">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {mode === 'signup' ? (
          /* Create New Account Form */
          <form onSubmit={handleStandardSignup} className="login-standard-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="login-input"
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                required
                placeholder="e.g. ramesh@farmmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
              />
            </div>

            <div className="form-group">
              <label>Password (min. 6 characters)</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
              />
            </div>

            <div className="form-group">
              <label>Select Platform Role</label>
              <select
                value={signupRole}
                onChange={(e) => setSignupRole(e.target.value)}
                className="login-input"
                style={{ background: '#0d1e16', color: '#e2e8f0' }}
              >
                <option value="FARMER">👨‍🌾 Farmer (Field Diagnostics & Irrigation)</option>
                <option value="AGRICULTURAL_STAKEHOLDER">🌐 Agricultural Stakeholder (Macro Analytics & Reports)</option>
                <option value="AGRICULTURAL_EXPERT">🧑‍🔬 Agricultural Expert (Clinical Pathology & Treatments)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Operating Region / Location</label>
              <select
                value={farmLocation}
                onChange={(e) => setFarmLocation(e.target.value)}
                className="login-input"
                style={{ background: '#0d1e16', color: '#e2e8f0' }}
              >
                {REGIONS_LIST.map((reg) => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
            </div>

            {signupRole === 'AGRICULTURAL_STAKEHOLDER' && (
              <>
                <div className="form-group">
                  <label>Organization Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bharat Agro Consortium"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="login-input"
                  />
                </div>
                <div className="form-group">
                  <label>Stakeholder Sector</label>
                  <select
                    value={stakeholderType}
                    onChange={(e) => setStakeholderType(e.target.value)}
                    className="login-input"
                    style={{ background: '#0d1e16', color: '#e2e8f0' }}
                  >
                    <option value="Farmer Producer Organization">Farmer Producer Organization</option>
                    <option value="Procurement / Buyer">Procurement / Buyer</option>
                    <option value="Govt Agri Department">Govt Agri Department</option>
                    <option value="Agri Input Company">Agri Input Company</option>
                    <option value="Research Institute">Research Institute</option>
                  </select>
                </div>
              </>
            )}

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? 'Creating Account...' : '✨ Create Free Account'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.88rem', color: '#94a3b8' }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#34d399', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Sign In
              </button>
            </div>
          </form>
        ) : (
          /* Standard Sign In Form */
          <>
            <form onSubmit={handleStandardLogin} className="login-standard-form">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. farmer@agrismart.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                />
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.88rem', color: '#94a3b8' }}>
              New to AgriSmart AI?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#34d399', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Create an Account
              </button>
            </div>
          </>
        )}

        {/* Footer Navigation */}
        <div className="login-footer-links">
          <Link to="/" className="back-to-home-link">
            ← Return to AgriSmart AI Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
