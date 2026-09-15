import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getQuickPrompts } from '../services/assistantApi';

export default function GenAIAssistant({ farmContext }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hello! I am your **AgriSmart GenAI Agronomist**. I'm connected to your live farm telemetry, visual disease detector, and weather intelligence.\n\nHow can I assist you with your crops, disease management, or irrigation schedule today?",
      timestamp: 'Just now',
      model: 'AgriSmart Knowledge Engine',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [customKey, setCustomKey] = useState(localStorage.getItem('agrismart_user_api_key') || '');

  const messagesEndRef = useRef(null);

  // Load contextual starter questions matching current farm state
  useEffect(() => {
    const cropName = farmContext?.crop || 'Tomato';
    const diseaseName = farmContext?.disease || 'Early Blight';
    getQuickPrompts(cropName, diseaseName).then(setQuickPrompts);
  }, [farmContext]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (messageText = input) => {
    const textToSend = (typeof messageText === 'string' ? messageText : input).trim();
    if (!textToSend || isLoading) return;

    const userMsg = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Build history for context
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendChatMessage(textToSend, historyPayload, farmContext);

      const assistantMsg = {
        role: 'assistant',
        content: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model_used,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setFollowups(res.suggested_followups || []);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "⚠️ I encountered a connection issue reaching the AI inference engine. Please check your network connection and try again.",
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Web Speech API for voice dictation in the field
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech error:', err);
      setIsListening(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Conversation refreshed. Ask any question about your crops, foliar symptoms, or field operations.",
        timestamp: 'Just now',
        model: 'AgriSmart Knowledge Engine',
      },
    ]);
    setFollowups([]);
  };

  // Simple markdown renderer for response formatting
  const renderFormattedContent = (content) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Header 3
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="chat-h3">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('#### ')) {
        return <h5 key={idx} className="chat-h4">{line.replace('#### ', '')}</h5>;
      }
      // Bullet list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.substring(2);
        return (
          <li key={idx} className="chat-bullet">
            <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
          </li>
        );
      }
      // Numbered list
      if (/^\d+\.\s/.test(line)) {
        const text = line.replace(/^\d+\.\s/, '');
        return (
          <div key={idx} className="chat-num-item">
            <span className="num-prefix">{line.match(/^\d+/)[0]}.</span>
            <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
          </div>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={idx} style={{ height: '0.4rem' }} />;
      }
      // Regular paragraph
      return (
        <p key={idx} className="chat-p" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    });
  };

  const formatInline = (str) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="chat-code">$1</code>');
  };

  return (
    <div className="assistant-container">
      {/* Chat Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0.5rem', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span className="live-dot" /> AI Assistant Online
        </span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', borderRadius: '6px', color: '#94a3b8' }}
            onClick={() => setShowKeyConfig((prev) => !prev)}
            title="Configure Custom OpenAI or Gemini API Key"
          >
            🔑 API Key
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', borderRadius: '6px', color: '#94a3b8' }}
            onClick={clearChat}
            title="Clear Conversation"
          >
            🔄 Clear Chat
          </button>
        </div>
      </div>

      {/* Optional Custom API Key Drawer */}
      {showKeyConfig && (
        <div style={{ display: 'flex', gap: '0.4rem', padding: '0.4rem 0.5rem', background: '#051b11', borderRadius: '6px', marginBottom: '0.4rem', border: '1px solid #14532d', alignItems: 'center' }}>
          <input
            type="password"
            placeholder="Paste OpenAI (sk-...) or Gemini (AIza...) key"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            style={{ flex: 1, background: '#022c22', border: '1px solid #166534', color: '#ecfdf5', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', outline: 'none' }}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem', borderRadius: '4px', width: 'auto' }}
            onClick={() => {
              if (customKey.trim()) {
                localStorage.setItem('agrismart_user_api_key', customKey.trim());
                alert('Custom API Key saved successfully!');
              } else {
                localStorage.removeItem('agrismart_user_api_key');
                alert('Cleared custom key. AgriSmart Knowledge Engine will be active.');
              }
              setShowKeyConfig(false);
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem', borderRadius: '4px' }}
            onClick={() => setShowKeyConfig(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Chat Messages Stream */}
      <div className="chat-stream-box panel-card">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`chat-bubble-row ${isUser ? 'user-row' : 'assistant-row'}`}>
              {!isUser && <div className="chat-avatar">🌱</div>}
              <div className={`chat-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                <div className="bubble-meta">
                  <span className="bubble-sender">{isUser ? 'You (Field Operator)' : 'AgriSmart Agronomist'}</span>
                  <span className="bubble-time">{msg.timestamp}</span>
                </div>
                <div className="bubble-body">
                  {renderFormattedContent(msg.content)}
                </div>
                {msg.model && (
                  <div className="bubble-footer">
                    <span>⚡ {msg.model}</span>
                  </div>
                )}
              </div>
              {isUser && <div className="chat-avatar user-avatar">👨‍🌾</div>}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isLoading && (
          <div className="chat-bubble-row assistant-row">
            <div className="chat-avatar">🌱</div>
            <div className="chat-bubble assistant-bubble typing-bubble">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                Analyzing plant pathology & field context...
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Suggested Follow-ups */}
        {followups.length > 0 && !isLoading && (
          <div className="followups-container">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Suggested Follow-ups:
            </span>
            <div className="followup-chips">
              {followups.map((q, i) => (
                <button
                  key={i}
                  className="followup-chip"
                  onClick={() => handleSend(q)}
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <div className="chat-input-bar panel-card">
        <button
          className={`btn-mic ${isListening ? 'listening' : ''}`}
          onClick={toggleSpeechRecognition}
          title={isListening ? 'Listening... click to stop' : 'Click to speak question'}
        >
          {isListening ? '🔴' : '🎙️'}
        </button>

        <input
          type="text"
          className="chat-text-input"
          placeholder="Ask anything (e.g. 'Why is my tomato leaf turning brown?', 'When should I irrigate?')..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isLoading}
        />

        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-md)' }}
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
        >
          Send ➔
        </button>
      </div>
    </div>
  );
}
