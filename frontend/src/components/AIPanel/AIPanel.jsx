import React, { useState } from 'react';
import './AIPanel.css';

export default function AIPanel({ aiAnalysis }) {
  const [activeTab, setActiveTab] = useState('summary');
  if (!aiAnalysis) return null;

  const { executive_summary, developer_insights, cognitive_map, quick_wins, refactored_snippet } = aiAnalysis;

  const TABS = [
    { id: 'summary',  label: '📋 Summary' },
    { id: 'insights', label: '🔍 Deep Dive' },
    { id: 'cogmap',   label: '🧠 Cog. Map' },
    { id: 'wins',     label: '⚡ Quick Wins' },
  ];

  const severityIcon = { critical: '🔴', warning: '🟡', info: '🟢' };

  return (
    <div className="ai-panel glass-card">
      <div className="ai-header">
        <div className="ai-title-row">
          <span className="ai-spark">✦</span>
          <h3 className="ai-title">AI Code Intelligence</h3>
          <span className="ai-model-badge">llama3-70b</span>
        </div>
        <div className="ai-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`ai-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-content">
        {activeTab === 'summary' && (
          <div className="ai-summary animate-fade-in">
            <div className="summary-quote">
              <span className="quote-mark">"</span>
              <p>{executive_summary || 'No summary available.'}</p>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="ai-insights animate-fade-in">
            {(developer_insights || []).map((insight, i) => (
              <div key={i} className={`insight-card insight-${insight.severity}`}>
                <div className="insight-header">
                  <span>{severityIcon[insight.severity] || '🟢'}</span>
                  <span className="insight-issue">{insight.issue}</span>
                  {insight.line_ref && (
                    <code className="insight-line">{insight.line_ref}</code>
                  )}
                </div>
                <p className="insight-reason">{insight.reasoning}</p>
              </div>
            ))}
            {(!developer_insights || developer_insights.length === 0) && (
              <p className="ai-empty">No developer insights returned.</p>
            )}
          </div>
        )}

        {activeTab === 'cogmap' && (
          <div className="ai-cogmap animate-fade-in">
            {(cognitive_map || []).map((fn, i) => (
              <div key={i} className="cogmap-item">
                <div className="cogmap-header">
                  <code className="cogmap-fn">{fn.function_name}</code>
                  <div className="cogmap-load-bar">
                    <div
                      className="cogmap-load-fill"
                      style={{
                        width: `${(fn.load_score / 10) * 100}%`,
                        background: fn.load_score <= 3 ? '#34c759' : fn.load_score <= 6 ? '#ff9f0a' : '#ff3b30',
                      }}
                    />
                  </div>
                  <span className="cogmap-score">{fn.load_score}/10</span>
                </div>
                <p className="cogmap-reason">{fn.reason}</p>
              </div>
            ))}
            {(!cognitive_map || cognitive_map.length === 0) && (
              <p className="ai-empty">No functions detected to map.</p>
            )}
          </div>
        )}

        {activeTab === 'wins' && (
          <div className="ai-wins animate-fade-in">
            {(quick_wins || []).map((win, i) => (
              <div key={i} className="win-card glass-card">
                <div className="win-header">
                  <span className="win-num">{i + 1}</span>
                  <span className="win-title">{win.title}</span>
                  <span className="win-time">{win.time_estimate}</span>
                </div>
                <p className="win-action">{win.action}</p>
              </div>
            ))}
            {(!quick_wins || quick_wins.length === 0) && (
              <p className="ai-empty">No quick wins generated.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
