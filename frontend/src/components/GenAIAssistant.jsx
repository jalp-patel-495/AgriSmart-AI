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
      {/* Header & Active Context Bar */}
      <div className="assistant-header-card panel-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🤖</span> GenAI Agricultural Assistant
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
              Conversational agronomist powered by Gemini API and real-time field context.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="ai-model-tag">
              ⚡ Gemini 1.5 & RAG Agronomy Engine
            </span>
            <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={clearChat}>
              🔄 Clear Chat
            </button>
          </div>
        </div>

        {/* Live Context Pills */}
        <div className="active-context-bar">
          <span className="context-label">Active Field Context:</span>
          <div className="context-pills">
            <span className="ctx-pill">
              🌱 Crop: <strong>{farmContext?.crop || 'Tomato'}</strong>
            </span>
            {farmContext?.disease && (
              <span className="ctx-pill ctx-pill-alert">
                🔬 Diagnosis: <strong>{farmContext.disease} ({farmContext.confidence || '92%'})</strong>
              </span>
            )}
            {farmContext?.temperature && (
              <span className="ctx-pill">
                🌦️ Weather: <strong>{farmContext.temperature}°C, {farmContext.humidity}% RH</strong>
              </span>
            )}
            {farmContext?.irrigation_status && (
              <span className="ctx-pill">
                💧 Irrigation: <strong>{farmContext.irrigation_status}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Quick Questions Bar */}
      <div className="quick-prompts-bar">
        <span className="quick-prompts-label">Common Questions:</span>
        <div className="quick-prompts-scroll">
          {quickPrompts.map((item, idx) => (
            <button
              key={idx}
              className="quick-prompt-chip"
              onClick={() => handleSend(item.prompt)}
            >
              <span>{item.icon}</span> {item.prompt}
            </button>
          ))}
        </div>
      </div>

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
