import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../../services/authApi';

/**
 * Enterprise-grade Role-Based Layout Component
 * Unifies Header, Collapsible Sidebar, Breadcrumbs, Notifications, and Responsive Mobile Drawer
 * across Farmer, Stakeholder, Expert, and Admin roles.
 */
export default function RoleLayout({ currentUser, onLogout, onRefreshUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const user = currentUser || authApi.getCurrentUser() || {};
  const userRole = (user.role || 'FARMER').toUpperCase();

  // Close dropdowns on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsProfileDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsProfileDropdownOpen(false);
        setShowNotifications(false);
        setMobileMenuOpen(false);
        setShowLogoutConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Role Badges and Theme Palettes
  const roleConfig = {
    FARMER: {
      badge: '👨‍🌾 Farmer',
      color: '#34d399',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.35)',
      rootPath: '/farmer',
      navItems: [
        { label: 'Dashboard', path: '/farmer/dashboard', icon: '📊' },
        { label: 'Crop Disease Detection', path: '/farmer/disease-detection', icon: '🔬', badge: 'AI' },
        { label: 'Smart Irrigation', path: '/farmer/irrigation', icon: '💧', badge: 'AI' },
        { label: 'My Crops', path: '/farmer/my-crops', icon: '🌱' },
        { label: 'Disease History', path: '/farmer/disease-history', icon: '📋' },
        { label: 'Treatments & Advice', path: '/farmer/treatments', icon: '💊' },
        { label: 'Weather Intelligence', path: '/farmer/weather', icon: '🌦️' },
        { label: 'My Profile', path: '/farmer/profile', icon: '👤' },
      ],
    },
    AGRICULTURAL_STAKEHOLDER: {
      badge: '🌐 Stakeholder',
      color: '#38bdf8',
      bg: 'rgba(14, 165, 233, 0.15)',
      border: 'rgba(14, 165, 233, 0.35)',
      rootPath: '/stakeholder',
      navItems: [
        { label: 'Dashboard', path: '/stakeholder/dashboard', icon: '📊' },
        { label: 'Agriculture Analytics', path: '/stakeholder/analytics', icon: '📈' },
        { label: 'Crop Statistics', path: '/stakeholder/crop-statistics', icon: '🌾' },
        { label: 'Disease Trends', path: '/stakeholder/disease-trends', icon: '⚠️' },
        { label: 'Reports', path: '/stakeholder/reports', icon: '📑' },
        { label: 'Activity', path: '/stakeholder/activity', icon: '⚡' },
        { label: 'Profile', path: '/stakeholder/profile', icon: '👤' },
      ],
    },
    AGRICULTURAL_EXPERT: {
      badge: '🔬 AGRICULTURAL EXPERT',
      color: '#c084fc',
      bg: 'rgba(168, 85, 247, 0.15)',
      border: 'rgba(168, 85, 247, 0.35)',
      rootPath: '/expert',
      navItems: [
        { label: 'Dashboard', path: '/expert/dashboard', icon: '📊' },
        { label: 'Disease Cases', path: '/expert/cases', icon: '🔬' },
        { label: 'Farmer Queries', path: '/expert/queries', icon: '💬' },
        { label: 'Diagnosis Review', path: '/expert/diagnosis-review', icon: '🧪' },
        { label: 'Treatment Guidelines', path: '/expert/treatments', icon: '💊' },
        { label: 'My Profile', path: '/expert/profile', icon: '👤' },
      ],
    },
    ADMIN: {
      badge: '⚙️ ADMIN',
      color: '#f87171',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.35)',
      rootPath: '/admin',
      navItems: [
        { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
        { label: 'User Management', path: '/admin/users', icon: '👥' },
        { label: 'Crop Catalog', path: '/admin/crops', icon: '🌱' },
        { label: 'Disease Catalog', path: '/admin/diseases', icon: '🦠' },
        { label: 'AI Model & Dataset', path: '/admin/ai-model', icon: '🧠' },
        { label: 'Audit Reports', path: '/admin/reports', icon: '📋' },
        { label: 'Activity Stream', path: '/admin/activity', icon: '⚡' },
        { label: 'Platform Configuration', path: '/admin/settings', icon: '⚙️' },
        { label: 'My Profile', path: '/admin/profile', icon: '👤' },
      ],
    },
  };

  const currentConfig = roleConfig[userRole] || roleConfig.FARMER;

  // Real-time notification mock stream
  const notifications = [
    { id: 1, text: 'PlantVillage 38-class diagnostic engine online (99.58% accuracy).', time: '10m ago', type: 'system' },
    { id: 2, text: 'Early warning: high humidity detected in regional sector.', time: '1h ago', type: 'weather' },
    { id: 3, text: 'New verified treatment protocol added for Tomato Early Blight.', time: '3h ago', type: 'protocol' },
  ];

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    if (onLogout) {
      onLogout();
    } else {
      authApi.logout();
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="role-layout-root">
      {/* Top Application Header */}
      <header className="role-top-header">
        <div className="role-header-left">
          {/* Mobile Hamburger Button */}
          <button
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Sidebar"
          >
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
          </button>

          {/* Brand Logo & Home Link */}
          <div
            className="role-brand-link"
            onClick={() => navigate(currentConfig.rootPath + '/dashboard')}
            role="button"
            tabIndex={0}
          >
            <div className="role-brand-icon">🌱</div>
            <div className="role-brand-info">
              <span className="role-brand-title">
                AgriSmart <span className="highlight-ai">AI</span>
              </span>
              <span className="role-portal-badge" style={{ color: currentConfig.color }}>
                {currentConfig.badge}
              </span>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="role-header-right">
          {/* Notifications Flyout */}
          <div className="header-action-wrapper" ref={notifRef}>
            <button
              className={`header-icon-btn ${showNotifications ? 'active' : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
              title="System Notifications"
              aria-label="Notifications"
            >
              <span className="icon-emoji">🔔</span>
              <span className="notif-indicator-dot"></span>
            </button>

            {showNotifications && (
              <div className="header-notifications-dropdown">
                <div className="notif-dropdown-header">
                  <h4>Notifications</h4>
                  <span className="notif-count-pill">{notifications.length} New</span>
                </div>
                <div className="notif-list">
                  {notifications.map((n) => (
                    <div key={n.id} className="notif-item">
                      <div className="notif-dot"></div>
                      <div className="notif-content">
                        <p className="notif-msg">{n.text}</p>
                        <span className="notif-time">{n.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="notif-footer">
                  <span>System status: 🟢 All services operational</span>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar & Profile Dropdown */}
          <div className="header-action-wrapper" ref={dropdownRef}>
            <button
              className={`role-user-pill ${isProfileDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              aria-label="User Account Menu"
              aria-expanded={isProfileDropdownOpen}
            >
              <div className="user-avatar-circle" style={{ background: currentConfig.bg, borderColor: currentConfig.border }}>
                {user.profile_image ? (
                  <img src={user.profile_image} alt={user.full_name} className="avatar-img-round" />
                ) : (
                  user.full_name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="user-pill-text">
                <span className="user-pill-name">{user.full_name || 'Agri User'}</span>
                <span className="user-pill-role" style={{ color: currentConfig.color }}>
                  {user.organization || user.organization_name || user.farm_name || userRole}
                </span>
              </div>
              <span className={`dropdown-chevron ${isProfileDropdownOpen ? 'open' : ''}`}>▾</span>
            </button>

            {isProfileDropdownOpen && (
              <div className="role-profile-dropdown">
                <div className="dropdown-meta-card">
                  <div className="user-avatar-circle large" style={{ background: currentConfig.bg, borderColor: currentConfig.border }}>
                    {user.profile_image ? (
                      <img src={user.profile_image} alt={user.full_name} className="avatar-img-round" />
                    ) : (
                      user.full_name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="dropdown-meta-details">
                    <strong className="user-full-name">{user.full_name}</strong>
                    <span className="user-email-text">{user.email}</span>
                    <span
                      className="user-role-tag"
                      style={{ background: currentConfig.bg, color: currentConfig.color, border: `1px solid ${currentConfig.border}` }}
                    >
                      {currentConfig.badge}
                    </span>
                  </div>
                </div>

                <div className="dropdown-separator"></div>

                <div className="dropdown-links-list">
                  <button
                    className="dropdown-nav-action"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      navigate(`${currentConfig.rootPath}/profile`);
                    }}
                  >
                    <span className="link-icon">👤</span>
                    <div className="link-text">
                      <strong>My Profile</strong>
                      <small>Personal info, avatar & security</small>
                    </div>
                  </button>

                  <button
                    className="dropdown-nav-action"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      navigate(`${currentConfig.rootPath}/dashboard`);
                    }}
                  >
                    <span className="link-icon">📊</span>
                    <div className="link-text">
                      <strong>Role Dashboard</strong>
                      <small>Home workspace</small>
                    </div>
                  </button>

                  <div className="dropdown-separator"></div>

                  <button
                    className="dropdown-nav-action logout-action"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                  >
                    <span className="link-icon">🚪</span>
                    <div className="link-text">
                      <strong style={{ color: '#f87171' }}>Sign Out</strong>
                      <small>End current session</small>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="role-body-container">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div className="mobile-sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* Collapsible Sidebar */}
        <aside className={`role-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-header-row">
            {!sidebarCollapsed && (
              <div className="sidebar-role-badge-box" style={{ background: currentConfig.bg, borderColor: currentConfig.border }}>
                <span className="sidebar-role-indicator">●</span>
                <span className="sidebar-role-title" style={{ color: currentConfig.color }}>
                  {currentConfig.badge}
                </span>
              </div>
            )}
            <button
              className="sidebar-collapse-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? '⏩' : '◀'}
            </button>
          </div>

          <nav className="sidebar-nav-list">
            {currentConfig.navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        borderLeftColor: currentConfig.color,
                        background: currentConfig.bg,
                        color: currentConfig.color,
                      }
                    : {}
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="nav-item-icon">{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className="nav-item-label">{item.label}</span>
                )}
                {!sidebarCollapsed && item.badge && (
                  <span
                    className="nav-item-badge"
                    style={{ background: currentConfig.bg, color: currentConfig.color, borderColor: currentConfig.border }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}

            <div className="sidebar-separator"></div>

            {/* Quick Logout Button in Sidebar */}
            <button
              className="sidebar-nav-item logout-item"
              onClick={() => setShowLogoutConfirm(true)}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <span className="nav-item-icon">🚪</span>
              {!sidebarCollapsed && <span className="nav-item-label">Sign Out</span>}
            </button>
          </nav>

          {/* Sidebar System Telemetry Footer */}
          {!sidebarCollapsed && (
            <div className="sidebar-footer-card">
              <div className="system-health-pill">
                <span className="pulse-dot"></span>
                <span>AI Engine Online</span>
              </div>
              <span className="system-version-tag">AgriSmart v2.4 • SIH 2026</span>
            </div>
          )}
        </aside>

        {/* Main Routed Page Content */}
        <main className={`role-main-content ${sidebarCollapsed ? 'expanded-main' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* Universal Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="logout-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="logout-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-icon">🚪</div>
            <h3 className="logout-modal-title">Sign Out of AgriSmart AI?</h3>
            <p className="logout-modal-desc">
              Your agricultural scan history, recommendations, and analytics will remain securely saved.
              You will be redirected to the sign-in portal.
            </p>
            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-modal-cancel-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Stay Logged In
              </button>
              <button
                type="button"
                id="role-logout-confirm-btn"
                className="logout-modal-confirm-btn"
                onClick={handleConfirmLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
