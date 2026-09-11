import React from 'react';

export default function Navbar({ activeTab, setActiveTab, backendStatus }) {
  return (
    <nav className="navbar">
      <div className="brand">
        <div className="brand-icon">🌱</div>
        <span>AgriSmart AI</span>
      </div>

      <div className="nav-links">
        <button
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Farmer Dashboard
        </button>
        <button
          className={`nav-btn ${activeTab === 'diagnose' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnose')}
        >
          Disease Detector
        </button>
        <button
          className={`nav-btn ${activeTab === 'weather' ? 'active' : ''}`}
          onClick={() => setActiveTab('weather')}
        >
          🌦️ Weather Intelligence
        </button>
        <button
          className={`nav-btn ${activeTab === 'smart-farming' ? 'active' : ''}`}
          onClick={() => setActiveTab('smart-farming')}
        >
          💧 Smart Farming
        </button>
        <button
          className={`nav-btn ${activeTab === 'dataset' ? 'active' : ''}`}
          onClick={() => setActiveTab('dataset')}
        >
          Dataset Insights
        </button>
      </div>

      <div className="system-status-pill">
        <span className="status-dot" />
        <span>{backendStatus === 'online' ? 'API Online' : 'Phase 1 Ready'}</span>
      </div>
    </nav>
  );
}
