import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import './SessionModal.css';

const API = 'http://localhost:8000/api';

function gradeColor(score) {
  if (score >= 80) return '#34c759';
  if (score >= 60) return '#0071e3';
  if (score >= 45) return '#ff9f0a';
  return '#ff453a';
}

const SEVERITY_ICON = { critical: '🔴', warning: '🟡', suggestion: '🟢' };

export default function SessionModal({ session, onClose, onLoadInEditor, onDelete }) {
  const overlayRef = useRef(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!session) return null;

  const { readability_score: score, grade, language, timestamp, session_tag,
          metrics, dimension_scores, rule_tips, ai_analysis, code_snippet, session_id } = session;

  const dims = [
    { key: 'naming', label: 'Naming' },
    { key: 'structure', label: 'Structure' },
    { key: 'complexity', label: 'Complexity' },
    { key: 'documentation', label: 'Docs' },
    { key: 'consistency', label: 'Consistency' },
    { key: 'modularity', label: 'Modularity' },
  ];

  async function handleDelete() {
    setDeleting(true);
    try {
      await axios.delete(`${API}/sessions/${session_id}`);
      onDelete?.(session_id);
      onClose();
    } catch { setDeleting(false); }
  }

  function handleExportJSON() {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `session_${session_id.slice(0, 8)}.json`;
    a.click();
  }

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={e => e.target === overlayRef.current && onClose()}>
      <div className="modal-panel glass-card animate-fade-in">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-grade" style={{ color: gradeColor(score), borderColor: gradeColor(score) + '40' }}>
              {grade}
            </span>
            <div>
              <div className="modal-score" style={{ color: gradeColor(score) }}>{score}<span className="modal-score-sub">/100</span></div>
              <div className="modal-meta">
                <span className="modal-lang">{language}</span>
                <span className="modal-tag">{session_tag || 'Untitled'}</span>
                <span className="modal-date">{new Date(timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="modal-header-actions">
            {onLoadInEditor && (
              <button className="btn btn-primary modal-action-btn" onClick={() => { onLoadInEditor(session); onClose(); }}
                id="load-in-editor-btn">
                Load in Editor
              </button>
            )}
            <button className="btn btn-ghost modal-action-btn" onClick={handleExportJSON}
              id="export-session-json-btn">
              Export JSON
            </button>
            <button className="btn btn-danger modal-action-btn" onClick={handleDelete} disabled={deleting}
              id="delete-session-btn">
              {deleting ? '...' : 'Delete'}
            </button>
            <button className="modal-close" onClick={onClose} id="modal-close-btn">✕</button>
          </div>
        </div>

        <div className="modal-body">
          {/* Code snippet */}
          {code_snippet && (
            <div className="modal-snippet">
              <div className="modal-section-label">Code Preview</div>
              <pre className="modal-code">{code_snippet}</pre>
            </div>
          )}

          {/* Dimension bars */}
          {dimension_scores && (
            <div className="modal-dims">
              <div className="modal-section-label">Dimension Scores</div>
              <div className="modal-dims-grid">
                {dims.map(({ key, label }) => {
                  const val = dimension_scores[key] ?? 0;
                  const c = gradeColor(val);
                  return (
                    <div key={key} className="modal-dim-item">
                      <div className="modal-dim-header">
                        <span className="modal-dim-label">{label}</span>
                        <span style={{ color: c, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{val}</span>
                      </div>
                      <div className="modal-dim-track">
                        <div className="modal-dim-fill" style={{ width: `${val}%`, background: c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key metrics */}
          {metrics && (
            <div className="modal-metrics">
              <div className="modal-section-label">Metrics</div>
              <div className="modal-metrics-grid">
                {[
                  ['Lines', metrics.line_count],
                  ['Functions', metrics.function_count],
                  ['Classes', metrics.class_count],
                  ['Nesting', metrics.max_nesting_depth],
                  ['CC', metrics.cyclomatic_complexity],
                  ['Imports', metrics.import_count],
                  ['TODO/FIXME', metrics.todo_count],
                  ['Long Lines', metrics.long_lines_count],
                ].map(([label, val]) => (
                  <div key={label} className="modal-metric-chip">
                    <span className="modal-chip-val">{val ?? '—'}</span>
                    <span className="modal-chip-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rule tips */}
          {rule_tips?.length > 0 && (
            <div className="modal-tips">
              <div className="modal-section-label">Insights ({rule_tips.length})</div>
              <div className="modal-tips-list">
                {rule_tips.map((tip, i) => (
                  <div key={i} className={`modal-tip-row modal-tip-${tip.severity}`}>
                    <span>{SEVERITY_ICON[tip.severity]}</span>
                    <span className="modal-tip-title">{tip.title}</span>
                    <span className={`badge badge-${tip.severity}`}>{tip.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI summary */}
          {ai_analysis?.executive_summary && (
            <div className="modal-ai-summary">
              <div className="modal-section-label">AI Summary</div>
              <p className="modal-ai-text">{ai_analysis.executive_summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
