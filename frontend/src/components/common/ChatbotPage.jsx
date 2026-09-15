import React from 'react';
import GenAIAssistant from '../GenAIAssistant';

/**
 * ChatbotPage
 * Dedicated full-page view for the AgriSmart AI Chatbot Assistant.
 * Accessible across Farmer, Stakeholder, Expert, and Admin roles.
 */
export default function ChatbotPage({ role = 'Farmer' }) {
  return (
    <div className="role-page-container">
      {/* Header Banner */}
      <div
        style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(52, 211, 153, 0.25)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f8fafc' }}>
            <span>🤖</span> AgriSmart GenAI Agricultural Assistant
          </h2>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Powered by OpenAI GPT-4o & Context-Aware Agronomic Knowledge Engine. Correlated with your real farm telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.35)',
            }}
          >
            🟢 AI Inference Online
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            ⚡ OpenAI GPT-4o Active
          </span>
        </div>
      </div>

      {/* Main Assistant Body */}
      <GenAIAssistant />
    </div>
  );
}
