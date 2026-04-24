import React, { useState, useRef, useEffect } from 'react';
import './ExportMenu.css';

export default function ExportMenu({ code, result, language }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function close(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const EXT_MAP = {
    python: 'py', javascript: 'js', typescript: 'ts', java: 'java',
    cpp: 'cpp', c: 'c', go: 'go', rust: 'rs', ruby: 'rb', php: 'php',
  };

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    setOpen(false);
  }

  function downloadCode() {
    if (!code) return;
    const ext = EXT_MAP[language] || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `code.${ext}`;
    a.click();
    setOpen(false);
  }

  function downloadJSON() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analysis_${result.session_id?.slice(0, 8) || 'result'}.json`;
    a.click();
    setOpen(false);
  }

  function printReport() {
    window.print();
    setOpen(false);
  }

  const actions = [
    { id: 'copy-code', label: copied ? '✓ Copied!' : 'Copy Code', icon: '📋', fn: copyCode, disabled: !code },
    { id: 'download-file', label: `Download .${EXT_MAP[language] || 'txt'}`, icon: '⬇', fn: downloadCode, disabled: !code },
    { id: 'export-json', label: 'Export Analysis JSON', icon: '{ }', fn: downloadJSON, disabled: !result },
    { id: 'print-report', label: 'Print / Save PDF', icon: '🖨', fn: printReport, disabled: !result },
  ];

  return (
    <div className="export-menu-wrap" ref={menuRef}>
      <button
        className="btn btn-ghost export-trigger"
        onClick={() => setOpen(!open)}
        id="export-menu-btn"
      >
        ⬆ Export
      </button>
      {open && (
        <div className="export-dropdown glass-card animate-fade-in">
          {actions.map(a => (
            <button
              key={a.id}
              className="export-item"
              onClick={a.fn}
              disabled={a.disabled}
              id={a.id}
            >
              <span className="export-item-icon">{a.icon}</span>
              <span className="export-item-label">{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
