import React, { useState, useEffect } from 'react';
import GenAIAssistant from './GenAIAssistant';

/**
 * FloatingChatbotWidget
 * Shows on ALL pages across AgriSmart AI.
 * Clicking the floating 🤖 button toggles an instant, interactive AI Chatbot popup right on screen.
 */
export default function FloatingChatbotButton({ currentUser, onNavigateFullPage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Floating Chatbot Popup Window */}
      {isOpen && (
        <div className={`floating-chatbot-modal ${isMinimized ? 'minimized' : ''}`}>
          {/* Header */}
          <div className="floating-chat-header">
            <div className="floating-chat-header-left">
              <span className="floating-header-avatar">🤖</span>
              <div>
                <div className="floating-header-title">AgriSmart AI Assistant</div>
                <div className="floating-header-sub">
                  <span className="live-dot" /> Online • OpenAI GPT-4o Powered
                </div>
              </div>
            </div>

            <div className="floating-chat-header-actions">
              {onNavigateFullPage && (
                <button
                  type="button"
                  className="header-action-btn"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateFullPage();
                  }}
                  title="Open Full Page Chatbot"
                >
                  ⛶
                </button>
              )}
              <button
                type="button"
                className="header-action-btn"
                onClick={() => setIsMinimized((prev) => !prev)}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? '▲' : '—'}
              </button>
              <button
                type="button"
                className="header-action-btn close-btn"
                onClick={() => setIsOpen(false)}
                title="Close Chatbot"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Chat Body (hidden if minimized) */}
          {!isMinimized && (
            <div className="floating-chat-body">
              <GenAIAssistant />
            </div>
          )}
        </div>
      )}

      {/* Floating Action Launcher Button (Always visible on all pages) */}
      <button
        type="button"
        className={`floating-chatbot-btn ${isOpen ? 'active-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? 'Close AgriSmart AI Chatbot' : 'Ask AgriSmart AI Chatbot (OpenAI Powered)'}
        aria-label="Toggle AgriSmart AI Chatbot"
      >
        <div className="floating-bot-inner">
          <span className="floating-bot-icon">{isOpen ? '✕' : '🤖'}</span>
        </div>
        {!isOpen && <div className="floating-bot-pulse" />}
        {!isOpen && (
          <span className="floating-btn-tooltip">
            Ask AI Chatbot
          </span>
        )}
      </button>
    </>
  );
}
