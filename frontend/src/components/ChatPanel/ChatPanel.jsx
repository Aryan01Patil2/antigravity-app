import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ChatPanel.css';

const API = 'http://localhost:8000/api';

export default function ChatPanel({ sessionId, result }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const msg = input.trim();
    if (!msg || !sessionId) return;

    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/chat`, {
        session_id: sessionId,
        message: msg,
        include_history: true,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'error', content: 'Chat failed. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const QUICK_QUESTIONS = [
    "Why is high nesting depth bad?",
    "Show me how to fix the worst function",
    "What's the quickest win I can make?",
  ];

  if (!sessionId) return null;

  return (
    <div className={`chat-panel glass-card ${open ? 'chat-open' : ''}`}>
      <button className="chat-toggle" onClick={() => setOpen(!open)}>
        <span className="chat-toggle-icon">💬</span>
        <span>Ask AI Coach</span>
        <span className="chat-toggle-arrow">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="chat-body animate-fade-in">
          <div className="chat-messages" id="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p>👋 Hi! I've analyzed your code. Ask me anything about it.</p>
                <div className="quick-questions">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      className="quick-q-btn"
                      onClick={() => { setInput(q); }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                <div className="chat-msg-bubble">
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg-assistant">
                <div className="chat-msg-bubble chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Ask about your code... (Enter to send)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={2}
              id="chat-input-field"
            />
            <button
              className="chat-send btn btn-primary"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              id="chat-send-btn"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
