import React, { useState } from 'react';
import { authApi } from '../services/authApi';

const REGIONS_LIST = [
  'Gujarat, India',
  'Punjab, India',
  'Haryana, India',
  'Maharashtra, India',
  'Uttar Pradesh, India',
  'Madhya Pradesh, India',
  'Rajasthan, India',
  'Bihar, India',
  'West Bengal, India',
  'Andhra Pradesh, India',
  'Telangana, India',
  'Karnataka, India',
  'Tamil Nadu, India',
  'Kerala, India',
  'Odisha, India',
  'Assam, India',
  'Chhattisgarh, India',
  'Jharkhand, India',
  'Himachal Pradesh, India',
  'Uttarakhand, India',
  'Jammu & Kashmir, India',
  'Delhi / NCR, India',
  'Goa, India',
  'Other / Global Agricultural Region'
];

const CROPS_LIST = [
  'Wheat',
  'Tomato',
  'Potato',
  'Corn / Maize',
  'Rice / Paddy',
  'Cotton',
  'Soybean',
  'Apple',
  'Grape',
  'Sugarcane',
  'Chickpea',
  'Other Field Crop'
];

export default function EditProfileModal({ isOpen, onClose, currentUser, onProfileUpdated }) {
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [farmName, setFarmName] = useState(currentUser?.farm_name || 'Family Homestead Farm');
  const [farmLocation, setFarmLocation] = useState(currentUser?.farm_location || 'Gujarat, India');
  const [preferredCrop, setPreferredCrop] = useState(currentUser?.preferred_crop || 'Wheat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updatedUser = await authApi.updateProfile({
        email: currentUser.email,
        full_name: fullName.trim(),
        farm_name: farmName.trim() || 'Family Homestead Farm',
        farm_location: farmLocation,
        preferred_crop: preferredCrop,
      });

      onProfileUpdated(updatedUser);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge-icon">✏️</span>
            <div>
              <h3 className="modal-title">Edit Profile</h3>
              <p className="modal-subtitle">Update your personal farmer details and agricultural settings</p>
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
            <label className="form-label" htmlFor="edit-name">Full Name *</label>
            <input
              id="edit-name"
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-email">Email Address</label>
            <input
              id="edit-email"
              type="email"
              className="form-input form-input-disabled"
              value={currentUser.email}
              disabled
              title="Email cannot be changed"
            />
            <span className="form-help-text">Email address is linked to your account identity.</span>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label" htmlFor="edit-farm">Farm / Orchard Name</label>
              <input
                id="edit-farm"
                type="text"
                className="form-input"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="e.g. Family Homestead Farm"
              />
            </div>

            <div className="form-group flex-1">
              <label className="form-label" htmlFor="edit-crop">Primary Crop</label>
              <select
                id="edit-crop"
                className="form-select"
                value={preferredCrop}
                onChange={(e) => setPreferredCrop(e.target.value)}
              >
                {CROPS_LIST.map((crop) => (
                  <option key={crop} value={crop}>{crop}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-region">Agricultural Location / Region</label>
            <select
              id="edit-region"
              className="form-select"
              value={farmLocation}
              onChange={(e) => setFarmLocation(e.target.value)}
            >
              {REGIONS_LIST.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
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
              {loading ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
