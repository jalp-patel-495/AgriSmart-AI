import React, { useState, useEffect, useRef } from 'react';

export default function Navbar({
  activeTab,
  setActiveTab,
  backendStatus,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenEditProfile,
  onOpenChangePassword
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

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
          {currentUser ? (
            <div className="user-profile-wrapper" ref={dropdownRef}>
              <button
                className={`user-avatar-pill ${isDropdownOpen ? 'active' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                id="user-profile-menu-button"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                title="Account & Profile Settings"
              >
                <div className="user-avatar-circle">
                  {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="user-info-text">
                  <span className="user-name">{currentUser.full_name}</span>
                  <span className="user-farm">{currentUser.farm_name || 'Family Homestead Farm'}</span>
                </div>
                <span className={`user-dropdown-arrow ${isDropdownOpen ? 'rotated' : ''}`}>▾</span>
              </button>

              {/* Interactive Profile Dropdown */}
              {isDropdownOpen && (
                <div className="user-dropdown-menu" role="menu">
                  <div className="dropdown-user-header">
                    <div className="dropdown-avatar-circle">
                      {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="dropdown-user-meta">
                      <div className="dropdown-name">{currentUser.full_name}</div>
                      <div className="dropdown-email">{currentUser.email}</div>
                      <div className="dropdown-badge-row">
                        <span className="dropdown-farm-badge">🌾 {currentUser.farm_name || 'Family Homestead Farm'}</span>
                        <span className="dropdown-role-badge">{currentUser.role?.toUpperCase() || 'FARMER'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <div className="dropdown-actions-list">
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenEditProfile();
                      }}
                      id="dropdown-edit-profile-btn"
                      role="menuitem"
                    >
                      <span className="dropdown-item-icon">✏️</span>
                      <div className="dropdown-item-text">
                        <span className="dropdown-item-title">Edit Profile</span>
                        <span className="dropdown-item-desc">Update farm name & region</span>
                      </div>
                    </button>

                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenChangePassword();
                      }}
                      id="dropdown-change-pwd-btn"
                      role="menuitem"
                    >
                      <span className="dropdown-item-icon">🔑</span>
                      <div className="dropdown-item-text">
                        <span className="dropdown-item-title">Change Password</span>
                        <span className="dropdown-item-desc">Update security credentials</span>
                      </div>
                    </button>

                    <div className="dropdown-divider" />

                    <button
                      className="dropdown-item dropdown-logout-item"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onLogout();
                      }}
                      id="dropdown-logout-btn"
                      role="menuitem"
                    >
                      <span className="dropdown-item-icon">🚪</span>
                      <div className="dropdown-item-text">
                        <span className="dropdown-item-title">Sign Out</span>
                        <span className="dropdown-item-desc">Log out of your account</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Guest State */
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
