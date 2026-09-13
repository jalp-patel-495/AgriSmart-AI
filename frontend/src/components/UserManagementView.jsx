import React, { useState, useEffect } from 'react';
import { authApi } from '../services/authApi';

const ROLES = ['FARMER', 'AGRICULTURAL_EXPERT', 'ADMIN'];

export default function UserManagementView({ currentUser, onShowToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.getUsers(searchQuery, roleFilter);
      setUsers(res.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      await authApi.updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      if (onShowToast) onShowToast(`User role updated to ${newRole}`);
    } catch (err) {
      alert(`Error updating role: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusToggle = async (userId, currentActive) => {
    setUpdatingId(userId);
    const newStatus = !currentActive;
    try {
      await authApi.updateUserStatus(userId, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: newStatus } : u))
      );
      if (onShowToast) onShowToast(`User account ${newStatus ? 'activated' : 'deactivated'}`);
    } catch (err) {
      alert(`Error updating account status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="user-management-view" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25), rgba(15, 23, 42, 0.75))',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '16px',
        padding: '1.5rem 2rem',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2rem' }}>🛠️</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#eff6ff' }}>
              User Management & Access Control
            </h1>
            <span style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Admin Restricted
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem' }}>
            Manage registered accounts, assign cryptographic access tiers (Farmer, Agricultural Expert, Admin), and configure account status.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            color: '#bfdbfe',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>🔄</span> {loading ? 'Loading...' : 'Refresh Users'}
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: '1 1 300px' }}>
          <input
            type="text"
            placeholder="Search by user name, email, or farm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '0.65rem 1rem',
              color: '#f8fafc',
              fontSize: '0.92rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(16, 185, 129, 0.25)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#a7f3d0',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Filter Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '0.65rem 1rem',
              color: '#f8fafc',
              fontSize: '0.9rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">All Roles</option>
            <option value="FARMER">👨‍🌾 Farmer</option>
            <option value="AGRICULTURAL_EXPERT">👨‍🔬 Agricultural Expert</option>
            <option value="ADMIN">🛠️ Admin</option>
          </select>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          padding: '1.25rem',
          borderRadius: '12px',
          marginBottom: '2rem',
        }}>
          <strong>Access / Load Error:</strong> {error}
        </div>
      )}

      {/* Users Table */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(2, 44, 34, 0.5)', borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Farm & Location</th>
                <th style={thStyle}>Current Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Loading registered users...' : 'No users match the search criteria.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isUpdating = updatingId === u.id;

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
                        background: isCurrent ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                      }}
                    >
                      <td style={tdStyle}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>#{u.id}</span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                          {u.full_name} {isCurrent && <span style={{ fontSize: '0.75rem', color: '#60a5fa' }}>(You)</span>}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{u.email}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{u.farm_name || 'Family Farm'}</div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{u.farm_location || 'India'}</div>
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={u.role}
                          disabled={isUpdating}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          style={{
                            background: u.role === 'ADMIN'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : (u.role === 'AGRICULTURAL_EXPERT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                            border: `1px solid ${
                              u.role === 'ADMIN'
                                ? 'rgba(239, 68, 68, 0.4)'
                                : (u.role === 'AGRICULTURAL_EXPERT' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.4)')
                            }`,
                            color: u.role === 'ADMIN'
                              ? '#fca5a5'
                              : (u.role === 'AGRICULTURAL_EXPERT' ? '#93c5fd' : '#a7f3d0'),
                            borderRadius: '6px',
                            padding: '0.4rem 0.65rem',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: isUpdating ? 'wait' : 'pointer',
                          }}
                        >
                          <option value="FARMER" style={{ background: '#0f172a', color: '#fff' }}>👨‍🌾 FARMER</option>
                          <option value="AGRICULTURAL_EXPERT" style={{ background: '#0f172a', color: '#fff' }}>👨‍🔬 AGRICULTURAL_EXPERT</option>
                          <option value="ADMIN" style={{ background: '#0f172a', color: '#fff' }}>🛠️ ADMIN</option>
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: u.is_active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: u.is_active ? '#34d399' : '#f87171',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: u.is_active ? '#10b981' : '#ef4444',
                          }} />
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => handleStatusToggle(u.id, u.is_active)}
                          disabled={isCurrent || isUpdating}
                          title={isCurrent ? 'You cannot deactivate your own admin account' : 'Toggle active status'}
                          style={{
                            background: u.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            border: `1px solid ${u.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                            color: u.is_active ? '#fca5a5' : '#a7f3d0',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: (isCurrent || isUpdating) ? 'not-allowed' : 'pointer',
                            opacity: (isCurrent || isUpdating) ? 0.6 : 1,
                          }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  padding: '0.9rem 1.25rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle = {
  padding: '1rem 1.25rem',
  fontSize: '0.92rem',
  verticalAlign: 'middle',
};
