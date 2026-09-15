import React, { useState, useEffect, useMemo } from 'react';
import { roleApi } from '../../services/roleApi';

export default function AdminCropManagement() {
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    scientific_name: '',
    variety: '',
    season: 'Kharif / Rabi',
    optimal_temperature: '18°C - 30°C',
    optimal_ph: '6.0 - 7.0',
    description: '',
    category: 'Staple Crop',
    image_url: '',
  });

  const fetchCrops = async () => {
    setLoading(true);
    try {
      const list = await roleApi.getCrops(searchQuery);
      setCrops(list || []);
    } catch (err) {
      console.error('Failed to load crops:', err);
      setFeedback({ type: 'error', message: 'Unable to retrieve crops catalog.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSeasonFilter('');
    fetchCrops();
  };

  // Filtered crops list
  const filteredCrops = useMemo(() => {
    return crops.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.scientific_name && c.scientific_name.toLowerCase().includes(q)) ||
        (c.variety && c.variety.toLowerCase().includes(q));

      const matchesSeason =
        !seasonFilter ||
        (c.season && c.season.toLowerCase().includes(seasonFilter.toLowerCase())) ||
        (c.category && c.category.toLowerCase().includes(seasonFilter.toLowerCase()));

      return matchesSearch && matchesSeason;
    });
  }, [crops, searchQuery, seasonFilter]);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      name: '',
      scientific_name: '',
      variety: '',
      season: 'Kharif / Rabi',
      optimal_temperature: '18°C - 30°C',
      optimal_ph: '6.0 - 7.0',
      description: '',
      category: 'Staple Crop',
      image_url: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (crop) => {
    setIsEditing(true);
    setEditingId(crop.id);
    setFormData({
      name: crop.name || '',
      scientific_name: crop.scientific_name || '',
      variety: crop.variety || crop.cultivar || 'Standard Cultivars',
      season: crop.season || 'Kharif / Rabi',
      optimal_temperature: crop.optimal_temperature || crop.optimal_climate || '20°C - 30°C',
      optimal_ph: crop.optimal_ph || crop.target_ph || '6.0 - 7.0',
      description: crop.description || '',
      category: crop.category || 'Staple Crop',
      image_url: crop.image_url || '',
    });
    setModalOpen(true);
  };

  const handleDeleteCrop = async (crop) => {
    if (!window.confirm(`Permanently remove ${crop.name} from master crop catalog?`)) return;
    try {
      await roleApi.deleteCrop(crop.id);
      setCrops(crops.filter((c) => c.id !== crop.id));
      setFeedback({ type: 'success', message: `Crop ${crop.name} removed from catalog.` });
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete crop.' });
    }
  };

  const handleSaveCrop = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Crop Name is required.');
      return;
    }

    try {
      if (isEditing) {
        await roleApi.updateCrop(editingId, {
          name: formData.name.trim(),
          scientific_name: formData.scientific_name.trim() || undefined,
          category: formData.category,
          season: formData.season,
          description: formData.description.trim() || undefined,
          image_url: formData.image_url.trim() || undefined,
        });

        setCrops(
          crops.map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  ...formData,
                }
              : c
          )
        );
        setFeedback({ type: 'success', message: `Crop ${formData.name} updated successfully.` });
      } else {
        const res = await roleApi.addCrop({
          name: formData.name.trim(),
          scientific_name: formData.scientific_name.trim() || undefined,
          category: formData.category,
          season: formData.season,
          description: formData.description.trim() || undefined,
          image_url: formData.image_url.trim() || undefined,
        });

        setCrops([
          ...crops,
          {
            id: res.id || Date.now(),
            ...formData,
          },
        ]);
        setFeedback({ type: 'success', message: `New crop ${formData.name} added to catalog.` });
      }
      setModalOpen(false);
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save crop.' });
    }
  };

  return (
    <div className="role-page-container admin-crops-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#f87171' }}>Agricultural Master Data</span>
          <h1 className="page-main-title">🌱 Crop Catalog Management</h1>
          <p className="page-desc">
            Manage supported crop species, botanical profiles, cultivation parameters, and field representations.
          </p>
        </div>
        <div className="header-action-group">
          <button
            type="button"
            className="btn-primary-action"
            style={{ background: '#dc2626' }}
            onClick={handleOpenAdd}
          >
            ➕ Add New Crop
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
              placeholder="Search crop name or scientific name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          <select
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            aria-label="Category / Season Filter"
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
            <option value="">All Categories & Seasons</option>
            <option value="Kharif">Kharif Season</option>
            <option value="Rabi">Rabi Season</option>
            <option value="Zaid">Zaid / Summer</option>
            <option value="Staple">Staple Crops</option>
            <option value="Horticulture">Horticulture & Fruits</option>
          </select>
        </div>

        {(searchQuery || seasonFilter) && (
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
            <span>Loading crop species catalog...</span>
          </div>
        ) : filteredCrops.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🌱</span>
            <strong style={{ color: '#e2e8f0', fontSize: '1.05rem', display: 'block', marginBottom: '0.25rem' }}>
              No Crops Found
            </strong>
            <small style={{ color: '#64748b' }}>
              {searchQuery || seasonFilter
                ? 'No botanical records match your active search filters.'
                : 'No crops have been added to the catalog.'}
            </small>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="role-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 0, 0, 0.45)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Crop</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Variety / Cultivar</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Growing Season</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Optimal Climate</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>Target Soil pH</th>
                  <th style={{ padding: '0.75rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCrops.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>🌱</span>
                        <div>
                          <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>
                            {c.name}
                          </strong>
                          {c.scientific_name && (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                              {c.scientific_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem', color: '#cbd5e1' }}>
                      {c.variety || c.cultivar || 'Standard Cultivars'}
                    </td>

                    <td style={{ padding: '0.85rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: 'rgba(52, 211, 153, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.3)',
                        }}
                      >
                        {c.season || 'Kharif / Rabi'}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem', color: '#cbd5e1' }}>
                      {c.optimal_temperature || c.optimal_climate || '20°C - 30°C'}
                    </td>

                    <td style={{ padding: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                      {c.optimal_ph || c.target_ph || '6.0 - 7.0'}
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
                          onClick={() => handleOpenEdit(c)}
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
                          onClick={() => handleDeleteCrop(c)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Add Crop Modal */}
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
              border: '1px solid rgba(52, 211, 153, 0.35)',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {isEditing ? `✏️ Edit Crop: ${formData.name}` : '🌱 Add New Crop Species'}
                </h3>
                <small style={{ color: '#94a3b8' }}>Maintain botanical taxonomy and agronomic parameters</small>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCrop}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Crop Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tomato"
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

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Scientific Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Solanum lycopersicum"
                    value={formData.scientific_name}
                    onChange={(e) => setFormData({ ...formData, scientific_name: e.target.value })}
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
                    Variety / Cultivar
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Roma, San Marzano, Cherry"
                    value={formData.variety}
                    onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
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
                    Growing Season
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kharif / Summer"
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
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
                    Optimal Temperature
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 21°C - 27°C"
                    value={formData.optimal_temperature}
                    onChange={(e) => setFormData({ ...formData, optimal_temperature: e.target.value })}
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
                    Target Soil pH
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 6.0 - 6.8"
                    value={formData.optimal_ph}
                    onChange={(e) => setFormData({ ...formData, optimal_ph: e.target.value })}
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
                  Additional Profile Data
                </label>
                <textarea
                  rows={3}
                  placeholder="Cultivation characteristics, irrigation sensitivity, and agrometeorological preferences..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  style={{ background: '#059669' }}
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
