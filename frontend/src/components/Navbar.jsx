import React from 'react';

export default function Navbar({
  activeTab,
  setActiveTab,
  backendStatus,
  currentUser,
  onOpenAuth,
  onLogout
}) {
  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand Logo & Name */}
        <div
          className="brand"
          onClick={() => setActiveTab(currentUser ? 'dashboard' : 'home')}
          role="button"
          tabIndex={0}
        >
          <div className="brand-icon-wrapper">
            <span className="brand-seedling">🌱</span>
          </div>
          <div className="brand-text-group">
            <span className="brand-name">AgriSmart <span className="brand-highlight">AI</span></span>
          </div>
        </div>

        {/* Navigation Links: rendered only when logged in */}
        {currentUser && (
          <nav className="nav-links">
            <button
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`nav-btn ${activeTab === 'diagnose' ? 'active' : ''}`}
              onClick={() => setActiveTab('diagnose')}
            >
              🌿 Disease Detector
            </button>
            <button
              className={`nav-btn ${activeTab === 'smart-farming' ? 'active' : ''}`}
              onClick={() => setActiveTab('smart-farming')}
            >
              💧 Smart Irrigation
            </button>
            <button
              className={`nav-btn ${activeTab === 'weather' ? 'active' : ''}`}
              onClick={() => setActiveTab('weather')}
            >
              🌦️ Weather
            </button>
            <button
              className={`nav-btn ${activeTab === 'assistant' ? 'active' : ''}`}
              onClick={() => setActiveTab('assistant')}
            >
              🤖 AI Co-Pilot
            </button>
          </nav>
        )}

        {/* Right Section: System Status & Auth / User Profile */}
        <div className="nav-right-actions">


          {/* User Auth or Profile */}
          {currentUser ? (
            <div className="user-profile-menu">
              <div className="user-avatar-pill" title={`${currentUser.email} (${currentUser.role})`}>
                <div className="user-avatar-circle">
                  {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="user-info-text">
                  <span className="user-name">{currentUser.full_name}</span>
                  <span className="user-farm">{currentUser.farm_name || 'Grower'}</span>
                </div>
              </div>

              <button
                className="nav-logout-btn"
                onClick={onLogout}
                title="Sign Out of your account"
              >
                Sign Out
              </button>
            </div>
          ) : (
            /* Guest State: Matches Reference Image (Clean "Sign In" button) */
            <div className="nav-auth-buttons">
              <button
                className="nav-signin-btn"
                onClick={() => onOpenAuth('login')}
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
