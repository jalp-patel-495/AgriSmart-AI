import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../../services/authApi';

/**
 * Reusable Profile View for all 4 roles: Farmer, Stakeholder, Expert, Admin.
 * Handles avatar upload & preview (<2MB validation), personal info updates,
 * account status, admin privileges card, change password modal, and logout.
 */
export default function ProfileView({ currentUser, onProfileUpdated, onLogout }) {
  const [user, setUser] = useState(currentUser || authApi.getCurrentUser() || {});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Form fields
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    farm_name: '',
    farm_location: '',
    organization_name: '',
  });

  // Photo state
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const fileInputRef = useRef(null);

  // Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Fetch latest profile on mount
  useEffect(() => {
    const fetchLatestProfile = async () => {
      try {
        const latest = await authApi.getMe();
        if (latest) {
          setUser(latest);
          setFormData({
            full_name: latest.full_name || '',
            phone_number: latest.phone_number || '',
            farm_name: latest.farm_name || '',
            farm_location: latest.farm_location || '',
            organization_name: latest.organization_name || latest.organization || '',
          });
          if (latest.profile_image) {
            setPhotoPreview(latest.profile_image);
          }
        }
      } catch (err) {
        console.warn('Could not fetch latest profile from backend:', err);
      }
    };
    fetchLatestProfile();
  }, []);

  // Sync initial user prop
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        farm_name: user.farm_name || '',
        farm_location: user.farm_location || '',
        organization_name: user.organization_name || user.organization || '',
      });
      if (user.profile_image && !photoPreview) {
        setPhotoPreview(user.profile_image);
      }
    }
  }, [user]);

  const userRole = (user.role || 'FARMER').toUpperCase();

  const roleConfigs = {
    FARMER: { badge: '👨‍🌾 Certified Farmer', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)' },
    AGRICULTURAL_STAKEHOLDER: { badge: '🌐 Agricultural Stakeholder', color: '#38bdf8', bg: 'rgba(14, 165, 233, 0.15)' },
    AGRICULTURAL_EXPERT: { badge: '🔬 Agricultural Expert', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.15)' },
    ADMIN: { badge: '🛠️ System Administrator', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' },
  };
  const currentRoleStyle = roleConfigs[userRole] || roleConfigs.FARMER;

  // Photo Selection & Validation
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFeedback({
        type: 'error',
        message: 'Invalid file format. Please upload JPG, PNG, or WebP image.',
      });
      return;
    }

    // Validate size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setFeedback({
        type: 'error',
        message: 'File size exceeds 2MB limit. Please upload an image under 2MB.',
      });
      return;
    }

    setSelectedPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
    setFeedback({ type: 'info', message: 'Photo selected. Click "Save Photo" to apply changes.' });
  };

  // Upload Selected Photo to Backend
  const handleUploadPhoto = async () => {
    if (!selectedPhotoFile) return;
    setPhotoUploading(true);
    setFeedback({ type: '', message: '' });
    try {
      const updatedUser = await authApi.uploadProfilePhoto(selectedPhotoFile);
      setUser(updatedUser);
      setSelectedPhotoFile(null);
      if (onProfileUpdated) onProfileUpdated(updatedUser);
      setFeedback({ type: 'success', message: 'Profile photo updated successfully!' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to upload photo.' });
    } finally {
      setPhotoUploading(false);
    }
  };

  // Remove Photo
  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    setFeedback({ type: '', message: '' });
    try {
      const updatedUser = await authApi.updateProfile({ profile_image: '' });
      setUser(updatedUser);
      setPhotoPreview(null);
      setSelectedPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onProfileUpdated) onProfileUpdated(updatedUser);
      setFeedback({ type: 'success', message: 'Profile photo removed.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove photo.' });
    } finally {
      setPhotoUploading(false);
    }
  };

  // Save Personal Info Changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const updatedUser = await authApi.updateProfile({
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        farm_name: formData.farm_name,
        farm_location: formData.farm_location,
        organization_name: formData.organization_name,
      });
      setUser(updatedUser);
      setIsEditing(false);
      if (onProfileUpdated) onProfileUpdated(updatedUser);
      setFeedback({ type: 'success', message: 'Profile details saved successfully!' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({
      full_name: user.full_name || '',
      phone_number: user.phone_number || '',
      farm_name: user.farm_name || '',
      farm_location: user.farm_location || '',
      organization_name: user.organization_name || '',
    });
    setFeedback({ type: '', message: '' });
  };

  // Handle Password Change
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        old_password: passwordData.oldPassword,
        new_password: passwordData.newPassword,
      });
      setPasswordSuccess('Password changed successfully!');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password. Verify your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const accountCreatedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Active Session Member';

  return (
    <div className="profile-page-container">
      {/* Page Header Banner */}
      <div className="profile-header-banner">
        <div className="profile-avatar-section">
          <div className="profile-avatar-frame">
            {photoPreview ? (
              <img src={photoPreview} alt="User Avatar" className="profile-avatar-large" />
            ) : (
              <div className="profile-avatar-placeholder" style={{ background: currentRoleStyle.bg, color: currentRoleStyle.color }}>
                {user.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <button
              type="button"
              className="photo-upload-badge-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload new profile picture"
            >
              📷
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
            />
          </div>

          <div className="profile-header-meta">
            <h1 className="profile-user-name">{user.full_name || 'Agri User'}</h1>
            <span className="profile-email-text">{user.email}</span>
            <div className="profile-role-pill" style={{ background: currentRoleStyle.bg, color: currentRoleStyle.color }}>
              {currentRoleStyle.badge}
            </div>
          </div>
        </div>

        {/* Photo Action Bar when a new photo is picked */}
        {selectedPhotoFile && (
          <div className="photo-actions-callout">
            <span className="photo-callout-text">📷 New image ready to upload: <strong>{selectedPhotoFile.name}</strong></span>
            <div className="photo-callout-btns">
              <button
                type="button"
                className="btn-save-photo"
                onClick={handleUploadPhoto}
                disabled={photoUploading}
              >
                {photoUploading ? 'Uploading...' : 'Save Photo'}
              </button>
              <button
                type="button"
                className="btn-cancel-photo"
                onClick={() => {
                  setSelectedPhotoFile(null);
                  setPhotoPreview(user.profile_image || null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {photoPreview && !selectedPhotoFile && (
          <button
            type="button"
            className="btn-remove-photo"
            onClick={handleRemovePhoto}
            disabled={photoUploading}
          >
            🗑️ Remove Picture
          </button>
        )}
      </div>

      {/* Dynamic Alert Messages */}
      {feedback.message && (
        <div className={`profile-feedback-alert ${feedback.type}`}>
          {feedback.type === 'success' && '✅ '}
          {feedback.type === 'error' && '❌ '}
          {feedback.type === 'info' && 'ℹ️ '}
          {feedback.message}
        </div>
      )}

      {/* Main Grid: Personal Info & Account Meta */}
      <div className="profile-content-grid">
        {/* Card 1: Personal Information Form */}
        <div className="profile-card">
          <div className="profile-card-header">
            <div>
              <h2 className="card-title">Personal Information</h2>
              <p className="card-subtitle">Manage your personal and contact details</p>
            </div>
            {!isEditing ? (
              <button
                type="button"
                className="btn-edit-toggle"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Profile
              </button>
            ) : (
              <button
                type="button"
                className="btn-cancel-toggle"
                onClick={handleCancelEdit}
              >
                ✖ Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="profile-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                disabled={!isEditing}
                required
                className="profile-input"
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="profile-input disabled-input"
                title="Email is verified and cannot be changed directly"
              />
              <span className="field-hint">🔒 Primary identifier verified during registration</span>
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                disabled={!isEditing}
                placeholder="+1 (555) 019-2834"
                className="profile-input"
              />
            </div>

            {userRole === 'AGRICULTURAL_STAKEHOLDER' || userRole === 'AGRICULTURAL_EXPERT' ? (
              <div className="form-group">
                <label>{userRole === 'AGRICULTURAL_EXPERT' ? 'Organization / Institution' : 'Organization / Entity'}</label>
                <input
                  type="text"
                  value={formData.organization_name}
                  onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                  disabled={!isEditing}
                  placeholder={userRole === 'AGRICULTURAL_EXPERT' ? 'e.g. ICAR Plant Pathology Division' : 'e.g. AgriCorp Grain & Seed Logistics'}
                  className="profile-input"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Farm Name</label>
                <input
                  type="text"
                  value={formData.farm_name}
                  onChange={(e) => setFormData({ ...formData, farm_name: e.target.value })}
                  disabled={!isEditing}
                  placeholder="e.g. Green Valley Homestead Farm"
                  className="profile-input"
                />
              </div>
            )}

            <div className="form-group">
              <label>Location / Agro-Climatic Zone</label>
              <input
                type="text"
                value={formData.farm_location}
                onChange={(e) => setFormData({ ...formData, farm_location: e.target.value })}
                disabled={!isEditing}
                placeholder="e.g. Central Valley, California, USA"
                className="profile-input"
              />
            </div>

            {isEditing && (
              <div className="form-action-row">
                <button
                  type="submit"
                  className="btn-save-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving Changes...' : '💾 Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn-cancel-secondary"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Card 2: Account Status & Security */}
        <div className="profile-card">
          <div className="profile-card-header">
            <div>
              <h2 className="card-title">Account Information</h2>
              <p className="card-subtitle">Security parameters and role authorizations</p>
            </div>
          </div>

          <div className="account-info-list">
            <div className="info-row">
              <span className="info-label">Assigned Role</span>
              <span className="info-value" style={{ color: currentRoleStyle.color, fontWeight: 700 }}>
                {userRole}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Account Status</span>
              <span className="info-status-pill active">
                <span className="status-dot"></span> Active & Verified
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Member Since</span>
              <span className="info-value">{accountCreatedDate}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Two-Factor Authentication</span>
              <span className="info-value text-muted">Secured via Token Session</span>
            </div>
          </div>

          {/* Admin-Specific Privilege Card */}
          {userRole === 'ADMIN' && (
            <div className="admin-privilege-card">
              <div className="admin-card-header">
                <span className="shield-icon">🛡️</span>
                <strong>System Administrator Privileges</strong>
              </div>
              <ul className="admin-privileges-list">
                <li>✔️ Full Role-Based Access Control (RBAC) Administration</li>
                <li>✔️ Add, Modify, Activate, and Deactivate User Accounts</li>
                <li>✔️ Manage PlantVillage AI Disease Models (38 Classes)</li>
                <li>✔️ Add and Edit Database Crop & Disease Master Catalog</li>
                <li>✔️ Access Global Platform Telemetry & Audit Logs</li>
              </ul>
            </div>
          )}

          {/* Expert-Specific Privilege Card */}
          {userRole === 'AGRICULTURAL_EXPERT' && (
            <div className="admin-privilege-card" style={{ borderColor: 'rgba(168, 85, 247, 0.35)', background: 'rgba(168, 85, 247, 0.08)' }}>
              <div className="admin-card-header">
                <span className="shield-icon">🔬</span>
                <strong style={{ color: '#c084fc' }}>Agricultural Expert Authorizations</strong>
              </div>
              <ul className="admin-privileges-list">
                <li>✔️ Field Diagnostic Review & AI Overrides</li>
                <li>✔️ Specimen Image Inspection & High-Res Micrograph Analysis</li>
                <li>✔️ Farmer Clinical Advisory Consultation & Direct Response</li>
                <li>✔️ Authoring & Management of Agronomic Treatment Protocols</li>
                <li>✔️ Pathogen Categorization & Evidence Verification</li>
              </ul>
            </div>
          )}

          {/* Security & Actions */}
          <div className="account-actions-box">
            <h3 className="section-small-title">Account Security Actions</h3>
            <div className="security-btns-row">
              <button
                type="button"
                className="btn-change-password"
                onClick={() => setShowPasswordModal(true)}
              >
                🔑 Change Password
              </button>
              <button
                type="button"
                className="btn-profile-logout"
                onClick={onLogout}
              >
                🚪 Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <h3>🔑 Change Password</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowPasswordModal(false)}
              >
                ✖
              </button>
            </div>

            {passwordError && <div className="modal-error-alert">⚠️ {passwordError}</div>}
            {passwordSuccess && <div className="modal-success-alert">✅ {passwordSuccess}</div>}

            <form onSubmit={handleChangePasswordSubmit} className="modal-form">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordData.oldPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                  placeholder="Enter current password"
                  className="profile-input"
                />
              </div>

              <div className="form-group">
                <label>New Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new strong password"
                  className="profile-input"
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Re-enter new password"
                  className="profile-input"
                />
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-cancel-secondary"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save-primary"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
