import React, { useState, useEffect, useMemo } from 'react';
import { roleApi } from '../../services/roleApi';

export default function AdminDatasetAIView() {
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [monitoringInfo, setMonitoringInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchCrop, setSearchCrop] = useState('');

  const fetchAIInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ds, mon] = await Promise.all([
        roleApi.getDatasetInfo(),
        roleApi.getSystemMonitoring(),
      ]);
      setDatasetInfo(ds);
      setMonitoringInfo(mon);
    } catch (err) {
      console.error('Failed to load dataset & AI specs:', err);
      setError('Unable to load AI model specifications from backend runtime.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIInfo();
  }, []);

  // System status verification
  const diseaseModule = monitoringInfo?.modules?.find((m) => m.module_name?.toLowerCase().includes('disease'));
  const isOperational = diseaseModule ? diseaseModule.status?.toLowerCase() === 'ready' : (datasetInfo?.status === 'success');

  // Metrics from real backend
  const corpusSizeDisplay = datasetInfo?.total_images ? `${datasetInfo.total_images.toLocaleString()} Images` : 'Data unavailable';
  const classesDisplay = datasetInfo?.total_classes ? `${datasetInfo.total_classes} Classes` : 'Data unavailable';
  const benchmarkDisplay = datasetInfo?.test_accuracy || 'Data unavailable';
  const latencyDisplay = datasetInfo?.latency_ms || 'Data unavailable';

  // Supported crops and classes
  const rawCrops = datasetInfo?.supported_crops || [
    'Apple', 'Blueberry', 'Cherry', 'Corn (Maize)', 'Grape', 'Orange',
    'Peach', 'Pepper Bell', 'Potato', 'Raspberry', 'Soybean', 'Squash',
    'Strawberry', 'Tomato'
  ];

  const allClasses = datasetInfo?.classes || [];

  const filteredCrops = useMemo(() => {
    if (!searchCrop) return rawCrops;
    const q = searchCrop.toLowerCase();
    return rawCrops.filter((c) => c.toLowerCase().includes(q));
  }, [rawCrops, searchCrop]);

  const filteredClasses = useMemo(() => {
    if (!searchCrop) return allClasses;
    const q = searchCrop.toLowerCase();
    return allClasses.filter((c) => c.toLowerCase().includes(q));
  }, [allClasses, searchCrop]);

  return (
    <div className="role-page-container admin-ai-specs-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#f87171' }}>Deep Learning Infrastructure</span>
          <h1 className="page-main-title">🧠 Dataset & AI Inference Engine Architecture</h1>
          <p className="page-desc">
            Technical specifications, model metadata, dataset information and inference configuration.
          </p>
        </div>
        <div className="header-action-group">
          {loading ? (
            <span className="badge-pill-outline" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#94a3b8' }}>
              Verifying Status...
            </span>
          ) : isOperational ? (
            <span
              className="badge-pill-outline"
              style={{
                borderColor: 'rgba(52, 211, 153, 0.4)',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                padding: '0.4rem 0.85rem',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              🟢 Engine Operational
            </span>
          ) : (
            <span
              className="badge-pill-outline"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                padding: '0.4rem 0.85rem',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              🔴 Engine Unavailable
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="role-error-banner" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {error}</span>
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={fetchAIInfo}
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="kpi-metric-card">
          <span className="kpi-label">Dataset / Corpus Size</span>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>
            {loading ? '...' : corpusSizeDisplay}
          </div>
          <div className="kpi-footer text-info">
            {datasetInfo?.dataset_name || 'PlantVillage Benchmark Standard'}
          </div>
        </div>

        <div className="kpi-metric-card">
          <span className="kpi-label">Classification Classes</span>
          <div className="kpi-value" style={{ color: '#c084fc' }}>
            {loading ? '...' : classesDisplay}
          </div>
          <div className="kpi-footer text-accent">
            {datasetInfo?.supported_crops_count ? `${datasetInfo.supported_crops_count} Botanical Species` : 'Botanical classes across canopy types'}
          </div>
        </div>

        <div className="kpi-metric-card">
          <span className="kpi-label">Benchmark Metric</span>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {loading ? '...' : benchmarkDisplay}
          </div>
          <div className="kpi-footer text-success">
            {datasetInfo?.macro_f1 ? `Test Macro-F1: ${datasetInfo.macro_f1}` : 'Verified test holdout evaluation'}
          </div>
        </div>

        <div className="kpi-metric-card">
          <span className="kpi-label">Inference Latency</span>
          <div className="kpi-value" style={{ color: '#fbbf24' }}>
            {loading ? '...' : latencyDisplay}
          </div>
          <div className="kpi-footer text-warning">
            {loading ? 'Evaluating...' : 'Average forward-pass latency per specimen'}
          </div>
        </div>
      </div>

      {/* Main Layout: Left Card (Specs & Deployment) & Right Card (Supported Species) */}
      <div className="dashboard-double-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* LEFT CARD: Model Specifications & Deployment */}
        <div
          className="dashboard-panel main-panel"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="panel-header-row"
            style={{
              marginBottom: '1.25rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              paddingBottom: '0.75rem',
            }}
          >
            <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              🧠 Model Specifications & Deployment
            </h2>
            <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
              Live deployment configuration and model metadata
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>Architecture</span>
              <strong style={{ color: '#fff' }}>
                {datasetInfo?.model_architecture || diseaseModule?.architecture || 'MobileNetV3-Large / PyTorch'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>Model File</span>
              <code style={{ color: '#38bdf8', fontSize: '0.8rem' }}>
                {diseaseModule?.artifact_file || 'crop_disease_model.pth'}
              </code>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>Input Resolution</span>
              <span style={{ color: '#cbd5e1' }}>224 × 224 RGB (ImageNet Standard Normalized)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>Training Configuration</span>
              <span style={{ color: '#cbd5e1' }}>
                {datasetInfo?.splits ? `${datasetInfo.splits.train.toLocaleString()} Train / ${datasetInfo.splits.val.toLocaleString()} Val` : '70/15/15 Stratified Split'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>Inference Configuration</span>
              <span style={{ color: '#34d399' }}>Confidence Gating &gt; 0.65 with Fallback</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>Model Version</span>
              <span style={{ color: '#cbd5e1' }}>v2.4.0 (Production Release)</span>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: Supported Crop Species */}
        <div
          className="dashboard-panel side-panel"
          style={{
            background: 'rgba(16, 28, 22, 0.8)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            className="panel-header-row"
            style={{
              marginBottom: '1rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              paddingBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="panel-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  🌱 Supported Crop Species ({rawCrops.length})
                </h2>
                <p className="panel-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                  Standardized botanical classes supported by the neural pipeline
                </p>
              </div>
            </div>
          </div>

          {/* Searchable input */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search crop species or class..."
              value={searchCrop}
              onChange={(e) => setSearchCrop(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '0.45rem 0.75rem',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Compact chips list */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              maxHeight: '220px',
              overflowY: 'auto',
              paddingRight: '0.25rem',
            }}
          >
            {filteredCrops.length === 0 && filteredClasses.length === 0 ? (
              <div style={{ padding: '1.5rem 0', textAlign: 'center', color: '#64748b', width: '100%' }}>
                No crops match "{searchCrop}".
              </div>
            ) : (
              filteredCrops.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    borderRadius: '999px',
                    fontSize: '0.82rem',
                    color: '#e2e8f0',
                  }}
                >
                  <span>🌾</span>
                  <span>{c}</span>
                </div>
              ))
            )}
          </div>

          {allClasses.length > 0 && searchCrop && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Matching Disease Classes ({filteredClasses.length}):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem', maxHeight: '120px', overflowY: 'auto' }}>
                {filteredClasses.slice(0, 10).map((cls, idx) => (
                  <span key={idx} style={{ fontSize: '0.75rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#cbd5e1' }}>
                    {cls}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Privacy & Protection Disclosures */}
      <div
        className="panel-card"
        style={{
          background: 'rgba(16, 28, 22, 0.8)',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          borderRadius: '16px',
          padding: '1.5rem',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🔐</span>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            Data Privacy & Protection
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
          <div>
            <strong style={{ color: '#34d399', display: 'block', marginBottom: '0.25rem' }}>Role-Based Isolation (RBAC)</strong>
            <span>Farmer records and uploaded leaf scans are linked to verified account IDs. Diagnostic history is accessible solely by the authorized farmer, certified experts for triage review, and administrators for system governance.</span>
          </div>
          <div>
            <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '0.25rem' }}>Specimen Storage Governance</strong>
            <span>Uploaded images are processed directly in local storage directories and indexed by filesystem filename references in SQLite/SQLAlchemy. No external unverified cloud transfer occurs during inference.</span>
          </div>
          <div>
            <strong style={{ color: '#c084fc', display: 'block', marginBottom: '0.25rem' }}>Session Token Security</strong>
            <span>Authentication utilizes PBKDF2 HMAC SHA-256 salted password hashing and cryptographically signed session tokens validated via FastAPI middleware dependency injections on every protected route.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
