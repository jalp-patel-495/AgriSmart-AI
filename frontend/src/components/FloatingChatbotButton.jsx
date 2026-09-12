import React from 'react';

export default function FloatingChatbotButton({ onOpenAssistant, activeTab }) {
  if (activeTab === 'assistant') return null;

  return (
    <button
      className="floating-chatbot-btn"
      onClick={onOpenAssistant}
      title="Open Kisan GenAI Assistant"
      aria-label="Open Kisan GenAI Assistant"
    >
      <div className="floating-bot-inner">
        <span className="floating-bot-icon">🤖</span>
      </div>
      <div className="floating-bot-pulse" />
    </button>
  );
}
