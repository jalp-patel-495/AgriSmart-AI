import React, { useState } from 'react';
import { authApi } from '../../services/authApi';

const QUICK_PROMPTS = [
  'Summarize crop health risks across all connected farms',
  'Which connected farms require immediate irrigation attention?',
  'Provide an advisory on fungal outbreak threats for connected tomatoes',
  'Summarize network acreage, crops, and sustainability standing',
];

export default function StakeholderCopilotView() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  const handleSubmit = async (e, textOverride) => {
    if (e) e.preventDefault();
    const promptToUse = textOverride || query;
    if (!promptToUse.trim()) return;

    setLoading(true);
    setError(null);

    const userMessage = { sender: 'user', text: promptToUse, timestamp: new Date() };
    setChatHistory((prev) => [...prev, userMessage]);

    try {
      const res = await authApi.queryStakeholderCopilot(promptToUse);
      const copilotMessage = {
        sender: 'copilot',
        response: res,
        timestamp: new Date(),
      };
      setResponse(res);
      setChatHistory((prev) => [...prev, copilotMessage]);
      setQuery('');
    } catch (err) {
      console.error('Copilot query error:', err);
      setError(err.message || 'Unable to consult Agri Intelligence Copilot.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Bar */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(15, 23, 42, 0.7) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🤖</span> Grounded Agri Intelligence Copilot
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Multi-farm analytical assistant strictly grounded in your active farmer network data.
          </p>
        </div>

        <span
          style={{
            background: 'rgba(168, 85, 247, 0.2)',
            color: '#c084fc',
            padding: '0.3rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          Grounding: Connected Farmer Database
        </span>
      </div>

      {/* Quick Prompts */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSubmit(null, prompt)}
            disabled={loading}
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              color: '#cbd5e1',
              padding: '0.45rem 0.85rem',
              borderRadius: '999px',
              fontSize: '0.8rem',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            💬 {prompt}
          </button>
        ))}
      </div>

      {/* Chat Display / History */}
      <div
        style={{
          minHeight: '340px',
          maxHeight: '600px',
          overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {chatHistory.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '240px',
              color: '#94a3b8',
              textAlign: 'center',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontSize: '2.5rem' }}>🌱</div>
            <h4 style={{ color: '#f8fafc', margin: 0 }}>Ask Anything About Your Connected Farms</h4>
            <p style={{ fontSize: '0.85rem', maxWidth: '480px', margin: 0 }}>
              The Copilot synthesizes visual disease diagnoses, soil moisture sensors, weather telemetry, and regional risks into actionable agronomic intelligence.
            </p>
          </div>
        ) : (
          chatHistory.map((msg, idx) => {
            if (msg.sender === 'user') {
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: 'flex-end',
                    background: 'rgba(14, 165, 233, 0.2)',
                    border: '1px solid rgba(14, 165, 233, 0.4)',
                    color: '#f8fafc',
                    padding: '0.85rem 1.25rem',
                    borderRadius: '14px 14px 2px 14px',
                    maxWidth: '80%',
                    fontSize: '0.9rem',
                  }}
                >
                  {msg.text}
                </div>
              );
            }

            const copilotRes = msg.response;
            return (
              <div
                key={idx}
                style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: '14px 14px 14px 2px',
                  padding: '1.25rem 1.5rem',
                  maxWidth: '90%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🤖</span>
                  <span style={{ fontWeight: 600, color: '#c084fc', fontSize: '0.9rem' }}>
                    Agri Intelligence Copilot
                  </span>
                </div>

                {/* Formatted Text Content */}
                <div
                  style={{
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {copilotRes.answer || copilotRes.response || JSON.stringify(copilotRes)}
                </div>

                {/* Grounding Inspector */}
                {copilotRes.grounding_data && (
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '0.75rem 1rem',
                      marginTop: '0.5rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: '0.35rem' }}>
                      🔍 Telemetry Grounding Evidence:
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: '#94a3b8' }}>
                      <span>
                        Connected Farms Analyzed: <strong>{copilotRes.grounding_data.connected_farmers_count ?? '—'}</strong>
                      </span>
                      <span>
                        Monitored Acreage: <strong>{copilotRes.grounding_data.total_acreage_ha ? `${copilotRes.grounding_data.total_acreage_ha} ha` : '0.0 ha'}</strong>
                      </span>
                      <span>
                        Active Outbreaks: <strong>{copilotRes.grounding_data.active_outbreaks ?? 0}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#c084fc', padding: '0.5rem' }}>
            <span>🔄</span>
            <span style={{ fontSize: '0.85rem' }}>Synthesizing connected farm telemetry...</span>
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={(e) => handleSubmit(e)} style={{ display: 'flex', gap: '0.75rem' }}>
        <input
          type="text"
          placeholder="Ask about connected crops, disease prevalence, moisture alerts, or regional forecasts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
          style={{
            flex: 1,
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '12px',
            padding: '0.75rem 1.25rem',
            color: '#f8fafc',
            fontSize: '0.9rem',
          }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
            border: 'none',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !query.trim() ? 0.6 : 1,
            boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)',
          }}
        >
          {loading ? 'Consulting...' : 'Ask Copilot →'}
        </button>
      </form>
    </div>
  );
}
