import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import SessionModal from '../SessionModal/SessionModal';
import './History.css';

const API = 'http://localhost:8000/api';

function gradeColor(grade) {
  const map = { 'A+': '#30d158', A: '#34c759', B: '#0071e3', C: '#ff9f0a', D: '#ff6b3d', F: '#ff453a' };
  return map[grade] || '#ffffff';
}

export default function History({ onLoad }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // full session for modal
  const [modalSession, setModalSession] = useState(null);

  async function fetchSessions() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/sessions?limit=50`);
      setSessions(data.sessions || []);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }

  async function openSession(sessionId) {
    try {
      const { data } = await axios.get(`${API}/sessions/${sessionId}`);
      setModalSession(data);
    } catch { /* silently fail */ }
  }

  useEffect(() => { fetchSessions(); }, []);

  const trendData = sessions
    .slice()
    .reverse()
    .map((s, i) => ({
      name: `#${i + 1}`,
      score: s.readability_score,
      lang: s.language,
    }));

  if (loading) return (
    <div className="history-section">
      <div className="skeleton" style={{ height: 100, borderRadius: 14 }} />
    </div>
  );

  if (!sessions.length) return null;

  return (
    <div className="history-section">
      <div className="history-header">
        <h3 className="history-title">Session History</h3>
        <div className="history-header-actions">
          <span className="history-count">{sessions.length} sessions</span>
          <button className="btn btn-ghost btn-sm" onClick={fetchSessions} id="refresh-history-btn">↻ Refresh</button>
        </div>
      </div>

      {trendData.length > 1 && (
        <div className="trend-chart glass-card">
          <div className="trend-header">
            <span className="trend-label">Score Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                itemStyle={{ color: '#60adff' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#0071e3"
                strokeWidth={2}
                dot={{ fill: '#0071e3', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#60adff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="history-cards">
        {sessions.map((s) => (
          <button
            key={s.session_id}
            className="history-card glass-card"
            onClick={() => openSession(s.session_id)}
            title={`${s.language} — Score ${s.readability_score} — Click to view details`}
          >
            <div className="hcard-top">
              <span className="hcard-grade" style={{ color: gradeColor(s.grade) }}>{s.grade}</span>
              <span className="hcard-score" style={{ color: gradeColor(s.grade) }}>{s.readability_score}</span>
            </div>
            <div className="hcard-lang">{s.language}</div>
            <div className="hcard-tag">{s.session_tag || 'Untitled'}</div>
            {s.code_snippet && (
              <div className="hcard-snippet">{s.code_snippet.substring(0, 60)}...</div>
            )}
            <div className="hcard-time">{new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div className="hcard-hint">Click to view →</div>
          </button>
        ))}
      </div>

      {/* Session Detail Modal */}
      {modalSession && (
        <SessionModal
          session={modalSession}
          onClose={() => setModalSession(null)}
          onLoadInEditor={onLoad}
          onDelete={(id) => setSessions(prev => prev.filter(s => s.session_id !== id))}
        />
      )}
    </div>
  );
}
