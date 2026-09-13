import React, { useState, useEffect } from 'react';
import { authApi } from '../services/authApi';

export default function FarmerStakeholdersView({ currentUser, onShowToast }) {
  const [connections, setConnections] = useState([]);
  const [discoverable, setDiscoverable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Connection request modal state
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Disconnect confirmation state
  const [disconnectingId, setDisconnectingId] = useState(null);

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.getFarmerStakeholderConnections();
      setConnections(data.connections || []);
      setDiscoverable(data.discoverable_stakeholders || []);
    } catch (err) {
      console.error('Failed to load farmer connections:', err);
      setError(err.message || 'Unable to retrieve organization connections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleSendRequest = async (e) => {
    if (e) e.preventDefault();
    if (!requestTarget) return;

    setSubmittingRequest(true);
    try {
      await authApi.createFarmerStakeholderConnection(requestTarget.stakeholder_id, requestNotes);
      if (onShowToast) {
        onShowToast(`Connection request submitted to ${requestTarget.organization_name || requestTarget.name}!`);
      }
      setRequestTarget(null);
      setRequestNotes('');
      await fetchConnections();
    } catch (err) {
      alert(`Error submitting request: ${err.message}`);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleDisconnect = async (connectionId, orgName) => {
    try {
      await authApi.removeFarmerConnection(connectionId);
      if (onShowToast) {
        onShowToast(`Disconnected from ${orgName}. Telemetry sharing revoked.`);
      }
      setDisconnectingId(null);
      await fetchConnections();
    } catch (err) {
      alert(`Error disconnecting: ${err.message}`);
    }
  };

  const activeConnections = connections.filter((c) => (c.status || '').toUpperCase() === 'ACTIVE');
  const pendingConnections = connections.filter((c) => (c.status || '').toUpperCase() === 'PENDING');

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 0' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.85) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '2.2rem' }}>🏢</span>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Connected Agricultural Organizations
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.92rem', color: '#94a3b8', maxWidth: '800px' }}>
            Federate your farm telemetry with verified agribusinesses, cooperatives, research institutes, and insurance providers. You have complete sovereignty over your data and can revoke access anytime.
          </p>
        </div>

        <button
          onClick={fetchConnections}
          disabled={loading}
          style={{
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            color: '#6ee7b7',
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Status'}
        </button>
      </div>

      {/* 2. Privacy & Data Control Notice */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          fontSize: '0.85rem',
          color: '#cbd5e1',
        }}
      >
        <span style={{ fontSize: '1.3rem' }}>🔒</span>
        <div>
          <strong style={{ color: '#38bdf8' }}>Data Privacy Guarantee:</strong> Connected organizations can only observe your disease detection logs, soil moisture sensor history, and crop recommendations to provide targeted advisory and supply support. Your contact details remain confidential, and access can be severed immediately with a single click.
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {/* 3. Section: Active Connections */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>✅</span> Active Partnerships ({activeConnections.length})
        </h3>

        {activeConnections.length === 0 ? (
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.3)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '2.5rem',
              textAlign: 'center',
              color: '#94a3b8',
            }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🤝</div>
            <h4 style={{ color: '#f8fafc', margin: '0 0 0.25rem 0' }}>No Active Stakeholder Connections</h4>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>
              You are not currently sharing farm telemetry with any organizations. Browse discoverable stakeholders below to connect.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {activeConnections.map((conn) => (
              <div
                key={conn.connection_id}
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                      {conn.stakeholder_name}
                    </h4>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      🏢 {conn.organization_name || 'Agri Enterprise'} • 🏷️ {conn.organization_type || 'Stakeholder'}
                    </div>
                  </div>
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10b981',
                      color: '#6ee7b7',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '999px',
                    }}
                  >
                    ACTIVE
                  </span>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                  }}
                >
                  <div>
                    <span style={{ color: '#94a3b8' }}>Contact:</span>{' '}
                    <span style={{ color: '#e2e8f0' }}>{conn.email}</span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Operating Regions:</span>{' '}
                    <span style={{ color: '#bae6fd' }}>{conn.operating_regions || 'Pan-India'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Focus Crops:</span>{' '}
                    <span style={{ color: '#fde047' }}>{conn.primary_crops || 'Multi-Crop'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Connected since {conn.created_at ? new Date(conn.created_at).toLocaleDateString() : 'Active'}
                  </span>

                  {disconnectingId === conn.connection_id ? (
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        onClick={() => handleDisconnect(conn.connection_id, conn.organization_name || conn.stakeholder_name)}
                        style={{
                          background: '#dc2626',
                          border: 'none',
                          color: '#fff',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Confirm Revoke
                      </button>
                      <button
                        onClick={() => setDisconnectingId(null)}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#cbd5e1',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDisconnectingId(conn.connection_id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      Revoke Access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Section: Pending Requests Sent by Farmer */}
      {pendingConnections.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⏳</span> Awaiting Organization Approval ({pendingConnections.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {pendingConnections.map((conn) => (
              <div
                key={conn.connection_id}
                style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '12px',
                  padding: '1.1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                    {conn.organization_name || conn.stakeholder_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Request submitted • {conn.created_at ? new Date(conn.created_at).toLocaleDateString() : 'Recently'}
                  </div>
                </div>
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#fbbf24',
                    border: '1px solid #f59e0b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                  }}
                >
                  Pending Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Section: Discover Stakeholder Organizations */}
      <div>
        <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🌐</span> Discover Verified Stakeholder Organizations ({discoverable.length})
        </h3>

        {discoverable.length === 0 ? (
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.3)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '2.5rem',
              textAlign: 'center',
              color: '#94a3b8',
            }}
          >
            No other stakeholder organizations available for connection.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {discoverable.map((org) => {
              const isAlreadyConnected = connections.some(
                (c) => c.stakeholder_id === org.stakeholder_id && c.status === 'ACTIVE'
              );
              const isPending = connections.some(
                (c) => c.stakeholder_id === org.stakeholder_id && c.status === 'PENDING'
              );

              return (
                <div
                  key={org.stakeholder_id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                      {org.organization_name || org.name}
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                      🏷️ {org.organization_type || 'Agri Organization'}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div>
                      📍 Coverage: <span style={{ color: '#cbd5e1' }}>{org.operating_regions || 'Pan-India'}</span>
                    </div>
                    <div>
                      🌱 Focus Crops: <span style={{ color: '#cbd5e1' }}>{org.primary_crops || 'Multi-Crop'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setRequestTarget(org)}
                    disabled={isAlreadyConnected || isPending}
                    style={{
                      marginTop: 'auto',
                      background: isAlreadyConnected
                        ? 'rgba(16, 185, 129, 0.15)'
                        : isPending
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(14, 165, 233, 0.2)',
                      border: isAlreadyConnected
                        ? '1px solid rgba(16, 185, 129, 0.4)'
                        : isPending
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : '1px solid rgba(14, 165, 233, 0.5)',
                      color: isAlreadyConnected ? '#6ee7b7' : isPending ? '#fbbf24' : '#38bdf8',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: isAlreadyConnected || isPending ? 'default' : 'pointer',
                    }}
                  >
                    {isAlreadyConnected ? '✓ Connected' : isPending ? '⏳ Request Pending' : '+ Request Connection'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Request Connection Modal */}
      {requestTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setRequestTarget(null)}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              borderRadius: '16px',
              padding: '1.75rem',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#38bdf8' }}>
              Connect with {requestTarget.organization_name || requestTarget.name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
              This organization will receive your connection request along with your farm profile and crop focus.
            </p>

            <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>
                  Introduction / Farm Details (Optional):
                </label>
                <textarea
                  rows={3}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="E.g. We cultivate 12 hectares of potato and tomato. Seeking advisory and harvest support."
                  style={{
                    width: '100%',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setRequestTarget(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#cbd5e1',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  style={{
                    background: '#0ea5e9',
                    border: 'none',
                    color: '#fff',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: submittingRequest ? 'wait' : 'pointer',
                  }}
                >
                  {submittingRequest ? 'Submitting...' : 'Send Connection Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
