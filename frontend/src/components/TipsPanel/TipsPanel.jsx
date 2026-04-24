import React, { useState } from 'react';
import './TipsPanel.css';

const SEVERITY_CONFIG = {
  critical:   { label: 'Critical',    className: 'tip-critical' },
  warning:    { label: 'Warning',     className: 'tip-warning' },
  suggestion: { label: 'Suggestion',  className: 'tip-suggestion' },
};

const EFFORT_LABEL = { low: 'Low effort', medium: 'Medium effort', high: 'High effort' };

function TipCard({ tip, index }) {
  const [open, setOpen] = useState(index === 0);
  const [showExample, setShowExample] = useState(false);
  const cfg = SEVERITY_CONFIG[tip.severity] || SEVERITY_CONFIG.suggestion;

  return (
    <div className={`tip-card glass-card ${cfg.className} ${open ? 'tip-open' : ''}`}>
      <button className="tip-header" onClick={() => setOpen(!open)}>
        <span className={`tip-severity-dot tip-dot-${tip.severity}`} />
        <span className="tip-title">{tip.title}</span>
        <div className="tip-meta">
          <span className={`badge badge-${tip.severity}`}>{cfg.label}</span>
          <span className={`effort-badge effort-${tip.effort}`}>{tip.effort}</span>
          <span className="tip-chevron">{open ? '▲' : '▽'}</span>
        </div>
      </button>
      {open && (
        <div className="tip-body animate-fade-in">
          <p className="tip-detail">{tip.detail}</p>
          <div className="tip-footer">
            {tip.category && <span className="tip-category">Category: {tip.category}</span>}
            <span className="tip-effort-label">{EFFORT_LABEL[tip.effort] || tip.effort}</span>
            {tip.example && (
              <button className="tip-example-toggle" onClick={() => setShowExample(!showExample)}>
                {showExample ? 'Hide example' : 'Show example ↓'}
              </button>
            )}
          </div>
          {showExample && tip.example && (
            <pre className="tip-example animate-fade-in">{tip.example}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function TipsPanel({ tips }) {
  if (!tips?.length) return null;

  const critical = tips.filter(t => t.severity === 'critical');
  const warnings = tips.filter(t => t.severity === 'warning');
  const suggestions = tips.filter(t => t.severity === 'suggestion');

  return (
    <div className="tips-section">
      <div className="tips-header">
        <h3 className="tips-title">Refactoring Insights</h3>
        <div className="tips-summary">
          {critical.length > 0 && <span className="badge badge-critical">{critical.length} Critical</span>}
          {warnings.length > 0 && <span className="badge badge-warning">{warnings.length} Warning</span>}
          {suggestions.length > 0 && <span className="badge badge-suggestion">{suggestions.length} Tips</span>}
        </div>
      </div>
      <div className="tips-list">
        {tips.map((tip, i) => (
          <TipCard key={tip.id || i} tip={tip} index={i} />
        ))}
      </div>
    </div>
  );
}


