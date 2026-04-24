import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, PieChart, Pie, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts';
import './Dashboard.css';

const API = 'http://localhost:8000/api';
const GRADE_COLORS = { 'A+': '#30d158', A: '#34c759', B: '#0071e3', C: '#ff9f0a', D: '#ff6b3d', F: '#ff453a' };
const LANG_COLORS = ['#0071e3', '#34c759', '#ff9f0a', '#ff453a', '#bf5af2', '#64d2ff', '#ff6b3d'];

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card glass-card">
      <div className="stat-value" style={{ color: color || 'rgba(255,255,255,0.9)' }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [username, setUsername] = useState(() => localStorage.getItem('fmc_username') || '');
  const [editingName, setEditingName] = useState(!localStorage.getItem('fmc_username'));
  const [nameInput, setNameInput] = useState(username);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  function saveName() {
    const n = nameInput.trim();
    if (!n) return;
    setUsername(n);
    localStorage.setItem('fmc_username', n);
    setEditingName(false);
  }

  async function fetchStats(u) {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/stats`, { params: { username: u || '' } });
      setStats(data);
    } catch { setStats(null); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (username) fetchStats(username);
    else fetchStats('');
  }, [username]);

  const langData = stats?.languages
    ? Object.entries(stats.languages).map(([name, value]) => ({ name, value }))
    : [];

  const gradeData = stats?.grade_distribution
    ? Object.entries(stats.grade_distribution).map(([grade, count]) => ({ grade, count }))
    : [];

  function scoreColor(s) {
    if (!s) return 'rgba(255,255,255,0.4)';
    if (s >= 70) return '#34c759';
    if (s >= 45) return '#ff9f0a';
    return '#ff453a';
  }

  return (
    <div className="dashboard">
      {/* ── Profile Header ─────────────────────────────── */}
      <div className="dashboard-header glass-card">
        <div className="dash-avatar">
          {username ? username[0].toUpperCase() : '?'}
        </div>
        <div className="dash-profile">
          {editingName ? (
            <div className="dash-name-edit">
              <input
                className="dash-name-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                placeholder="Enter your name..."
                autoFocus
                id="dashboard-name-input"
              />
              <button className="btn btn-primary" onClick={saveName} id="save-name-btn">Save</button>
            </div>
          ) : (
            <div className="dash-name-row">
              <h2 className="dash-name">{username}</h2>
              <button className="btn btn-ghost btn-xs" onClick={() => setEditingName(true)}>Edit</button>
            </div>
          )}
          <div className="dash-sub">
            {stats?.total ? `${stats.total} analyses · Personal Statistics` : 'No analyses yet'}
          </div>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={() => { if (username) fetchStats(username); else fetchStats(''); }}>
          ↻ Refresh
        </button>
      </div>

      {loading && <div className="dash-loading"><div className="loading-ring" /> Loading stats...</div>}

      {stats && stats.total > 0 && (
        <>
          {/* ── Stat Cards ─────────────────────────────────── */}
          <div className="stat-cards-grid">
            <StatCard label="Analyses Run" value={stats.total} />
            <StatCard label="Avg Score" value={stats.avg_score} color={scoreColor(stats.avg_score)} sub="/ 100" />
            <StatCard label="Best Score" value={stats.best_score} color="#34c759" />
            <StatCard label="Worst Score" value={stats.worst_score} color="#ff453a" />
          </div>

          {/* ── Score Trend ────────────────────────────────── */}
          {stats.score_trend?.length > 1 && (
            <div className="dash-chart-card glass-card">
              <div className="dash-chart-title">Score Trend</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={stats.score_trend} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.4)' }}
                    itemStyle={{ color: '#60adff' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#0071e3" strokeWidth={2}
                    dot={{ fill: '#0071e3', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: '#60adff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Language + Grade breakdown ─────────────────── */}
          <div className="dash-breakdown-grid">
            {langData.length > 0 && (
              <div className="dash-chart-card glass-card">
                <div className="dash-chart-title">Languages Used</div>
                <div className="dash-pie-wrap">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={langData} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                        dataKey="value" paddingAngle={3}>
                        {langData.map((_, i) => (
                          <Cell key={i} fill={LANG_COLORS[i % LANG_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="dash-legend">
                    {langData.map((d, i) => (
                      <div key={i} className="dash-legend-item">
                        <span className="dash-legend-dot" style={{ background: LANG_COLORS[i % LANG_COLORS.length] }} />
                        <span className="dash-legend-name">{d.name}</span>
                        <span className="dash-legend-val">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {gradeData.length > 0 && (
              <div className="dash-chart-card glass-card">
                <div className="dash-chart-title">Grade Distribution</div>
                <div className="dash-grade-bars">
                  {gradeData.sort((a, b) => Object.keys(GRADE_COLORS).indexOf(a.grade) - Object.keys(GRADE_COLORS).indexOf(b.grade))
                    .map(({ grade, count }) => (
                    <div key={grade} className="dash-grade-row">
                      <span className="dash-grade-label" style={{ color: GRADE_COLORS[grade] || '#fff' }}>{grade}</span>
                      <div className="dash-grade-bar-track">
                        <div className="dash-grade-bar-fill"
                          style={{ width: `${(count / stats.total) * 100}%`, background: GRADE_COLORS[grade] || '#666' }} />
                      </div>
                      <span className="dash-grade-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {stats && stats.total === 0 && !loading && (
        <div className="dash-empty glass-card">
          No analyses found. Run your first analysis to see stats here.
        </div>
      )}
    </div>
  );
}
