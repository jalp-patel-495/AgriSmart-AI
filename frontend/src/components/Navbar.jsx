import React, { useState, useEffect, useRef } from 'react';

export default function Navbar({
  activeTab,
  setActiveTab,
  backendStatus,
  currentUser,
  onOpenAuth,
  onLogout
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown or logout dialog on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (showLogoutConfirm) {
          setShowLogoutConfirm(false);
        } else {
          setIsDropdownOpen(false);
        }
      }
    };

    if (isDropdownOpen || showLogoutConfirm) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen, showLogoutConfirm]);

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
        {currentUser && (() => {
          const userRole = (currentUser.role || 'FARMER').toUpperCase();
          const isExpert = userRole === 'AGRICULTURAL_EXPERT' || userRole === 'ADMIN';
          const isAdmin = userRole === 'ADMIN';

          return (
            <nav className="nav-links" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
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
                Disease Detection
              </button>
              <button
                className={`nav-btn ${activeTab === 'smart-farming' ? 'active' : ''}`}
                onClick={() => setActiveTab('smart-farming')}
              >
                Smart Irrigation
              </button>
              <button
                className={`nav-btn ${activeTab === 'weather' ? 'active' : ''}`}
                onClick={() => setActiveTab('weather')}
              >
                Weather
              </button>
              <button
                className={`nav-btn ${activeTab === 'assistant' ? 'active' : ''}`}
                onClick={() => setActiveTab('assistant')}
              >
                Farmer Advisor
              </button>
              <button
                className={`nav-btn ${activeTab === 'agentic-advisor' ? 'active' : ''}`}
                onClick={() => setActiveTab('agentic-advisor')}
              >
                Agentic Advisor
              </button>

              {/* Expert Navigation Tier */}
              {isExpert && (
                <button
                  className={`nav-btn ${activeTab === 'expert-review' ? 'active' : ''}`}
                  onClick={() => setActiveTab('expert-review')}
                  style={{
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    background: activeTab === 'expert-review' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.12)',
                    color: '#93c5fd',
                  }}
                >
                  👨‍🔬 Expert Review
                </button>
              )}

              {/* Admin Navigation Tier */}
              {isAdmin && (
                <>
                  <button
                    className={`nav-btn ${activeTab === 'user-management' ? 'active' : ''}`}
                    onClick={() => setActiveTab('user-management')}
                    style={{
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      background: activeTab === 'user-management' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.12)',
                      color: '#fca5a5',
                    }}
                  >
                    🛠️ User Management
                  </button>
                  <button
                    className={`nav-btn ${activeTab === 'system-monitoring' ? 'active' : ''}`}
                    onClick={() => setActiveTab('system-monitoring')}
                    style={{
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      background: activeTab === 'system-monitoring' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.12)',
                      color: '#d8b4fe',
                    }}
                  >
                    🛠️ System Monitoring
                  </button>
                </>
              )}
            </nav>
          );
        })()}

        {/* Right Section: System Status & Auth / User Profile */}
        <div className="nav-right-actions">
          {currentUser ? (() => {
            const userRole = (currentUser.role || 'FARMER').toUpperCase();
            const roleBadge = userRole === 'ADMIN'
              ? '🛠️ Admin'
              : (userRole === 'AGRICULTURAL_EXPERT' ? '👨‍🔬 Agricultural Expert' : '👨‍🌾 Farmer');

            return (
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
                    <span className="user-farm" style={{ color: '#a7f3d0', fontWeight: 600, fontSize: '0.78rem' }}>
                      {roleBadge}
                    </span>
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
                          <span
                            className="dropdown-role-badge"
                            style={{
                              background: userRole === 'ADMIN'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : (userRole === 'AGRICULTURAL_EXPERT' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                              border: `1px solid ${
                                userRole === 'ADMIN'
                                  ? 'rgba(239, 68, 68, 0.4)'
                                  : (userRole === 'AGRICULTURAL_EXPERT' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.4)')
                              }`,
                              color: userRole === 'ADMIN'
                                ? '#fca5a5'
                                : (userRole === 'AGRICULTURAL_EXPERT' ? '#93c5fd' : '#a7f3d0'),
                              fontWeight: 700,
                            }}
                          >
                            {roleBadge}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="dropdown-divider" />

                    <div className="dropdown-actions-list">
                      <button
                        className="dropdown-item dropdown-logout-item"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setShowLogoutConfirm(true);
                        }}
                        id="dropdown-logout-btn"
                        role="menuitem"
                      >
                        <span className="dropdown-item-icon" aria-hidden="true">🚪</span>
                        <div className="dropdown-item-text">
                          <span className="dropdown-item-title">Sign Out</span>
                          <span className="dropdown-item-desc">Log out of your account</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
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

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="logout-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div
            className="logout-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="logout-modal-icon" aria-hidden="true">🚪</div>
            <h3 id="logout-dialog-title" className="logout-modal-title">
              Are you sure you want to sign out?
            </h3>
            <p className="logout-modal-desc">
              Your agricultural diagnostic records and farming data remain safely stored. You will return to the home screen.
            </p>
            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-modal-cancel-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-sign-out-btn"
                className="logout-modal-confirm-btn"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
