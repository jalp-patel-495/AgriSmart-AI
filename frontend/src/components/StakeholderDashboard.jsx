import React, { useState, useEffect } from 'react';
import { authApi } from '../services/authApi';
import StakeholderOverview from './stakeholder/StakeholderOverview';
import ConnectedFarmersView from './stakeholder/ConnectedFarmersView';
import RiskAlertsCenter from './stakeholder/RiskAlertsCenter';
import RegionalIntelligenceView from './stakeholder/RegionalIntelligenceView';
import StakeholderCopilotView from './stakeholder/StakeholderCopilotView';

export default function StakeholderDashboard({ currentUser, onNavigateTab, activeView }) {
  // Navigation tab state: 'overview' | 'farmers' | 'risks' | 'regional' | 'copilot'
  const [currentTab, setCurrentTab] = useState('overview');

  // Filters
  const [timeWindow, setTimeWindow] = useState('30d');

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [connectedFarmersCount, setConnectedFarmersCount] = useState(0);

  // Sync with activeView passed from Navbar / parent
  useEffect(() => {
    if (activeView === 'stakeholder-risks') {
      setCurrentTab('risks');
    } else if (activeView === 'stakeholder-copilot') {
      setCurrentTab('copilot');
    } else if (activeView === 'regional-intelligence') {
      setCurrentTab('regional');
    } else if (activeView === 'stakeholder-farmers') {
      setCurrentTab('farmers');
    } else if (activeView === 'stakeholder-dashboard') {
      // Keep overview or current
    }
  }, [activeView]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.getStakeholderDashboard(undefined, undefined, timeWindow);
      setDashboardData(data);
      setLastRefreshed(new Date());
      if (data?.macro_kpis?.connected_farmers_count !== undefined) {
        setConnectedFarmersCount(data.macro_kpis.connected_farmers_count);
      }
    } catch (err) {
      console.error('Failed to fetch stakeholder dashboard:', err);
      setError(err.message || 'Unable to connect to Stakeholder Intelligence API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [timeWindow]);

  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    if (onNavigateTab) {
      if (tab === 'risks') onNavigateTab('stakeholder-risks');
      else if (tab === 'copilot') onNavigateTab('stakeholder-copilot');
      else if (tab === 'regional') onNavigateTab('regional-intelligence');
      else if (tab === 'farmers') onNavigateTab('stakeholder-farmers');
      else onNavigateTab('stakeholder-dashboard');
    }
  };

  return (
    <div className="stakeholder-dashboard" style={{ maxWidth: '1440px', margin: '0 auto', padding: '1rem 0' }}>
      {/* 1. Header & Role Identity */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(15, 23, 42, 0.85) 100%)',
          border: '1px solid rgba(14, 165, 233, 0.35)',
          borderRadius: '16px',
          padding: '1.75rem 2rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2.2rem' }}>🌐</span>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Agricultural Stakeholder Intelligence
            </h1>
            <span
              style={{
                background: 'rgba(14, 165, 233, 0.2)',
                border: '1px solid rgba(14, 165, 233, 0.45)',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.7rem',
                borderRadius: '999px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Decision Support Tier
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.9rem', color: '#94a3b8' }}>
            <span>🏢 <strong>Entity:</strong> <span style={{ color: '#e2e8f0' }}>{currentUser?.organization_name || 'Autonomous Agri Stakeholder'}</span></span>
            <span>🏷️ <strong>Type:</strong> <span style={{ color: '#bae6fd' }}>{currentUser?.stakeholder_type || 'Agri Enterprise'}</span></span>
            <span>📍 <strong>Coverage:</strong> <span style={{ color: '#a7f3d0' }}>{currentUser?.operating_regions || 'Pan-India'}</span></span>
            <span>🌱 <strong>Focus Crops:</strong> <span style={{ color: '#fde047' }}>{currentUser?.primary_crops || 'Multi-Crop'}</span></span>
          </div>
        </div>

        {/* Status Pills & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#34d399',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span>Data source: Connected farm records</span>
          </div>

          <button
            onClick={fetchDashboard}
            disabled={loading}
            style={{
              background: 'rgba(14, 165, 233, 0.2)',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              color: '#7dd3fc',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'background 0.2s',
            }}
          >
            <span>{loading ? 'Refreshing...' : '🔄 Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* 2. Stakeholder Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '0.75rem',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'overview', label: '📊 Overview & KPIs' },
          { id: 'farmers', label: `👨‍🌾 Connected Farmers (${connectedFarmersCount})` },
          { id: 'risks', label: '⚠️ Risk & Alerts Center' },
          { id: 'regional', label: '📍 Regional Intelligence' },
          { id: 'copilot', label: '🤖 Agri Intelligence Copilot' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              background: currentTab === tab.id ? 'rgba(14, 165, 233, 0.25)' : 'rgba(30, 41, 59, 0.4)',
              border: currentTab === tab.id ? '1px solid rgba(56, 189, 248, 0.6)' : '1px solid rgba(255, 255, 255, 0.06)',
              color: currentTab === tab.id ? '#38bdf8' : '#94a3b8',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Error Alert */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '1.25rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
          }}
        >
          <strong>Connection Notice:</strong> {error}
        </div>
      )}

      {/* 4. Active Tab Content */}
      {currentTab === 'overview' && (
        <StakeholderOverview
          dashboardData={dashboardData}
          onNavigateTab={handleTabChange}
          onRefresh={fetchDashboard}
          loading={loading}
        />
      )}

      {currentTab === 'farmers' && (
        <ConnectedFarmersView
          onFarmCountChange={(count) => setConnectedFarmersCount(count)}
        />
      )}

      {currentTab === 'risks' && (
        <RiskAlertsCenter initialAlerts={dashboardData?.recent_alerts || []} />
      )}

      {currentTab === 'regional' && (
        <RegionalIntelligenceView />
      )}

      {currentTab === 'copilot' && (
        <StakeholderCopilotView />
      )}
    </div>
  );
}
