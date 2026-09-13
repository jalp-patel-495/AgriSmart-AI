import React, { useState, useEffect } from 'react';
import { authApi } from '../../services/authApi';
import FarmerDetailModal from './FarmerDetailModal';

export default function ConnectedFarmersView({ onFarmCountChange }) {
  const [subView, setSubView] = useState('active'); // 'active' | 'pending'
  const [farmers, setFarmers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Selected Farmer for Modal
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  // Action states for pending requests
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchActiveFarmers = async () => {
    try {
      const data = await authApi.getConnectedFarmers(search, cropFilter, riskFilter);
      const list = data.farmers || [];
      setFarmers(list);
      if (onFarmCountChange) {
        onFarmCountChange(data.total_count || list.length);
      }
    } catch (err) {
      console.error('Failed to fetch connected farmers:', err);
      setError(err.message || 'Unable to fetch connected farmers.');
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const data = await authApi.getPendingConnectionRequests();
      setPendingRequests(data.pending_requests || []);
    } catch (err) {
      console.error('Failed to fetch pending requests:', err);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchActiveFarmers(), fetchPendingRequests()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, [search, cropFilter, riskFilter]);

  const handleApprove = async (connectionId) => {
    setActionLoadingId(connectionId);
    try {
      await authApi.approveConnectionRequest(connectionId, 'Approved by stakeholder administrator.');
      setActionMessage({ type: 'success', text: 'Farmer connection approved! Telemetry is now federated.' });
      await refreshAll();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to approve request.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleReject = async (connectionId) => {
    setActionLoadingId(connectionId);
    try {
      await authApi.rejectConnectionRequest(connectionId, 'Declined by stakeholder organization.');
      setActionMessage({ type: 'info', text: 'Connection request declined.' });
      await refreshAll();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to decline request.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleFarmerDisconnected = (connectionId) => {
    setFarmers((prev) => prev.filter((f) => f.connection_id !== connectionId));
    refreshAll();
  };

  const getRiskStyle = (risk) => {
    switch ((risk || '').toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5' };
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#fdba74' };
      case 'MODERATE':
        return { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fde047' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7' };
    }
  };

  // Distinct crops present across all active farmers
  const uniqueCrops = Array.from(
    new Set(farmers.flatMap((f) => (f.monitored_crops || []).map((c) => c.trim())).filter(Boolean))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner & Tab Controls */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
              👨‍🌾 Farmer Ecosystem Directory
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Federated network telemetry. You can only view agricultural data from farmers who have connected with your organization.
            </p>
          </div>
        </div>

        {/* View Switcher: Active Farmers vs Pending Requests */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setSubView('active')}
            style={{
              background: subView === 'active' ? 'rgba(14, 165, 233, 0.3)' : 'rgba(30, 41, 59, 0.6)',
              border: subView === 'active' ? '1px solid rgba(56, 189, 248, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: subView === 'active' ? '#38bdf8' : '#cbd5e1',
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
            }}
          >
            <span>Connected Farmers</span>
            <span
              style={{
                background: subView === 'active' ? '#0ea5e9' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '0.75rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
              }}
            >
              {farmers.length}
            </span>
          </button>

          <button
            onClick={() => setSubView('pending')}
            style={{
              background: subView === 'pending' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(30, 41, 59, 0.6)',
              border: subView === 'pending' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: subView === 'pending' ? '#fbbf24' : '#cbd5e1',
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
            }}
          >
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '999px',
                }}
              >
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={refreshAll}
            title="Refresh farmer data"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '0.5rem 0.75rem',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Action Feedback Message */}
      {actionMessage && (
        <div
          style={{
            background:
              actionMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : actionMessage.type === 'error'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(14, 165, 233, 0.15)',
            border: `1px solid ${
              actionMessage.type === 'success'
                ? '#10b981'
                : actionMessage.type === 'error'
                ? '#ef4444'
                : '#38bdf8'
            }`,
            color:
              actionMessage.type === 'success'
                ? '#6ee7b7'
                : actionMessage.type === 'error'
                ? '#fca5a5'
                : '#7dd3fc',
            padding: '0.75rem 1.25rem',
            borderRadius: '10px',
            fontSize: '0.9rem',
          }}
        >
          {actionMessage.text}
        </div>
      )}

      {/* SUBVIEW 1: ACTIVE CONNECTED FARMERS */}
      {subView === 'active' && (
        <>
          {/* Filters & View Mode Bar */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              background: 'rgba(15, 23, 42, 0.4)',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search farmers by name, farm, email, or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.85rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Crop Filter */}
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Cultivated Crops</option>
              {uniqueCrops.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Risk Level Filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Risk Levels</option>
              <option value="CRITICAL">Critical Risk</option>
              <option value="HIGH">High Risk</option>
              <option value="MODERATE">Moderate Risk</option>
              <option value="LOW">Low Risk</option>
            </select>

            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(30, 41, 59, 0.7)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setViewMode('grid')}
                title="Grid Card View"
                style={{
                  background: viewMode === 'grid' ? 'rgba(14, 165, 233, 0.3)' : 'transparent',
                  border: 'none',
                  color: viewMode === 'grid' ? '#38bdf8' : '#94a3b8',
                  padding: '0.45rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🔲 Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Dense Table View"
                style={{
                  background: viewMode === 'table' ? 'rgba(14, 165, 233, 0.3)' : 'transparent',
                  border: 'none',
                  color: viewMode === 'table' ? '#38bdf8' : '#94a3b8',
                  padding: '0.45rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                📄 Table
              </button>
            </div>
          </div>

          {/* Body: Farmers List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔄</div>
              <div>Retrieving connected farmers directory...</div>
            </div>
          ) : error ? (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '1.25rem',
                borderRadius: '12px',
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          ) : farmers.length === 0 ? (
            /* ZERO FABRICATED DATA: HONEST EMPTY STATE */
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
                border: '1px dashed rgba(56, 189, 248, 0.3)',
                borderRadius: '16px',
                padding: '3rem 2rem',
                textAlign: 'center',
                color: '#94a3b8',
                maxWidth: '720px',
                margin: '1.5rem auto',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤝</div>
              <h4 style={{ color: '#f8fafc', fontSize: '1.25rem', margin: '0 0 0.5rem 0' }}>
                No Farmers Connected Yet
              </h4>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#cbd5e1', marginBottom: '1.25rem' }}>
                In AgriSmart AI, Agricultural Stakeholders observe real agricultural intelligence exclusively from verified farmer connections. There are currently no active farmer connections matching your criteria.
              </p>
              <div
                style={{
                  background: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  borderRadius: '12px',
                  padding: '1rem',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                  color: '#7dd3fc',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>💡 How to connect with farmers:</div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li>Farmers can discover your organization in their <strong>"Connected Organizations"</strong> tab and submit a connection request.</li>
                  <li>Check the <strong>"Pending Requests"</strong> tab above to approve inbound connection requests.</li>
                  <li>The demo environment seeds an active connection with <code>farmer@agrismart.ai</code> automatically upon login.</li>
                </ul>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {farmers.map((farmer) => {
                const riskStyle = getRiskStyle(farmer.risk_level);
                return (
                  <div
                    key={farmer.farmer_id}
                    style={{
                      background: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      transition: 'transform 0.2s ease, border-color 0.2s ease',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                            {farmer.farmer_name}
                          </h4>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                          🏡 {farmer.farm_name || 'Primary Farm'} • 📍 {farmer.location || 'Local Region'}
                        </div>
                      </div>

                      <span
                        style={{
                          background: riskStyle.bg,
                          border: `1px solid ${riskStyle.border}`,
                          color: riskStyle.text,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '999px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {farmer.risk_level || 'LOW'}
                      </span>
                    </div>

                    {/* Farm Attributes */}
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.5rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div>
                        <span style={{ color: '#94a3b8' }}>Acreage:</span>{' '}
                        <strong style={{ color: '#38bdf8' }}>
                          {farmer.farm_size_hectares ? `${farmer.farm_size_hectares} ha` : '0.0 ha'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Soil Type:</span>{' '}
                        <strong style={{ color: '#e2e8f0' }}>{farmer.soil_type || 'Clay Loam'}</strong>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#94a3b8' }}>Monitored Crops:</span>{' '}
                        <span style={{ color: '#34d399', fontWeight: 500 }}>
                          {(farmer.monitored_crops || []).join(', ') || 'General Crop'}
                        </span>
                      </div>
                    </div>

                    {/* Latest Telemetry Snippets */}
                    <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>Disease Health:</span>
                        <span style={{ color: farmer.disease_status === 'HEALTHY' ? '#34d399' : '#f87171', fontWeight: 600 }}>
                          {farmer.latest_diagnosis_disease ? `${farmer.latest_diagnosis_crop}: ${farmer.latest_diagnosis_disease}` : 'No Pathogen Detected'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>Soil Moisture:</span>
                        <span style={{ color: farmer.latest_soil_moisture && farmer.latest_soil_moisture < 30 ? '#f87171' : '#38bdf8', fontWeight: 600 }}>
                          {farmer.latest_soil_moisture ? `${farmer.latest_soil_moisture}%` : 'Sensor Unlinked'}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => setSelectedFarmer(farmer)}
                      style={{
                        marginTop: 'auto',
                        background: 'rgba(14, 165, 233, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        padding: '0.55rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        textAlign: 'center',
                      }}
                    >
                      Inspect Farm Profile & Telemetry →
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Farmer & Holding</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Location</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Monitored Crops</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Acreage</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Risk Status</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Latest Telemetry</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {farmers.map((farmer) => {
                    const riskStyle = getRiskStyle(farmer.risk_level);
                    return (
                      <tr key={farmer.farmer_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{farmer.farmer_name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{farmer.farm_name || farmer.email}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                          {farmer.location || '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#34d399' }}>
                          {(farmer.monitored_crops || []).join(', ') || '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#38bdf8' }}>
                          {farmer.farm_size_hectares ? `${farmer.farm_size_hectares} ha` : '0.0 ha'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span
                            style={{
                              background: riskStyle.bg,
                              border: `1px solid ${riskStyle.border}`,
                              color: riskStyle.text,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '999px',
                            }}
                          >
                            {farmer.risk_level || 'LOW'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                          {farmer.latest_diagnosis_disease ? (
                            <span>
                              🔬 {farmer.latest_diagnosis_crop}: {farmer.latest_diagnosis_disease}
                            </span>
                          ) : (
                            <span>💧 Moisture: {farmer.latest_soil_moisture ? `${farmer.latest_soil_moisture}%` : 'N/A'}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedFarmer(farmer)}
                            style={{
                              background: 'rgba(14, 165, 233, 0.2)',
                              border: '1px solid rgba(14, 165, 233, 0.5)',
                              color: '#38bdf8',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* SUBVIEW 2: PENDING CONNECTION REQUESTS */}
      {subView === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pendingRequests.length === 0 ? (
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '3rem',
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              <h4 style={{ color: '#f8fafc', margin: '0 0 0.25rem 0' }}>No Inbound Connection Requests</h4>
              <p style={{ fontSize: '0.88rem', margin: 0 }}>
                When farmers request to share telemetry with your organization, their requests will appear here for verification.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingRequests.map((req) => (
                <div
                  key={req.connection_id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>👨‍🌾</span>
                      <strong style={{ color: '#f8fafc', fontSize: '1.05rem' }}>{req.farmer_name}</strong>
                      <span
                        style={{
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#fbbf24',
                          border: '1px solid #f59e0b',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                        }}
                      >
                        Pending Review
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                      <span>🏡 {req.farm_name || 'Primary Farm'}</span>
                      <span style={{ margin: '0 0.5rem' }}>•</span>
                      <span>📍 {req.location || 'Location Not Specified'}</span>
                      <span style={{ margin: '0 0.5rem' }}>•</span>
                      <span>✉️ {req.email}</span>
                      {req.phone_number && (
                        <>
                          <span style={{ margin: '0 0.5rem' }}>•</span>
                          <span>📞 {req.phone_number}</span>
                        </>
                      )}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
                      <strong>Primary Crops:</strong> {req.preferred_crop || 'Unspecified'}
                    </div>

                    {req.notes && (
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.4)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          marginTop: '0.5rem',
                          fontSize: '0.82rem',
                          color: '#e2e8f0',
                          fontStyle: 'italic',
                        }}
                      >
                        "{req.notes}"
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleApprove(req.connection_id)}
                      disabled={actionLoadingId === req.connection_id}
                      style={{
                        background: '#059669',
                        border: 'none',
                        color: '#fff',
                        padding: '0.55rem 1.1rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: actionLoadingId === req.connection_id ? 'wait' : 'pointer',
                        boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                      }}
                    >
                      {actionLoadingId === req.connection_id ? 'Approving...' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(req.connection_id)}
                      disabled={actionLoadingId === req.connection_id}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        color: '#f87171',
                        padding: '0.55rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: actionLoadingId === req.connection_id ? 'wait' : 'pointer',
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FARMER DETAIL MODAL */}
      {selectedFarmer && (
        <FarmerDetailModal
          farmer={selectedFarmer}
          onClose={() => setSelectedFarmer(null)}
          onDisconnect={handleFarmerDisconnected}
        />
      )}
    </div>
  );
}
