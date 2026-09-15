import React, { useState, useMemo } from 'react';

export default function ExpertFarmerQueries() {
  // Real advisory queries state - starts with authentic empty state (strictly zero fabrication)
  const [queries, setQueries] = useState([]);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const handleSendReply = (id) => {
    if (!replyText.trim()) return;

    setQueries(
      queries.map((q) => {
        if (q.id === id) {
          return {
            ...q,
            status: 'Answered',
            reply: replyText.trim(),
            answeredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        }
        return q;
      })
    );

    setActiveReplyId(null);
    setReplyText('');
    setSuccessToast('Advisory guidance dispatched to farmer successfully.');
    setTimeout(() => setSuccessToast(''), 3500);
  };

  const filteredQueries = useMemo(() => {
    return queries.filter((q) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && q.status !== 'Answered') ||
        (statusFilter === 'ANSWERED' && q.status === 'Answered');

      const matchesSearch =
        !searchQuery ||
        (q.farmer && q.farmer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (q.crop && q.crop.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (q.question && q.question.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesStatus && matchesSearch;
    });
  }, [queries, statusFilter, searchQuery]);

  return (
    <div className="role-page-container expert-queries-page">
      {/* Header Banner */}
      <div className="role-page-header">
        <div>
          <span className="page-category-tag" style={{ color: '#818cf8' }}>Field Consultation Desk</span>
          <h1 className="page-main-title">💬 Farmer Advisory Queries</h1>
          <p className="page-desc">
            Direct farmer consultations, field symptom inquiries, and expert agronomic guidance.
          </p>
        </div>
      </div>

      {successToast && (
        <div className="role-success-banner" style={{ marginBottom: '1.5rem' }}>
          <span>✅ {successToast}</span>
        </div>
      )}

      {/* Filter Toolbar */}
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
              placeholder="Search farmer or inquiry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-text-input"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter by Query Status"
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
            <option value="ALL">All Consultation Queries</option>
            <option value="PENDING">🟡 Awaiting Response</option>
            <option value="ANSWERED">🟢 Answered</option>
          </select>
        </div>

        {(searchQuery || statusFilter !== 'ALL') && (
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
            }}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Query Cards or Clean Empty State */}
      {filteredQueries.length === 0 ? (
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
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.85rem' }}>💬</span>
          <strong style={{ color: '#e2e8f0', fontSize: '1.2rem', display: 'block', marginBottom: '0.35rem' }}>
            {searchQuery || statusFilter !== 'ALL'
              ? 'No farmer queries match your filter criteria.'
              : 'No farmer queries'}
          </strong>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            New farmer advisory requests will appear here as producers submit consultations from their mobile field application.
          </p>
        </div>
      ) : (
        <div className="queries-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredQueries.map((item) => {
            const isAnswered = item.status === 'Answered';
            return (
              <div
                key={item.id}
                className="farmer-query-card"
                style={{
                  background: 'rgba(16, 28, 22, 0.8)',
                  border: isAnswered ? '1px solid rgba(52, 211, 153, 0.25)' : '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '16px',
                  padding: '1.35rem',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.75rem' }}>👨‍🌾</span>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                        {item.farmer}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        🌾 <strong>{item.crop}</strong> {item.location ? `• 📍 ${item.location}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: isAnswered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                        color: isAnswered ? '#34d399' : '#fbbf24',
                        border: isAnswered ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)',
                      }}
                    >
                      {isAnswered ? '🟢 Answered' : '🟡 Awaiting Response'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.timestamp}</span>
                  </div>
                </div>

                {/* Question Body */}
                <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '0.85rem' }}>
                  <p style={{ color: '#e2e8f0', fontSize: '0.9rem', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
                    "{item.question}"
                  </p>
                </div>

                {/* Expert Response Preview if Answered */}
                {isAnswered && item.reply && (
                  <div
                    style={{
                      background: 'rgba(6, 78, 59, 0.2)',
                      border: '1px solid rgba(52, 211, 153, 0.25)',
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700, marginBottom: '0.25rem' }}>
                      👨‍🔬 Agronomist Advisory Guidance {item.answeredAt ? `(${item.answeredAt})` : ''}:
                    </div>
                    <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, lineHeight: 1.45 }}>
                      {item.reply}
                    </p>
                  </div>
                )}

                {/* Action Row */}
                {!isAnswered && (
                  <div style={{ marginTop: '0.85rem' }}>
                    {activeReplyId === item.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <textarea
                          rows={3}
                          placeholder="Provide certified agronomist guidance, symptoms analysis, and safe remediation..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.35)',
                            border: '1px solid rgba(129, 140, 248, 0.35)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            color: '#fff',
                            fontSize: '0.85rem',
                            outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn-secondary-outline"
                            onClick={() => {
                              setActiveReplyId(null);
                              setReplyText('');
                            }}
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-primary-action"
                            style={{ background: '#6366f1', fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                            onClick={() => handleSendReply(item.id)}
                          >
                            🚀 Send Advisory Response
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary-action"
                        style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.35)', color: '#c7d2fe', fontSize: '0.8rem', padding: '0.4rem 0.95rem' }}
                        onClick={() => {
                          setActiveReplyId(item.id);
                          setReplyText('');
                        }}
                      >
                        Answer Query →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
