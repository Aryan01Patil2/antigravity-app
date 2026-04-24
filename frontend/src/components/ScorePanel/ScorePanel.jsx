import React, { useEffect, useRef, useState } from 'react';
import './ScorePanel.css';

const GRADE_COLORS = {
  'A+': '#30d158', A: '#34c759', B: '#0071e3',
  C: '#ff9f0a', D: '#ff6b3d', F: '#ff3b30',
};

function getScoreColor(score) {
  if (score >= 86) return '#30d158';
  if (score >= 66) return '#0071e3';
  if (score >= 41) return '#ff9f0a';
  return '#ff453a';
}

function AnimatedCounter({ target, duration = 1500 }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef();
  const startRef = useRef();
  const startValRef = useRef(0);

  useEffect(() => {
    const from = startValRef.current;
    startRef.current = null;

    function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      setVal(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startValRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return val;
}

function ScoreCircle({ score }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const color = getScoreColor(score);
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg className="score-svg" width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx="100" cy="100" r={radius} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      {/* Progress */}
      <circle cx="100" cy="100" r={radius} fill="none"
        stroke="url(#scoreGrad)" strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 100 100)"
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.25,0.46,0.45,0.94)', filter: 'url(#glow)' }}
      />
    </svg>
  );
}

export default function ScorePanel({ result, isLoading }) {
  if (isLoading) {
    return (
      <div className="score-panel glass-card">
        <div className="score-loading">
          <div className="loading-ring" />
          <p>Analyzing code…</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="score-panel glass-card score-panel-empty">
        <div className="score-empty-content">
          <h3>Ready to Analyze</h3>
          <p>Paste code in the editor and hit Full Analysis to get your readability score.</p>
        </div>
      </div>
    );
  }

  const { readability_score: score, grade, dimension_scores, language, processing_time_ms } = result;
  const color = getScoreColor(score);
  const gradeColor = GRADE_COLORS[grade] || '#ffffff';

  const dimensions = [
    { key: 'naming', label: 'Naming' },
    { key: 'structure', label: 'Structure' },
    { key: 'complexity', label: 'Complexity' },
    { key: 'documentation', label: 'Docs' },
    { key: 'consistency', label: 'Consistency' },
    { key: 'modularity', label: 'Modularity' },
  ];

  return (
    <div className="score-panel glass-card animate-fade-up">
      {/* Main Score */}
      <div className="score-hero">
        <div className="score-circle-wrapper">
          <ScoreCircle score={score} />
          <div className="score-center">
            <span className="score-number" style={{ color }}>
              <AnimatedCounter target={score} />
            </span>
            <span className="score-label">/ 100</span>
          </div>
        </div>

        <div className="score-meta">
          <div className="grade-badge" style={{ background: `${gradeColor}20`, color: gradeColor, borderColor: `${gradeColor}40` }}>
            {grade}
          </div>
          <div className="score-detail-row">
            <span className="lang-chip">{language}</span>
            <span className="time-chip">{processing_time_ms}ms</span>
          </div>
        </div>
      </div>

      {/* Dimension Breakdown */}
      <div className="dimensions-section">
        <h4 className="section-label">Dimension Scores</h4>
        <div className="dimensions-grid">
          {dimensions.map(({ key, label }) => {
            const val = dimension_scores?.[key] ?? 0;
            const dimColor = getScoreColor(val);
            return (
              <div className="dim-item" key={key}>
                <div className="dim-header">
                  <span className="dim-label">{label}</span>
                  <span className="dim-val" style={{ color: dimColor }}>{val}</span>
                </div>
                <div className="dim-bar-track">
                  <div
                    className="dim-bar-fill"
                    style={{
                      width: `${val}%`,
                      background: dimColor,
                      transition: 'width 1.2s cubic-bezier(0.25,0.46,0.45,0.94)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
