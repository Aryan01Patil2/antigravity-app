import React, { useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import './DiffViewer.css';

export default function DiffViewer({ aiAnalysis }) {
  const [copied, setCopied] = useState(false);
  const snippet = aiAnalysis?.refactored_snippet;

  if (!snippet?.before && !snippet?.after) return null;

  const { before = '', after = '', function_name = '', improvement_pct = 0 } = snippet;

  function handleCopy() {
    navigator.clipboard.writeText(after).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="diff-viewer glass-card">
      <div className="diff-header">
        <div className="diff-title-group">
          <h3 className="diff-title">Refactored Snippet</h3>
          {function_name && (
            <code className="diff-fn-name">{function_name}</code>
          )}
        </div>
        <div className="diff-actions">
          {improvement_pct > 0 && (
            <span className="improvement-badge">
              +{improvement_pct}% readability
            </span>
          )}
          <button className="btn btn-secondary diff-copy-btn" onClick={handleCopy}>
            {copied ? '✅ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div className="diff-editors">
        <div className="diff-pane">
          <div className="diff-pane-label diff-before-label">
            <span className="diff-dot diff-dot-red" />
            Before
          </div>
          <div className="diff-editor-wrap">
            <MonacoEditor
              height="260px"
              defaultLanguage="python"
              value={before}
              theme="antigravity"
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "'DM Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                padding: { top: 12 },
                wordWrap: 'on',
                renderLineHighlight: 'none',
              }}
            />
          </div>
        </div>

        <div className="diff-pane">
          <div className="diff-pane-label diff-after-label">
            <span className="diff-dot diff-dot-green" />
            After (AI Refactored)
          </div>
          <div className="diff-editor-wrap diff-after-wrap">
            <MonacoEditor
              height="260px"
              defaultLanguage="python"
              value={after}
              theme="antigravity"
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "'DM Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                padding: { top: 12 },
                wordWrap: 'on',
                renderLineHighlight: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
