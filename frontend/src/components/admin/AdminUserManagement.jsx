import React, { useState, useEffect, useMemo } from 'react';
import { roleApi } from '../../services/roleApi';
import { authApi } from '../../services/authApi';

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'ACTIVE', 'INACTIVE'
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Current logged in admin
  const currentUser = authApi.getCurrentUser() || {};

  // Provision New User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'FARMER',
    organization_name: '',
    farm_name: '',
    farm_location: '',
  });

  // Change Role Modal State
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  // Deactivate Confirmation Modal State
  const [deactivateModalUser, setDeactivateModalUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await roleApi.getAdminUsers(searchQuery, roleFilter);
      setUsers(list || []);
    } catch (err) {
      console.error('Failed to load admin users:', err);
      setFeedback({ type: 'error', message: 'Unable to retrieve users.' });
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

  const handleClearFilters = () => {
    setSearchQuery('');
    setRoleFilter('');
    setStatusFilter('ALL');
    fetchUsers();
  };

  // Client-side filtering for status and search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.organization_name && u.organization_name.toLowerCase().includes(q)) ||
        (u.farm_name && u.farm_name.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.is_active) ||
        (statusFilter === 'INACTIVE' && !u.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [users, searchQuery, statusFilter]);

  // Activate / Deactivate logic
  const handleToggleStatus = async (user) => {
    if (user.id === currentUser.id && user.is_active) {
      alert('Admin users cannot deactivate their own active administrative access.');
      return;
    }

    // If currently active, require modal confirmation to deactivate
    if (user.is_active) {
      setDeactivateModalUser(user);
      return;
    }

    // Activating account
    try {
      await roleApi.updateUserStatus(user.id, true);
      setUsers(users.map((u) => (u.id === user.id ? { ...u, is_active: true } : u)));
      setFeedback({
        type: 'success',
        message: `User ${user.full_name} account has been activated.`,
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to activate user status.' });
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateModalUser) return;
    const user = deactivateModalUser;
    setDeactivateModalUser(null);

    try {
      await roleApi.updateUserStatus(user.id, false);
      setUsers(users.map((u) => (u.id === user.id ? { ...u, is_active: false } : u)));
      setFeedback({
        type: 'success',
        message: `User ${user.full_name} account has been deactivated.`,
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to deactivate user account.' });
    }
  };

  // Change Role logic
  const handleOpenRoleModal = (user) => {
    setRoleModalUser(user);
    setSelectedRole(user.role);
  };

  const handleSaveRole = async () => {
    if (!roleModalUser || !selectedRole) return;
    try {
      await roleApi.updateUserRole(roleModalUser.id, selectedRole);
      setUsers(users.map((u) => (u.id === roleModalUser.id ? { ...u, role: selectedRole } : u)));
      setFeedback({ type: 'success', message: `Role for ${roleModalUser.full_name} updated to ${selectedRole}.` });
      setRoleModalUser(null);
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user role.' });
    }
  };

  // Provision New User logic
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!newUser.full_name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      alert('Please provide Full Name, Email, and Password.');
      return;
    }

    setProvisionLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      await roleApi.createAdminUser({
        full_name: newUser.full_name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role,
        organization_name: newUser.organization_name.trim() || undefined,
        farm_name: newUser.farm_name.trim() || undefined,
      });

      setFeedback({ type: 'success', message: `User ${newUser.email} successfully provisioned with role ${newUser.role}.` });
      setShowAddModal(false);
      setNewUser({
        full_name: '',
        email: '',
        password: '',
        role: 'FARMER',
        organization_name: '',
        farm_name: '',
        farm_location: '',
      });
      fetchUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to provision user.' });
    } finally {
      setProvisionLoading(false);
    }
  };

  // Dynamic Role Description
  const getRoleDescription = (r) => {
    switch (r) {
      case 'FARMER':
        return 'Access crop diagnostics, smart irrigation schedules, and field weather intelligence.';
      case 'AGRICULTURAL_EXPERT':
        return 'Access disease review, farmer advisory, and agronomic workflows.';
      case 'AGRICULTURAL_STAKEHOLDER':
        return 'Access regional procurement analytics, crop trends, and compliance ledgers.';
      case 'ADMIN':
        return 'Manage platform users, catalogs, configuration, and audit records.';
      default:
        return 'Standard platform permissions.';
    }
  };

  return (
    <div className="role-page-container admin-users-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#f87171' }}>Access Control (RBAC)</span>
          <h1 className="page-main-title">👥 User Management & Provisioning</h1>
          <p className="page-desc">
            Manage AgriSmart AI accounts and role-based access.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#dc2626' }}
            onClick={() => setShowAddModal(true)}
          >
            ➕ Provision New User
          </button>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`role-feedback-banner ${feedback.type}`}
          style={{
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
            borderRadius: '12px',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Toolbar */}
      <div
        className="history-filter-toolbar"
        style={{
          background: 'rgba(16, 28, 22, 0.75)',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          borderRadius: '14px',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          <div
            className="search-input-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              minWidth: '220px',
            }}
          >
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by Role"
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <option value="">All Roles</option>
            <option value="FARMER">Farmer</option>
            <option value="AGRICULTURAL_EXPERT">Agricultural Expert</option>
            <option value="AGRICULTURAL_STAKEHOLDER">Stakeholder</option>
            <option value="ADMIN">Administrator</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by Status"
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Account Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </form>

        {(searchQuery || roleFilter || statusFilter !== 'ALL') && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={handleClearFilters}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Users Table */}
      <div
        className="panel-card"
        style={{
          background: 'rgba(16, 28, 22, 0.8)',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          borderRadius: '16px',
          padding: '1.25rem',
          backdropFilter: 'blur(12px)',
        }}
      >
        {loading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: '#94a3b8' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
            <span>Loading user accounts...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>👥</span>
            <strong style={{ color: '#e2e8f0', fontSize: '1.05rem', display: 'block', marginBottom: '0.25rem' }}>
              No Users Found
            </strong>
            <small style={{ color: '#64748b' }}>
              {searchQuery || roleFilter || statusFilter !== 'ALL'
                ? 'No user accounts match your active search filters.'
                : 'No users have been registered on the platform.'}
            </small>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="role-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 0, 0, 0.45)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>USER</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>ROLE</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>AFFILIATION</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>CREATED</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>LAST ACTIVITY</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const roleStr = (u.role || 'FARMER').toUpperCase();
                  let roleIcon = '👨‍🌾';
                  let roleLabel = 'Farmer';
                  let roleColor = '#34d399';
                  let roleBg = 'rgba(16, 185, 129, 0.15)';

                  if (roleStr === 'AGRICULTURAL_EXPERT') {
                    roleIcon = '🧑‍🔬';
                    roleLabel = 'Agricultural Expert';
                    roleColor = '#c084fc';
                    roleBg = 'rgba(168, 85, 247, 0.15)';
                  } else if (roleStr === 'AGRICULTURAL_STAKEHOLDER') {
                    roleIcon = '🌐';
                    roleLabel = 'Stakeholder';
                    roleColor = '#38bdf8';
                    roleBg = 'rgba(14, 165, 233, 0.15)';
                  } else if (roleStr === 'ADMIN') {
                    roleIcon = '⚙️';
                    roleLabel = 'Administrator';
                    roleColor = '#f87171';
                    roleBg = 'rgba(239, 68, 68, 0.15)';
                  }

                  const affiliation = u.organization_name || u.farm_name || 'Individual';
                  const isSelf = u.id === currentUser.id;

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: roleBg,
                              color: roleColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              border: `1px solid ${roleColor}33`,
                            }}
                          >
                            {u.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <strong style={{ color: '#fff', fontSize: '0.88rem', display: 'block' }}>
                              {u.full_name} {isSelf && <span style={{ fontSize: '0.72rem', color: '#f87171' }}>(You)</span>}
                            </strong>
                            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '0.85rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: roleBg,
                            color: roleColor,
                            border: `1px solid ${roleColor}33`,
                          }}
                        >
                          <span>{roleIcon}</span>
                          <span>{roleLabel}</span>
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem', color: '#cbd5e1', fontSize: '0.82rem' }}>
                        {affiliation}
                      </td>

                      <td style={{ padding: '0.85rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: u.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                            color: u.is_active ? '#34d399' : '#94a3b8',
                            border: u.is_active ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.3)',
                          }}
                        >
                          <span>{u.is_active ? '🟢' : '⚪'}</span>
                          <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                        {u.created_at || 'Recent'}
                      </td>

                      <td style={{ padding: '0.85rem', color: '#64748b', fontSize: '0.8rem' }}>
                        Verified Session
                      </td>

                      <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn-table-action"
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              borderColor: 'rgba(56, 189, 248, 0.35)',
                              color: '#38bdf8',
                              fontSize: '0.75rem',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleOpenRoleModal(u)}
                          >
                            Change Role
                          </button>

                          <button
                            type="button"
                            className="btn-table-action"
                            disabled={isSelf}
                            style={{
                              background: u.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              borderColor: u.is_active ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)',
                              color: u.is_active ? '#f87171' : '#34d399',
                              fontSize: '0.75rem',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              cursor: isSelf ? 'not-allowed' : 'pointer',
                              opacity: isSelf ? 0.4 : 1,
                            }}
                            onClick={() => handleToggleStatus(u)}
                            title={isSelf ? 'Cannot deactivate your own admin account' : undefined}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision New User Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: 'rgba(16, 28, 22, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  ➕ Provision New User
                </h3>
                <small style={{ color: '#94a3b8' }}>Create an authenticated account with assigned RBAC permissions</small>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Priya Nair"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.55rem 0.8rem',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. priya.nair@icar.gov.in"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.55rem 0.8rem',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Assigned Role *
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.55rem 0.8rem',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="FARMER">Farmer</option>
                    <option value="AGRICULTURAL_EXPERT">Agricultural Expert</option>
                    <option value="AGRICULTURAL_STAKEHOLDER">Stakeholder</option>
                    <option value="ADMIN">Administrator</option>
                  </select>

                  {/* Dynamic Role Description Callout */}
                  <div style={{ marginTop: '0.35rem', padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', fontSize: '0.75rem', color: '#a78bfa', borderLeft: '2px solid #a78bfa' }}>
                    💡 <strong>{newUser.role.replace('_', ' ')}:</strong> {getRoleDescription(newUser.role)}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Affiliation / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ICAR National Plant Pathology Division"
                    value={newUser.organization_name}
                    onChange={(e) => setNewUser({ ...newUser, organization_name: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.55rem 0.8rem',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.55rem 0.8rem',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={provisionLoading}
                  style={{ background: '#dc2626' }}
                >
                  {provisionLoading ? 'Provisioning...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {roleModalUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setRoleModalUser(null)}
        >
          <div
            style={{
              background: 'rgba(16, 28, 22, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '420px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: '0 0 0.5rem 0' }}>
              Modify Role: {roleModalUser.full_name}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Select the new access authorization tier for <code>{roleModalUser.email}</code>.
            </p>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.55rem 0.8rem',
                color: '#fff',
                fontSize: '0.88rem',
                marginBottom: '0.75rem',
                outline: 'none',
              }}
            >
              <option value="FARMER">👨‍🌾 Farmer</option>
              <option value="AGRICULTURAL_EXPERT">🧑‍🔬 Agricultural Expert</option>
              <option value="AGRICULTURAL_STAKEHOLDER">🌐 Stakeholder</option>
              <option value="ADMIN">⚙️ Administrator</option>
            </select>

            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', fontSize: '0.75rem', color: '#38bdf8', marginBottom: '1.25rem' }}>
              💡 {getRoleDescription(selectedRole)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary-outline"
                onClick={() => setRoleModalUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-action"
                style={{ background: '#0284c7' }}
                onClick={handleSaveRole}
              >
                Save Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateModalUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setDeactivateModalUser(null)}
        >
          <div
            style={{
              background: 'rgba(20, 10, 10, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>⚠️</span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171', margin: '0 0 0.5rem 0' }}>
              Deactivate Account?
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.45, marginBottom: '1.25rem' }}>
              Are you sure you want to deactivate this account? <strong>{deactivateModalUser.full_name}</strong> ({deactivateModalUser.email}) will immediately lose platform access.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary-outline"
                onClick={() => setDeactivateModalUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-action"
                style={{ background: '#dc2626' }}
                onClick={handleConfirmDeactivate}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
