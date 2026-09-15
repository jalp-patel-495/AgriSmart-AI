import React, { useState, useEffect, useMemo } from 'react';
import { roleApi } from '../../services/roleApi';

export default function ExpertTreatmentsView() {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedPathogenType, setSelectedPathogenType] = useState('');

  // Expand / Collapse state per card
  const [expandedCards, setExpandedCards] = useState({});

  // Modal state for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    crop_name: 'Tomato',
    name: '',
    pathogen: 'Fungal Pathogen',
    symptoms: '',
    treatment: '',
    prevention: '',
  });

  // Delete Confirmation Modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchTreatments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roleApi.getTreatments(selectedCrop);
      setTreatments(data || []);
    } catch (err) {
      console.error('Failed to load treatments:', err);
      setError('Unable to load treatment guidance catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreatments();
  }, [selectedCrop]);

  const toggleExpandCard = (id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      crop_name: 'Tomato',
      name: '',
      pathogen: 'Fungal Pathogen',
      symptoms: '',
      treatment: '',
      prevention: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormData({
      crop_name: item.crop_name || item.crop || 'Tomato',
      name: item.name || item.disease || '',
      pathogen: item.pathogen || 'Fungal Pathogen',
      symptoms: item.symptoms || '',
      treatment: item.treatment || '',
      prevention: item.prevention || '',
    });
    setModalOpen(true);
  };

  const handleTriggerDelete = (id) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await roleApi.deleteTreatment(deleteConfirmId);
      setTreatments((prev) => prev.filter((t) => t.id !== deleteConfirmId));
      setFeedback({ type: 'success', message: 'Treatment protocol removed.' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete treatment.' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.crop_name.trim() || !formData.treatment.trim()) {
      alert('Please fill out all required fields (Crop, Disease Name, and Treatment).');
      return;
    }

    try {
      if (isEditing) {
        await roleApi.updateTreatment(editingId, formData);
        setTreatments((prev) =>
          prev.map((t) => (t.id === editingId ? { ...t, ...formData, crop: formData.crop_name, disease: formData.name } : t))
        );
        setFeedback({ type: 'success', message: 'Treatment protocol updated.' });
      } else {
        const created = await roleApi.addTreatment(formData);
        setTreatments((prev) => [
          ...prev,
          {
            id: created.id || Date.now(),
            ...formData,
            crop: formData.crop_name,
            disease: formData.name,
          },
        ]);
        setFeedback({ type: 'success', message: 'New certified treatment protocol registered.' });
      }
      setModalOpen(false);
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save treatment.' });
    }
  };

  // Filter options
  const uniqueCrops = useMemo(() => Array.from(new Set(treatments.map((t) => t.crop_name || t.crop).filter(Boolean))).sort(), [treatments]);
  const uniqueDiseases = useMemo(() => Array.from(new Set(treatments.map((t) => t.name || t.disease).filter(Boolean))).sort(), [treatments]);
  const uniquePathogens = useMemo(() => Array.from(new Set(treatments.map((t) => t.pathogen).filter(Boolean))).sort(), [treatments]);

  // Filtered treatment list
  const filteredTreatments = useMemo(() => {
    return treatments.filter((t) => {
      const cropVal = t.crop_name || t.crop || '';
      const diseaseVal = t.name || t.disease || '';
      const pathogenVal = t.pathogen || '';
      const treatmentVal = t.treatment || '';
      const symptomsVal = t.symptoms || '';

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        cropVal.toLowerCase().includes(q) ||
        diseaseVal.toLowerCase().includes(q) ||
        treatmentVal.toLowerCase().includes(q) ||
        symptomsVal.toLowerCase().includes(q);

      const matchesCrop = !selectedCrop || cropVal.toLowerCase() === selectedCrop.toLowerCase();
      const matchesDisease = !selectedDisease || diseaseVal.toLowerCase() === selectedDisease.toLowerCase();
      const matchesPathogen = !selectedPathogenType || pathogenVal.toLowerCase() === selectedPathogenType.toLowerCase();

      return matchesSearch && matchesCrop && matchesDisease && matchesPathogen;
    });
  }, [treatments, searchQuery, selectedCrop, selectedDisease, selectedPathogenType]);

  return (
    <div className="role-page-container expert-treatments-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#818cf8' }}>Agronomic Protocols</span>
          <h1 className="page-main-title">💊 Treatment & Prevention Authoring Hub</h1>
          <p className="page-desc">
            Define and maintain officially certified disease remedies, biological controls, spray schedules, and farming recommendations.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#6366f1' }}
            onClick={handleOpenAdd}
          >
            ➕ Add Treatment Protocol
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

      {/* Filter and Search Bar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Input */}
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
              placeholder="Search symptoms, diseases or treatments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-text-input"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          {/* Crop Filter */}
          <select
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
            className="filter-select"
            aria-label="Filter by Crop"
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
            <option value="">All Supported Crops ({uniqueCrops.length})</option>
            {uniqueCrops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Disease Filter */}
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className="filter-select"
            aria-label="Filter by Disease"
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
            <option value="">All Diseases ({uniqueDiseases.length})</option>
            {uniqueDiseases.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Pathogen Type Filter */}
          <select
            value={selectedPathogenType}
            onChange={(e) => setSelectedPathogenType(e.target.value)}
            className="filter-select"
            aria-label="Filter by Pathogen Type"
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
            <option value="">All Pathogen Types</option>
            {uniquePathogens.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {(searchQuery || selectedCrop || selectedDisease || selectedPathogenType) && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => {
              setSearchQuery('');
              setSelectedCrop('');
              setSelectedDisease('');
              setSelectedPathogenType('');
            }}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Treatments Cards Grid with Proper Expandable Panels */}
      {loading ? (
        <div style={{ padding: '3.5rem 0', textAlign: 'center', color: '#94a3b8' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
          <span>Loading agronomic treatment catalog...</span>
        </div>
      ) : filteredTreatments.length === 0 ? (
        <div
          style={{
            padding: '4rem 1.5rem',
            textAlign: 'center',
            background: 'rgba(16, 28, 22, 0.6)',
            border: '1px dashed rgba(52, 211, 153, 0.25)',
            borderRadius: '16px',
            color: '#94a3b8',
          }}
        >
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.85rem' }}>💊</span>
          <strong style={{ color: '#e2e8f0', fontSize: '1.15rem', display: 'block', marginBottom: '0.35rem' }}>
            No treatment protocols found.
          </strong>
          <small style={{ color: '#64748b' }}>
            Try broadening your search keywords or click "Add Treatment Protocol" above.
          </small>
        </div>
      ) : (
        <div className="treatments-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {filteredTreatments.map((item) => {
            const isExpanded = expandedCards[item.id] ?? false;
            const cropName = item.crop_name || item.crop;
            const diseaseName = item.name || item.disease;

            return (
              <div
                key={item.id}
                className="treatment-detail-card"
                style={{
                  background: 'rgba(16, 28, 22, 0.8)',
                  border: '1px solid rgba(52, 211, 153, 0.2)',
                  borderRadius: '16px',
                  padding: '1.35rem',
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Card Top */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}
                  >
                    🌱 {cropName}
                  </span>
                  <span
                    style={{
                      background: 'rgba(248, 113, 113, 0.15)',
                      color: '#fca5a5',
                      border: '1px solid rgba(248, 113, 113, 0.3)',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    🦠 {item.pathogen || 'Foliar Pathogen'}
                  </span>
                </div>

                {/* Disease Name */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  {diseaseName}
                </h3>

                {/* Prescribed Remediation (Always visible preview) */}
                <div
                  style={{
                    background: 'rgba(6, 78, 59, 0.25)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                  }}
                >
                  <strong style={{ color: '#34d399', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>
                    💊 Prescribed Remediation
                  </strong>
                  <p
                    style={{
                      color: '#e2e8f0',
                      fontSize: '0.85rem',
                      margin: 0,
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: isExpanded ? 'unset' : '2',
                      WebkitBoxOrient: 'vertical',
                      overflow: isExpanded ? 'visible' : 'hidden',
                    }}
                  >
                    {item.treatment || 'Guidance not specified.'}
                  </p>
                </div>

                {/* Expandable Sections */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {item.symptoms && (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '10px',
                          padding: '0.85rem',
                        }}
                      >
                        <strong style={{ color: '#fbbf24', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>
                          ⚠️ Characteristic Symptoms
                        </strong>
                        <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, lineHeight: 1.45 }}>
                          {item.symptoms}
                        </p>
                      </div>
                    )}

                    {item.prevention && (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '10px',
                          padding: '0.85rem',
                        }}
                      >
                        <strong style={{ color: '#38bdf8', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>
                          🛡️ Preventive Action Plan
                        </strong>
                        <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, lineHeight: 1.45 }}>
                          {item.prevention}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Card Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <button
                    type="button"
                    onClick={() => toggleExpandCard(item.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#818cf8',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {isExpanded ? 'Show Less ▲' : 'View Full Protocol ▼'}
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerDelete(item.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        fontSize: '0.78rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Treatment Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: 'rgba(16, 28, 22, 0.95)',
              border: '1px solid rgba(52, 211, 153, 0.35)',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>
                {isEditing ? '✏️ Edit Treatment Protocol' : '➕ Author Treatment Protocol'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✖
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Host Crop *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.crop_name}
                    onChange={(e) => setFormData({ ...formData, crop_name: e.target.value })}
                    placeholder="e.g. Tomato"
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Disease / Pathology Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Early Blight (Alternaria)"
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Pathogen Type
                </label>
                <select
                  value={formData.pathogen}
                  onChange={(e) => setFormData({ ...formData, pathogen: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#fff',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="Fungal Pathogen">Fungal Pathogen</option>
                  <option value="Bacterial Pathogen">Bacterial Pathogen</option>
                  <option value="Viral Pathogen">Viral Pathogen</option>
                  <option value="Oomycete / Water Mold">Oomycete / Water Mold</option>
                  <option value="Nutrient Deficiency">Nutrient Deficiency</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Characteristic Symptoms
                </label>
                <textarea
                  rows={2}
                  value={formData.symptoms}
                  onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                  placeholder="Describe foliar spotting, discoloration, margin burns, or stem cankers..."
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Prescribed Remediation *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.treatment}
                  onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                  placeholder="Detail biological controls, organic bio-pesticides, sanitation measures, and spray intervals..."
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Preventive Action Plan
                </label>
                <textarea
                  rows={2}
                  value={formData.prevention}
                  onChange={(e) => setFormData({ ...formData, prevention: e.target.value })}
                  placeholder="Crop rotation, drip irrigation timing, mulch application, disease-resistant seeds..."
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary-outline"
                  onClick={() => setModalOpen(false)}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  style={{ background: '#6366f1', fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
                >
                  💾 Save Protocol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            style={{
              background: 'rgba(16, 28, 22, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 0.5rem 0' }}>
              Delete Treatment Protocol?
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', margin: '0 0 1.25rem 0', lineHeight: 1.45 }}>
              Are you sure you want to remove this certified agronomic guideline? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary-outline"
                onClick={() => setDeleteConfirmId(null)}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-action"
                style={{ background: '#ef4444', fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
                onClick={handleConfirmDelete}
              >
                Delete Protocol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
