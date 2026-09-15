import React, { useState, useEffect, useMemo } from 'react';
import { roleApi } from '../../services/roleApi';

export default function AdminDiseaseManagement() {
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cropFilter, setCropFilter] = useState('');
  const [pathogenFilter, setPathogenFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Modal State
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

  const fetchDiseases = async () => {
    setLoading(true);
    try {
      const list = await roleApi.getDiseases(cropFilter, searchQuery);
      setDiseases(list || []);
    } catch (err) {
      console.error('Failed to load diseases:', err);
      setFeedback({ type: 'error', message: 'Unable to retrieve diseases catalog.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiseases();
  }, [cropFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setCropFilter('');
    setPathogenFilter('');
    fetchDiseases();
  };

  // Unique crops for filter
  const uniqueCrops = useMemo(() => {
    return Array.from(new Set(diseases.map((d) => d.crop_name || d.crop).filter(Boolean))).sort();
  }, [diseases]);

  // Filtered diseases
  const filteredDiseases = useMemo(() => {
    return diseases.filter((d) => {
      const q = searchQuery.toLowerCase();
      const cropVal = d.crop_name || d.crop || '';
      const diseaseVal = d.name || d.disease || '';
      const pathogenVal = d.pathogen || '';

      const matchesSearch =
        !searchQuery ||
        cropVal.toLowerCase().includes(q) ||
        diseaseVal.toLowerCase().includes(q) ||
        pathogenVal.toLowerCase().includes(q) ||
        (d.symptoms && d.symptoms.toLowerCase().includes(q));

      const matchesCrop = !cropFilter || cropVal.toLowerCase() === cropFilter.toLowerCase();

      let matchesPathogen = true;
      if (pathogenFilter === 'FUNGAL') {
        matchesPathogen = pathogenVal.toLowerCase().includes('fung');
      } else if (pathogenFilter === 'BACTERIAL') {
        matchesPathogen = pathogenVal.toLowerCase().includes('bacteri');
      } else if (pathogenFilter === 'VIRAL') {
        matchesPathogen = pathogenVal.toLowerCase().includes('vir');
      } else if (pathogenFilter === 'UNKNOWN') {
        matchesPathogen = !pathogenVal || pathogenVal.toLowerCase().includes('unknown') || pathogenVal.toLowerCase().includes('unspecified');
      }

      return matchesSearch && matchesCrop && matchesPathogen;
    });
  }, [diseases, searchQuery, cropFilter, pathogenFilter]);

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

  const handleOpenEdit = (d) => {
    setIsEditing(true);
    setEditingId(d.id);
    setFormData({
      crop_name: d.crop_name || d.crop || 'Tomato',
      name: d.name || d.disease || '',
      pathogen: d.pathogen || 'Unknown / Unspecified',
      symptoms: d.symptoms || '',
      treatment: d.treatment || '',
      prevention: d.prevention || '',
    });
    setModalOpen(true);
  };

  const handleDeleteDisease = async (d) => {
    const dName = d.name || d.disease;
    if (!window.confirm(`Delete ${dName} from master disease catalog?`)) return;
    try {
      await roleApi.deleteDisease(d.id);
      setDiseases(diseases.filter((item) => item.id !== d.id));
      setFeedback({ type: 'success', message: `Pathology ${dName} removed from catalog.` });
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete disease.' });
    }
  };

  const handleSaveDisease = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.crop_name.trim()) {
      alert('Host Crop and Disease Name are required.');
      return;
    }

    try {
      if (isEditing) {
        await roleApi.updateDisease(editingId, {
          crop_name: formData.crop_name.trim(),
          name: formData.name.trim(),
          pathogen: formData.pathogen.trim() || undefined,
          symptoms: formData.symptoms.trim() || undefined,
          treatment: formData.treatment.trim() || undefined,
          prevention: formData.prevention.trim() || undefined,
        });

        setDiseases(
          diseases.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  ...formData,
                  crop: formData.crop_name,
                  disease: formData.name,
                }
              : item
          )
        );
        setFeedback({ type: 'success', message: `Disease ${formData.name} updated successfully.` });
      } else {
        const res = await roleApi.addDisease({
          crop_name: formData.crop_name.trim(),
          name: formData.name.trim(),
          pathogen: formData.pathogen.trim() || undefined,
          symptoms: formData.symptoms.trim() || undefined,
          treatment: formData.treatment.trim() || undefined,
          prevention: formData.prevention.trim() || undefined,
        });

        setDiseases([
          ...diseases,
          {
            id: res.id || Date.now(),
            ...formData,
            crop: formData.crop_name,
            disease: formData.name,
          },
        ]);
        setFeedback({ type: 'success', message: `New pathology ${formData.name} registered.` });
      }
      setModalOpen(false);
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save disease.' });
    }
  };

  return (
    <div className="role-page-container admin-diseases-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#f87171' }}>Plant Pathology Master Registry</span>
          <h1 className="page-main-title">🦠 Disease & Pathogen Catalog</h1>
          <p className="page-desc">
            Maintain supported disease classes, pathogen classifications, symptoms, remediation guidance and prevention metadata.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#dc2626' }}
            onClick={handleOpenAdd}
          >
            ➕ Register Disease
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
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
              placeholder="Search disease or pathogen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
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
            <option value="">All Crops</option>
            {uniqueCrops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={pathogenFilter}
            onChange={(e) => setPathogenFilter(e.target.value)}
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
            <option value="FUNGAL">🦠 Fungal Pathogens</option>
            <option value="BACTERIAL">🧫 Bacterial Pathogens</option>
            <option value="VIRAL">🧬 Viral Pathogens</option>
            <option value="UNKNOWN">❓ Unknown / Unspecified</option>
          </select>
        </div>

        {(searchQuery || cropFilter || pathogenFilter) && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={handleClearFilters}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table Panel */}
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
            <span>Loading plant pathology catalog...</span>
          </div>
        ) : filteredDiseases.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🦠</span>
            <strong style={{ color: '#e2e8f0', fontSize: '1.05rem', display: 'block', marginBottom: '0.25rem' }}>
              No Pathology Records Found
            </strong>
            <small style={{ color: '#64748b' }}>
              {searchQuery || cropFilter || pathogenFilter
                ? 'No disease classes match your active search filters.'
                : 'No disease items have been recorded in the catalog.'}
            </small>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="role-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 0, 0, 0.45)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Host Crop</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Disease</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Pathogen</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Symptoms</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiseases.map((d) => {
                  const pathogenStr = (d.pathogen || '').toLowerCase();
                  let pIcon = '❓';
                  let pLabel = d.pathogen || 'Unknown / Unspecified';
                  let pColor = '#94a3b8';
                  let pBg = 'rgba(148, 163, 184, 0.15)';

                  if (pathogenStr.includes('fung')) {
                    pIcon = '🦠';
                    pLabel = 'Fungal';
                    pColor = '#fbbf24';
                    pBg = 'rgba(251, 191, 36, 0.15)';
                  } else if (pathogenStr.includes('bacteri')) {
                    pIcon = '🧫';
                    pLabel = 'Bacterial';
                    pColor = '#f87171';
                    pBg = 'rgba(239, 68, 68, 0.15)';
                  } else if (pathogenStr.includes('vir')) {
                    pIcon = '🧬';
                    pLabel = 'Viral';
                    pColor = '#c084fc';
                    pBg = 'rgba(168, 85, 247, 0.15)';
                  }

                  const isHealthy = (d.name || d.disease || '').toLowerCase().includes('healthy');

                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '0.85rem' }}>
                        <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>🌾</span> {d.crop_name || d.crop}
                        </strong>
                      </td>

                      <td style={{ padding: '0.85rem' }}>
                        <strong style={{ color: isHealthy ? '#34d399' : '#f8fafc', fontSize: '0.88rem' }}>
                          {d.name || d.disease}
                        </strong>
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
                            background: pBg,
                            color: pColor,
                            border: `1px solid ${pColor}33`,
                          }}
                        >
                          <span>{pIcon}</span>
                          <span>{pLabel}</span>
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem', color: '#cbd5e1', maxWidth: '280px' }}>
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontSize: '0.82rem',
                            lineHeight: 1.4,
                          }}
                          title={d.symptoms}
                        >
                          {d.symptoms || 'Foliar diagnostic indicators cataloged'}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: d.expert_reviewed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: d.expert_reviewed ? '#34d399' : '#38bdf8',
                            border: d.expert_reviewed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                          }}
                        >
                          {d.expert_reviewed ? 'Verified' : 'Production Class'}
                        </span>
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
                              fontSize: '0.78rem',
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleOpenEdit(d)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn-table-action"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              borderColor: 'rgba(239, 68, 68, 0.35)',
                              color: '#f87171',
                              fontSize: '0.78rem',
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleDeleteDisease(d)}
                          >
                            Delete
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

      {/* Edit / Add Disease Modal */}
      {modalOpen && (
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
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: 'rgba(16, 28, 22, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {isEditing ? `✏️ Edit Pathology: ${formData.name}` : '🦠 Register New Disease Class'}
                </h3>
                <small style={{ color: '#94a3b8' }}>Maintain microbiological classification and treatment metadata</small>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDisease}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Host Crop *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tomato"
                    value={formData.crop_name}
                    onChange={(e) => setFormData({ ...formData, crop_name: e.target.value })}
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
                    Disease Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tomato Early Blight"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

              <div style={{ marginTop: '0.85rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Pathogen Classification
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alternaria solani (Fungal Pathogen)"
                  value={formData.pathogen}
                  onChange={(e) => setFormData({ ...formData, pathogen: e.target.value })}
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

              <div style={{ marginTop: '0.85rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Symptoms Summary
                </label>
                <textarea
                  rows={3}
                  placeholder="Characteristic lesion structures, chlorosis patterns, necrotic concentric rings..."
                  value={formData.symptoms}
                  onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.55rem 0.8rem',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    lineHeight: 1.45,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginTop: '0.85rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Existing Remediation Metadata
                </label>
                <textarea
                  rows={3}
                  placeholder="IPM certified treatment protocols, bio-fungicides, copper sprays..."
                  value={formData.treatment}
                  onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.55rem 0.8rem',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    lineHeight: 1.45,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginTop: '0.85rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Existing Prevention Metadata
                </label>
                <textarea
                  rows={2}
                  placeholder="Sanitation, drip irrigation spacing, crop rotation schedules..."
                  value={formData.prevention}
                  onChange={(e) => setFormData({ ...formData, prevention: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.55rem 0.8rem',
                    color: '#fff',
                    fontSize: '0.88rem',
                    outline: 'none',
                    lineHeight: 1.45,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary-outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  style={{ background: '#dc2626' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
