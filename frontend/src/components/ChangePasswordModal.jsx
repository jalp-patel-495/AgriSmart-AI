import React, { useState } from 'react';
import { authApi } from '../services/authApi';

export default function ChangePasswordModal({ isOpen, onClose, currentUser, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password.');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(currentUser.email, currentPassword, newPassword);
      onPasswordChanged();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog change-password-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge-icon">🔑</span>
            <div>
              <h3 className="modal-title">Change Password</h3>
              <p className="modal-subtitle">Secure your AgriSmart AI farmer account</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="modal-error-alert" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label" htmlFor="current-pwd">Current Password *</label>
            <div className="password-input-wrapper">
              <input
                id="current-pwd"
                type={showCurrent ? 'text' : 'password'}
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                className="pwd-toggle-btn"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
              >
                {showCurrent ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-pwd">New Password *</label>
            <div className="password-input-wrapper">
              <input
                id="new-pwd"
                type={showNew ? 'text' : 'password'}
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
              <button
                type="button"
                className="pwd-toggle-btn"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
              >
                {showNew ? '👁️' : '🔒'}
              </button>
            </div>
            <span className="form-help-text">Use a strong password with letters and numbers.</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-pwd">Confirm New Password *</label>
            <input
              id="confirm-pwd"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
          </div>

          <div className="modal-footer-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save-profile"
              disabled={loading}
            >
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
