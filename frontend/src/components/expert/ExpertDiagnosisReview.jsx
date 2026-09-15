import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { roleApi } from '../../services/roleApi';

export default function ExpertDiagnosisReview() {
  const location = useLocation();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [catalogTreatments, setCatalogTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Review Form state
  const [reviewDecision, setReviewDecision] = useState('CONFIRMED'); // 'CONFIRMED' or 'REJECTED'
  const [correctedCrop, setCorrectedCrop] = useState('');
  const [correctedDisease, setCorrectedDisease] = useState('');
  const [expertNotes, setExpertNotes] = useState('');
  const [expertTreatment, setExpertTreatment] = useState('');

  // Queue search filter
  const [queueSearch, setQueueSearch] = useState('');

  const fetchCasesAndCatalog = async () => {
    setLoading(true);
    try {
      const [casesList, treatmentsList] = await Promise.all([
        roleApi.getExpertCases('ALL'),
        roleApi.getTreatments(),
      ]);

      setCases(casesList || []);
      setCatalogTreatments(treatmentsList || []);

      // Check if a specific caseId was passed in location.state
      const incomingId = location.state?.selectedCaseId;
      if (incomingId && casesList) {
        const found = casesList.find((c) => c.id === incomingId);
        if (found) {
          selectCaseItem(found);
          return;
        }
      }

      if (casesList && casesList.length > 0) {
        selectCaseItem(casesList[0]);
      }
    } catch (err) {
      console.error('Failed to load review workspace:', err);
      setFeedback({ type: 'error', message: 'Unable to retrieve diagnostic cases.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCasesAndCatalog();
  }, []);

  const selectCaseItem = (c) => {
    setSelectedCase(c);
    const norm = (c.expert_status || (c.expert_reviewed ? 'CONFIRMED' : 'PENDING')).toUpperCase();
    setReviewDecision(norm === 'REJECTED' ? 'REJECTED' : 'CONFIRMED');
    setCorrectedCrop(c.crop || '');
    setCorrectedDisease('');
    setExpertNotes(c.expert_notes || '');
    setExpertTreatment(c.expert_treatment || c.treatment || '');
    setFeedback({ type: '', message: '' });
  };

  // Populate from Catalog
  const handleSelectCatalogTreatment = (treatmentId) => {
    if (!treatmentId) return;
    const item = catalogTreatments.find((t) => t.id === parseInt(treatmentId, 10));
    if (item) {
      const formatted = [
        item.treatment ? `Remediation: ${item.treatment}` : '',
        item.prevention ? `Prevention: ${item.prevention}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      setExpertTreatment(formatted);
    }
  };

  const handleTriggerSubmit = (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    if (!selectedCase) return;

    setSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      const payload = {
        expert_status: reviewDecision,
        expert_notes: expertNotes.trim() || undefined,
        expert_treatment: expertTreatment.trim() || undefined,
        corrected_disease: reviewDecision === 'REJECTED' ? (correctedDisease.trim() || 'Unable to determine') : undefined,
      };

      await roleApi.submitExpertReview(selectedCase.id, payload);

      setFeedback({
        type: 'success',
        message: 'Expert review submitted successfully.',
      });

      // Update local case state
      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id
            ? {
                ...c,
                expert_status: reviewDecision,
                expert_reviewed: true,
                expert_notes: expertNotes,
                expert_treatment: expertTreatment,
                disease: reviewDecision === 'REJECTED' && correctedDisease ? correctedDisease : c.disease,
              }
            : c
        )
      );

      setSelectedCase((prev) => ({
        ...prev,
        expert_status: reviewDecision,
        expert_reviewed: true,
        expert_notes: expertNotes,
        expert_treatment: expertTreatment,
        disease: reviewDecision === 'REJECTED' && correctedDisease ? correctedDisease : prev.disease,
      }));
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to submit expert review.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Queue
  const filteredQueue = cases.filter((c) => {
    if (!queueSearch) return true;
    const q = queueSearch.toLowerCase();
    return (
      (c.crop && c.crop.toLowerCase().includes(q)) ||
      (c.disease && c.disease.toLowerCase().includes(q)) ||
      String(c.id).includes(q)
    );
  });

  return (
    <div className="role-page-container expert-review-workspace">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#818cf8' }}>Expert Workspace</span>
          <h1 className="page-main-title">✍️ Diagnosis Review & Agronomist Triage</h1>
          <p className="page-desc">
            Examine uploaded plant leaf specimens, validate PlantVillage AI diagnostic outcomes, and provide verified agronomic guidance.
          </p>
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

      {/* Review Studio 2-Column Layout */}
      {loading ? (
        <div style={{ padding: '3.5rem 0', textAlign: 'center', color: '#94a3b8' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
          <span>Loading triage workspace...</span>
        </div>
      ) : cases.length === 0 ? (
        <div
          style={{
            padding: '4rem 1rem',
            textAlign: 'center',
            background: 'rgba(16, 28, 22, 0.6)',
            border: '1px dashed rgba(52, 211, 153, 0.25)',
            borderRadius: '16px',
            color: '#94a3b8',
          }}
        >
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📂</span>
          <strong style={{ color: '#e2e8f0', fontSize: '1.1rem', display: 'block', marginBottom: '0.35rem' }}>
            No Cases in Triage Queue
          </strong>
          <small style={{ color: '#64748b' }}>All incoming leaf diagnostic submissions have been reviewed.</small>
        </div>
      ) : (
        <div
          className="review-studio-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 340px) 1fr',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {/* LEFT: Case Queue */}
          <div
            className="review-cases-sidebar"
            style={{
              background: 'rgba(16, 28, 22, 0.8)',
              border: '1px solid rgba(52, 211, 153, 0.2)',
              borderRadius: '16px',
              padding: '1.25rem',
              backdropFilter: 'blur(12px)',
              maxHeight: 'calc(100vh - 180px)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Case Queue ({cases.length})
                </h3>
              </div>
              <input
                type="text"
                placeholder="Filter queue..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.4rem 0.65rem',
                  color: '#fff',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div
              className="queue-list"
              style={{
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                paddingRight: '0.25rem',
              }}
            >
              {filteredQueue.map((c) => {
                const isSelected = selectedCase?.id === c.id;
                const rawConf = typeof c.confidence_score === 'number'
                  ? c.confidence_score
                  : parseFloat(c.confidence) / 100 || 0.85;
                const confNum = Math.round(rawConf <= 1 ? rawConf * 100 : rawConf);
                const normStatus = (c.expert_status || (c.expert_reviewed ? 'CONFIRMED' : 'PENDING')).toUpperCase();

                let pillColor = '#fbbf24';
                let pillBg = 'rgba(251, 191, 36, 0.15)';
                let pillText = '⏳ Pending';
                if (normStatus === 'CONFIRMED' || normStatus === 'CORRECTED') {
                  pillColor = '#34d399';
                  pillBg = 'rgba(16, 185, 129, 0.15)';
                  pillText = '🟢 Confirmed';
                } else if (normStatus === 'REJECTED') {
                  pillColor = '#f87171';
                  pillBg = 'rgba(239, 68, 68, 0.15)';
                  pillText = '🔴 Rejected';
                }

                return (
                  <div
                    key={c.id}
                    onClick={() => selectCaseItem(c)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(0, 0, 0, 0.25)',
                      border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                        #{c.id} • {c.crop}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: pillColor,
                          background: pillBg,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          fontWeight: 600,
                        }}
                      >
                        {pillText}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      {c.disease}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                      <span style={{ color: confNum < 65 ? '#f87171' : '#34d399' }}>Conf: {confNum}%</span>
                      <span>{c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recent'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Selected Case Review Workspace */}
          {selectedCase && (
            <div className="review-work-area" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Selected Case Header & Specimen Preview */}
              <div
                className="studio-card"
                style={{
                  background: 'rgba(16, 28, 22, 0.8)',
                  border: '1px solid rgba(52, 211, 153, 0.2)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Header Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#818cf8', letterSpacing: '0.05em' }}>
                      CASE #{selectedCase.id}
                    </span>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0.2rem 0 0 0' }}>
                      🌱 {selectedCase.crop}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>AI Prediction</span>
                      <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>{selectedCase.disease}</strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>AI Confidence</span>
                      <strong style={{ fontSize: '0.88rem', color: typeof selectedCase.confidence === 'number' && selectedCase.confidence < 0.65 ? '#f87171' : '#34d399' }}>
                        {typeof selectedCase.confidence === 'number' ? `${Math.round(selectedCase.confidence <= 1 ? selectedCase.confidence * 100 : selectedCase.confidence)}%` : `${selectedCase.confidence}`}
                      </strong>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Review Status</span>
                      <strong style={{ fontSize: '0.88rem', color: '#fbbf24' }}>
                        {selectedCase.expert_status || 'Pending Review'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Specimen Inspection Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                  {/* Large Contained Specimen Image (No cropping / distortion) */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      height: '240px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {selectedCase.image_filename ? (
                      <img
                        src={`/api/v1/predict/image/${selectedCase.image_filename}`}
                        alt={`Specimen ${selectedCase.crop}`}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#64748b' }}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🍃</span>
                        <strong style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block' }}>
                          High-Resolution Specimen Record
                        </strong>
                        <small style={{ color: '#475569' }}>Standard 224×224 PlantVillage neural tensor input</small>
                      </div>
                    )}
                  </div>

                  {/* Telemetry & Symptoms */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Producer Attribution
                      </span>
                      <div style={{ color: '#f8fafc', fontSize: '0.9rem', marginTop: '0.15rem' }}>
                        👨‍🌾 {selectedCase.farmer_name || 'Registered Farm Producer'} {selectedCase.farm_location ? `(${selectedCase.farm_location})` : ''}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Diagnostic Observations & Symptoms
                      </span>
                      <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
                        {selectedCase.symptoms || 'Foliar lesions with necrotic tissue spotting observed across sampled leaf canopy.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review & Agronomist Triage Form */}
              <div
                className="studio-card"
                style={{
                  background: 'rgba(16, 28, 22, 0.8)',
                  border: '1px solid rgba(52, 211, 153, 0.2)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: '0 0 1.25rem 0' }}>
                  Clinical Diagnosis Verification
                </h3>

                <form onSubmit={handleTriggerSubmit}>
                  {/* Two Clear Actions: Confirm vs Reject */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setReviewDecision('CONFIRMED')}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: reviewDecision === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 0, 0, 0.3)',
                        border: reviewDecision === 'CONFIRMED' ? '2px solid #34d399' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: reviewDecision === 'CONFIRMED' ? '#34d399' : '#94a3b8',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                        ✅ Confirm AI Diagnosis
                      </div>
                      <small style={{ color: '#cbd5e1', display: 'block' }}>
                        Accept the AI classification for {selectedCase.disease}.
                      </small>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewDecision('REJECTED')}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: reviewDecision === 'REJECTED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 0, 0, 0.3)',
                        border: reviewDecision === 'REJECTED' ? '2px solid #f87171' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: reviewDecision === 'REJECTED' ? '#f87171' : '#94a3b8',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                        ❌ Reject / Correct Diagnosis
                      </div>
                      <small style={{ color: '#cbd5e1', display: 'block' }}>
                        Override the AI classification with expert-reviewed information.
                      </small>
                    </button>
                  </div>

                  {/* If Reject / Override is selected: Show correction fields */}
                  {reviewDecision === 'REJECTED' && (
                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        marginBottom: '1.25rem',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                            Correct Crop
                          </label>
                          <input
                            type="text"
                            value={correctedCrop}
                            onChange={(e) => setCorrectedCrop(e.target.value)}
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
                          <label style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                            Correct Disease / Condition
                          </label>
                          <input
                            type="text"
                            value={correctedDisease}
                            onChange={(e) => setCorrectedDisease(e.target.value)}
                            placeholder="e.g. Septoria Leaf Spot (or 'Unable to determine')"
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
                          <small style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginTop: '0.2rem' }}>
                            Tip: You may enter "Unable to determine" when visual evidence is insufficient.
                          </small>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Agronomist Field Notes */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                      Agronomist Field Notes & Diagnostic Rationale
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Record observed symptoms, lesion characteristics, image quality observations, and diagnostic reasoning..."
                      value={expertNotes}
                      onChange={(e) => setExpertNotes(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        lineHeight: 1.45,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Treatment Recommendation Section */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>
                        💊 Treatment & Remediation Guidance
                      </label>
                      {catalogTreatments.length > 0 && (
                        <select
                          onChange={(e) => handleSelectCatalogTreatment(e.target.value)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid rgba(52, 211, 153, 0.3)',
                            color: '#34d399',
                            fontSize: '0.78rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">Insert from Treatment Catalog...</option>
                          {catalogTreatments.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.crop} - {t.disease}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Specify cultural sanitation, biological control agents, and monitoring precautions..."
                      value={expertTreatment}
                      onChange={(e) => setExpertTreatment(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        lineHeight: 1.45,
                        boxSizing: 'border-box',
                      }}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                      Guidance adheres to integrated pest management (IPM). Avoid prescribing unverified chemical dosages.
                    </small>
                  </div>

                  {/* Primary CTA */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      className="btn-primary-action"
                      style={{
                        background: '#6366f1',
                        padding: '0.85rem 1.85rem',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting Review...' : '✅ Submit Expert Review'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
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
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              background: 'rgba(16, 28, 22, 0.95)',
              border: '1px solid rgba(52, 211, 153, 0.35)',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 0.5rem 0' }}>
              Submit this expert review?
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', margin: '0 0 1.25rem 0', lineHeight: 1.45 }}>
              Your {reviewDecision === 'CONFIRMED' ? 'confirmation' : 'override'} on Case #{selectedCase?.id} ({selectedCase?.crop}) will be permanently recorded in the agronomic registry.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary-outline"
                onClick={() => setShowConfirmModal(false)}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-action"
                style={{ background: '#6366f1', fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
                onClick={handleConfirmSubmit}
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
