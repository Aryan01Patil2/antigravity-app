import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './RepoAnalyzer.css';

const API = 'http://localhost:8000/api';

function gradeColor(score) {
  if (score >= 80) return '#34c759';
  if (score >= 60) return '#0071e3';
  if (score >= 45) return '#ff9f0a';
  return '#ff453a';
}

function ScoreBar({ score }) {
  return (
    <div className="repo-score-bar-wrap">
      <div
        className="repo-score-bar-fill"
        style={{ width: `${score}%`, background: gradeColor(score) }}
      />
    </div>
  );
}

export default function RepoAnalyzer({ onFileLoad }) {
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | fetching-tree | analyzing | done | error
  const [treeFiles, setTreeFiles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [expandedFile, setExpandedFile] = useState(null);

  async function fetchTree() {
    if (!url.trim()) return;
    setPhase('fetching-tree');
    setError('');
    try {
      const { data } = await axios.get(`${API}/repo/tree`, {
        params: { repo_url: url, branch, github_token: token || undefined },
      });
      setTreeFiles(data.files || []);
      setSelected(new Set(data.files.slice(0, 10).map(f => f.path)));
      setPhase(data.files.length > 0 ? 'tree' : 'error');
      if (data.files.length === 0) setError('No supported source files found.');
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch repo tree.');
      setPhase('error');
    }
  }

  async function runAnalysis() {
    setPhase('analyzing');
    setError('');
    const formData = new FormData();
    formData.append('repo_url', url);
    formData.append('branch', branch);
    formData.append('file_paths', Array.from(selected).join(','));
    if (token) formData.append('github_token', token);

    try {
      const { data } = await axios.post(`${API}/analyze/github`, formData);
      setResult(data);
      setPhase('done');
    } catch (e) {
      setError(e.response?.data?.detail || 'Analysis failed.');
      setPhase('error');
    }
  }

  function toggleFile(path) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(treeFiles.map(f => f.path))); }
  function selectNone() { setSelected(new Set()); }

  const score = result?.project_health_score ?? 0;

  return (
    <div className="repo-analyzer">
      {/* ── URL Input ─────────────── */}
      <div className="repo-input-section glass-card">
        <div className="repo-input-header">
          <span className="repo-icon">📦</span>
          <h3 className="repo-title">GitHub Repository Analyzer</h3>
        </div>
        <div className="repo-url-row">
          <input
            className="repo-url-input"
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={e => { setUrl(e.target.value); setPhase('idle'); setResult(null); }}
            onKeyDown={e => e.key === 'Enter' && fetchTree()}
            id="repo-url-input"
          />
          <input
            className="repo-branch-input"
            placeholder="main"
            value={branch}
            onChange={e => setBranch(e.target.value)}
            id="repo-branch-input"
          />
          <button
            className="btn btn-primary"
            onClick={fetchTree}
            disabled={!url.trim() || phase === 'fetching-tree'}
            id="fetch-tree-btn"
          >
            {phase === 'fetching-tree' ? '...' : 'Fetch Files'}
          </button>
        </div>

        <div className="repo-token-row">
          <button className="repo-token-toggle" onClick={() => setShowToken(!showToken)}>
            {showToken ? '▲' : '▼'} GitHub Token (optional, for rate limits)
          </button>
          {showToken && (
            <input
              className="repo-token-input"
              type="password"
              placeholder="ghp_xxxx..."
              value={token}
              onChange={e => setToken(e.target.value)}
              id="github-token-input"
            />
          )}
        </div>
      </div>

      {/* ── File Tree ─────────────── */}
      {(phase === 'tree' || phase === 'analyzing') && treeFiles.length > 0 && (
        <div className="repo-tree glass-card">
          <div className="repo-tree-header">
            <span className="repo-tree-label">{treeFiles.length} source files found</span>
            <div className="repo-tree-actions">
              <button className="btn btn-ghost btn-xs" onClick={selectAll}>All</button>
              <button className="btn btn-ghost btn-xs" onClick={selectNone}>None</button>
              <button
                className="btn btn-primary"
                onClick={runAnalysis}
                disabled={selected.size === 0 || phase === 'analyzing'}
                id="analyze-selected-btn"
              >
                {phase === 'analyzing' ? 'Analyzing...' : `Analyze ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
          <div className="repo-file-list">
            {treeFiles.map(f => (
              <label key={f.path} className={`repo-file-item ${selected.has(f.path) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(f.path)}
                  onChange={() => toggleFile(f.path)}
                  className="repo-file-check"
                />
                <span className="repo-file-path">{f.path}</span>
                <span className="repo-file-size">{(f.size / 1024).toFixed(1)}kb</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ───────────────── */}
      {phase === 'done' && result && (
        <div className="repo-results animate-fade-in">
          {/* Health score banner */}
          <div className="repo-health-banner glass-card">
            <div className="repo-health-left">
              <div className="repo-health-repo">{result.repo}</div>
              <div className="repo-health-meta">
                Branch: <code>{result.branch}</code> · {result.file_count} files · {result.total_lines_analyzed.toLocaleString()} lines
              </div>
            </div>
            <div className="repo-health-score" style={{ color: gradeColor(score) }}>
              {score}
              <span className="repo-health-label">/ 100</span>
            </div>
          </div>

          {/* Best / Worst */}
          <div className="repo-highlights">
            <div className="repo-highlight glass-card repo-best">
              <div className="highlight-label">Best File</div>
              <div className="highlight-file">{result.best_file.name}</div>
              <div className="highlight-score" style={{ color: '#34c759' }}>{result.best_file.score}</div>
            </div>
            <div className="repo-highlight glass-card repo-worst">
              <div className="highlight-label">Needs Most Attention</div>
              <div className="highlight-file">{result.worst_file.name}</div>
              <div className="highlight-score" style={{ color: '#ff453a' }}>{result.worst_file.score}</div>
            </div>
          </div>

          {/* File breakdown */}
          <div className="repo-file-results glass-card">
            <div className="repo-results-header">File Breakdown</div>
            {result.files.map((f, i) => (
              <div key={i} className={`repo-result-row ${expandedFile === i ? 'expanded' : ''}`}
                onClick={() => setExpandedFile(expandedFile === i ? null : i)}>
                <div className="repo-result-main">
                  <span className="repo-result-name">{f.filename}</span>
                  <span className="repo-result-lang">{f.language}</span>
                  <ScoreBar score={f.score} />
                  <span className="repo-result-score" style={{ color: gradeColor(f.score) }}>{f.score}</span>
                  <span className="repo-result-grade" style={{ color: gradeColor(f.score) }}>{f.grade}</span>
                  <a href={f.github_url} target="_blank" rel="noreferrer" className="repo-gh-link"
                    onClick={e => e.stopPropagation()}>↗</a>
                  {onFileLoad && (
                    <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); onFileLoad(f); }}>
                      Load
                    </button>
                  )}
                </div>
                {expandedFile === i && f.top_tips.length > 0 && (
                  <div className="repo-result-tips animate-fade-in">
                    {f.top_tips.map((tip, j) => (
                      <div key={j} className={`repo-tip-row tip-${tip.severity}`}>
                        <span className="repo-tip-title">{tip.title}</span>
                        <span className={`badge badge-${tip.severity}`}>{tip.severity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="repo-error glass-card animate-fade-in">⚠ {error}</div>
      )}
    </div>
  );
}
