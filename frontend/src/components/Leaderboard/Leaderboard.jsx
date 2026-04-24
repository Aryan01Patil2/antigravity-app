import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Leaderboard.css';

const API = 'http://localhost:8000/api';

function gradeColor(grade) {
  const map = { 'A+': '#30d158', A: '#34c759', B: '#0071e3', C: '#ff9f0a', D: '#ff6b3d', F: '#ff3b30' };
  return map[grade] || '#ffffff';
}

const MEDAL = ['', '', ''];

export default function Leaderboard({ currentScore, currentGrade, currentLanguage, currentSessionId }) {
  const [room, setRoom] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [entries, setEntries] = useState([]);
  const [username, setUsername] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchLeaderboard(r) {
    if (!r) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/leaderboard/${r}`);
      setEntries(data.entries || []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }

  function joinRoom() {
    if (!roomInput.trim()) return;
    setRoom(roomInput.trim().toUpperCase());
    fetchLeaderboard(roomInput.trim().toUpperCase());
  }

  async function submitScore() {
    if (!room || !username.trim() || currentScore == null) return;
    try {
      await axios.post(`${API}/leaderboard/${room}`, {
        username: username.trim(),
        score: currentScore,
        language: currentLanguage || 'unknown',
        session_id: currentSessionId,
      });
      setSubmitted(true);
      fetchLeaderboard(room);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (room) {
      const interval = setInterval(() => fetchLeaderboard(room), 10000);
      return () => clearInterval(interval);
    }
  }, [room]);

  return (
    <div className="leaderboard-section">
      <h3 className="lb-title"> Team Leaderboard</h3>

      {!room ? (
        <div className="glass-card lb-join">
          <p className="lb-join-desc">Enter a room code to compete with your team or class in real time.</p>
          <div className="lb-join-row">
            <input
              className="lb-room-input"
              placeholder="Room code (e.g. DEV42)"
              value={roomInput}
              onChange={e => setRoomInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              maxLength={8}
              id="room-code-input"
            />
            <button className="btn btn-primary" onClick={joinRoom} id="join-room-btn">
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className="lb-content">
          <div className="lb-room-header glass-card">
            <span className="lb-room-badge">Room: {room}</span>
            <button className="btn btn-ghost" style={{fontSize:12}} onClick={() => {setRoom(''); setEntries([]); setSubmitted(false);}}>
              Leave
            </button>
          </div>

          {currentScore != null && !submitted && (
            <div className="lb-submit-card glass-card">
              <p className="lb-submit-label">Submit your score of <strong style={{color: gradeColor(currentGrade)}}>{currentScore}</strong>?</p>
              <div className="lb-submit-row">
                <input
                  className="lb-name-input"
                  placeholder="Your name"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitScore()}
                  id="username-input"
                />
                <button className="btn btn-primary" onClick={submitScore} id="submit-score-btn">
                  Submit
                </button>
              </div>
            </div>
          )}

          {submitted && (
            <div className="lb-success glass-card">
               Score submitted! You're on the board.
            </div>
          )}

          {loading ? (
            <div className="skeleton" style={{height: 120, borderRadius: 14}} />
          ) : entries.length === 0 ? (
            <div className="lb-empty glass-card">No scores yet. Be the first!</div>
          ) : (
            <div className="lb-entries">
              {entries.map((e, i) => (
                <div key={i} className={`lb-entry glass-card ${i === 0 ? 'lb-entry-first' : ''}`}>
                  <span className="lb-rank">{MEDAL[i] || `#${i + 1}`}</span>
                  <div className="lb-entry-info">
                    <span className="lb-name">{e.username}</span>
                    <span className="lb-lang">{e.language}</span>
                  </div>
                  <div className="lb-entry-score" style={{ color: gradeColor(e.grade) }}>
                    {e.score}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
