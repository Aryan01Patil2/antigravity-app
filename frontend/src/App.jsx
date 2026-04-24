import React, { useRef, useState, useCallback, useEffect } from 'react';
import './styles/tokens.css';
import './App.css';

import CodeEditor from './components/Editor/CodeEditor';
import ScorePanel from './components/ScorePanel/ScorePanel';
import MetricsGrid from './components/MetricsGrid/MetricsGrid';
import TipsPanel from './components/TipsPanel/TipsPanel';
import AIPanel from './components/AIPanel/AIPanel';
import DiffViewer from './components/DiffViewer/DiffViewer';
import BrainWave from './components/BrainWave/BrainWave';
import CodeDNA from './components/CodeDNA/CodeDNA';
import ChatPanel from './components/ChatPanel/ChatPanel';
import History from './components/History/History';
import Leaderboard from './components/Leaderboard/Leaderboard';
import RepoAnalyzer from './components/RepoAnalyzer/RepoAnalyzer';
import Dashboard from './components/Dashboard/Dashboard';
import ExportMenu from './components/ExportMenu/ExportMenu';

import { useAnalysis } from './hooks/useAnalysis';
import { useWebSocket } from './hooks/useWebSocket';
import { useDebounce } from './hooks/useDebounce';

// ── Environment Configuration ──────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ── Nav sections
const NAV_SECTIONS = ['analysis', 'history', 'room', 'dashboard'];

const ANALYSIS_SUBMENU = [
  { id: 'paste',  label: 'Paste Code',   icon: '⌨', desc: 'Type or paste code into the editor' },
  { id: 'file',   label: 'Upload File',   icon: '📄', desc: 'Upload a source file from disk' },
  { id: 'github', label: 'GitHub Repo',   icon: '⬡', desc: 'Analyze a public GitHub repository' },
  { id: 'batch',  label: 'ZIP Batch',     icon: '📦', desc: 'Upload a ZIP to analyze all files' },
];

export default function App() {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const [language, setLanguage] = useState('auto');
  const [enableAI, setEnableAI] = useState(true);
  const [sessionTag, setSessionTag] = useState('');
  const [batchResult, setBatchResult] = useState(null); // Added state to support the batch fetch

  // Active tab for main content area
  const [activeTab, setActiveTab] = useState('paste'); // paste | github | batch

  // Nav dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const { state, result, error, progress, analyze, reset } = useAnalysis();
  const { connected, liveData, send: wsSend } = useWebSocket();

  const sendLiveAnalysis = useCallback((code) => { wsSend(code, language); }, [wsSend, language]);
  const { debounced: debouncedSend } = useDebounce(sendLiveAnalysis, 600);

  function handleCodeChange(code) { debouncedSend(code); }

  function handleAnalyze() {
    const code = editorRef.current?.getValue();
    if (!code?.trim()) return;
    analyze({ code, language, enableAi: enableAI, sessionTag: sessionTag || null });
  }

  // Load a session into the editor
  function handleLoadSession(session) {
    if (!session?.code_snippet) return;
    editorRef.current?.setValue(session.code_snippet);
    setActiveTab('paste');
    reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // File upload
  async function handleFileUpload(file) {
    if (!file) return;
    const text = await file.text();
    editorRef.current?.setValue(text);
    setActiveTab('paste');
  }

  // Click outside dropdown closes it
  useEffect(() => {
    function close(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  const liveScore = liveData?.score ?? null;
  const displayScore = result?.readability_score ?? liveScore;
  const currentCode = editorRef.current?.getValue?.() || '';

  return (
    <>
      {/* ── Background Orbs ─────────────────────────────────── */}
      <div className="bg-orbs" aria-hidden="true">
        <div className="bg-orb orb-1" /><div className="bg-orb orb-2" />
        <div className="bg-orb orb-3" /><div className="bg-orb orb-4" />
      </div>

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="navbar" id="top-nav">
        <div className="nav-container">

          {/* Logo */}
          <a href="#" className="nav-logo" onClick={e => { e.preventDefault(); reset(); setActiveTab('paste'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <span className="logo-mark">⚡</span>
            <span className="logo-text">FixMyCode</span>
          </a>

          {/* Nav links */}
          <div className="nav-links">

            {/* Analysis dropdown */}
            <div className="nav-dropdown-wrap" ref={dropdownRef}
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}>
              <button
                className={`nav-link ${['paste','file','github','batch'].includes(activeTab) ? 'nav-link-active' : ''}`}
                id="nav-analysis-btn"
              >
                Analysis <span className="nav-chevron">▾</span>
              </button>
              {dropdownOpen && (
                <div className="nav-dropdown glass-card">
                  <div className="nav-dropdown-title">Analyze Code</div>
                  {ANALYSIS_SUBMENU.map(item => (
                    <button
                      key={item.id}
                      className={`nav-dropdown-item ${activeTab === item.id ? 'active' : ''}`}
                      onClick={() => { setActiveTab(item.id); setDropdownOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      id={`nav-${item.id}-btn`}
                    >
                      <span className="nav-item-icon">{item.icon}</span>
                      <div className="nav-item-text">
                        <span className="nav-item-label">{item.label}</span>
                        <span className="nav-item-desc">{item.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="nav-link" onClick={() => scrollTo('section-history')} id="nav-history-btn">History</button>
            <button className="nav-link" onClick={() => scrollTo('section-room')} id="nav-room-btn">Room</button>
            <button className="nav-link" onClick={() => scrollTo('section-dashboard')} id="nav-dashboard-btn">Dashboard</button>
          </div>

          {/* Center: live indicator */}
          <div className="nav-center">
            <div className={`live-indicator ${connected ? 'live-on' : 'live-off'}`}>
              <span className="live-dot" />
              {connected ? 'Live Autopsy' : 'Offline'}
            </div>
            {liveData?.score != null && state !== 'done' && (
              <div className="nav-live-score">
                <span style={{ color: liveData.score >= 70 ? '#34c759' : liveData.score >= 45 ? '#ff9f0a' : '#ff3b30' }}>
                  {liveData.score}
                </span>
              </div>
            )}
          </div>

          {/* Right: AI toggle */}
          <div className="nav-actions">
            <label className="toggle-row" title="Toggle AI Analysis">
              <span className="toggle-label">AI</span>
              <input type="checkbox" className="toggle-input" checked={enableAI}
                onChange={e => setEnableAI(e.target.checked)} id="ai-toggle" />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
            </label>
          </div>
        </div>

        {/* Progress bar */}
        {state === 'analyzing' && (
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <header className="hero section">
        <div className="container hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
             Real-time · Multi-language
          </div>
          <h1 className="hero-title">
            Code that reads<br />
            <span className="text-gradient-blue">itself. Finally.</span>
          </h1>
          <p className="hero-sub">
            FixMyCode measures the <em>cognitive cost</em> of your code — nesting depth,
            cyclomatic complexity, naming clarity, documentation. Then it shows you exactly
            how to fix it. In real time.
          </p>
        </div>
      </header>

      {/* ── Mode Tab Bar ────────────────────────────────────── */}
      <section className="main-section section">
        <div className="container">
          <div className="mode-tab-bar">
            {ANALYSIS_SUBMENU.map(item => (
              <button
                key={item.id}
                className={`mode-tab ${activeTab === item.id ? 'mode-tab-active' : ''}`}
                onClick={() => { setActiveTab(item.id); reset(); }}
                id={`mode-tab-${item.id}`}
              >
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </div>

          {/* ── PASTE / FILE tab ─────── */}
          {(activeTab === 'paste' || activeTab === 'file') && (
            <>
              {activeTab === 'file' && (
                <div className="file-upload-banner glass-card">
                  <span className="file-upload-icon">📄</span>
                  <div className="file-upload-text">
                    <strong>Upload a source file</strong>
                    <p>Supported: .py .js .ts .java .cpp .c .go .rs .rb .php</p>
                  </div>
                  <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}
                    id="file-upload-browse-btn">
                    Browse
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden-input"
                    accept=".py,.js,.ts,.java,.cpp,.c,.go,.rs,.rb,.php,.txt"
                    onChange={e => { handleFileUpload(e.target.files[0]); setActiveTab('paste'); }}
                    id="file-upload-input"
                  />
                </div>
              )}

              <div className="session-tag-row">
                <input className="session-tag-input" placeholder="Session label (optional)"
                  value={sessionTag} onChange={e => setSessionTag(e.target.value)}
                  id="session-tag-input"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  {result && <ExportMenu code={currentCode} result={result} language={language} />}
                  {state === 'done' && (
                    <button className="btn btn-ghost" onClick={() => { reset(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} id="reset-btn">✕ New</button>
                  )}
                </div>
              </div>

              <div className="editor-analysis-grid">
                <div className="editor-column">
                  <CodeEditor
                    ref={editorRef}
                    onCodeChange={handleCodeChange}
                    onLanguageChange={setLanguage}
                    liveData={liveData}
                    language={language}
                    onAnalyze={handleAnalyze}
                    isAnalyzing={state === 'analyzing'}
                  />
                </div>
                <div className="results-column">
                  <ScorePanel result={result} isLoading={state === 'analyzing'} />
                  <BrainWave score={displayScore} liveData={liveData} />
                  {result && <CodeDNA dnaBase64={result.code_dna} />}
                </div>
              </div>

              {state === 'error' && error && (
                <div className="error-banner glass-card animate-fade-in">⚠ {error}</div>
              )}
            </>
          )}

          {/* ── GITHUB tab ────────────── */}
          {activeTab === 'github' && (
            <RepoAnalyzer onFileLoad={(fileResult) => {
              // Could load file content if we had it; for now show score
            }} />
          )}

          {/* ── BATCH tab ─────────────── */}
          {activeTab === 'batch' && (
            <div className="batch-upload-zone glass-card">
              <div className="batch-icon">📦</div>
              <h3 className="batch-title">ZIP Batch Analyzer</h3>
              <p className="batch-desc">Upload a .zip archive to analyze all source files at once and get a project health score.</p>
              <button className="btn btn-primary" onClick={() => batchInputRef.current?.click()}
                id="batch-upload-btn">
                Upload ZIP
              </button>
              <input ref={batchInputRef} type="file" className="hidden-input" accept=".zip"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    // Replaced localhost with API_BASE_URL
                    const resp = await fetch(`${API_BASE_URL}/api/analyze/batch`, { method: 'POST', body: formData });
                    const data = await resp.json();
                    setBatchResult(data);
                  } catch (err) { console.error(err); }
                }}
                id="batch-file-input"
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Results sections ─────────────────────────────────── */}
      {state === 'done' && result && (
        <>
          <div className="divider" />
          <section className="section">
            <div className="container">
              <MetricsGrid metrics={result.metrics} />
            </div>
          </section>

          <div className="divider" />

          <section className="section">
            <div className="container results-dual">
              <div className="results-left">
                <TipsPanel tips={result.rule_tips} />
              </div>
              <div className="results-right">
                {result.ai_analysis && <AIPanel aiAnalysis={result.ai_analysis} />}
              </div>
            </div>
          </section>

          <div className="divider" />

          {result.ai_analysis?.refactored_snippet?.after && (
            <section className="section">
              <div className="container">
                <DiffViewer aiAnalysis={result.ai_analysis} />
              </div>
            </section>
          )}

          <section className="section" style={{ paddingTop: 0 }}>
            <div className="container">
              <ChatPanel sessionId={result.session_id} result={result} />
            </div>
          </section>
        </>
      )}

      <div className="divider" />

      {/* ── History ─────────────────────────────────── */}
      <section className="section" id="section-history">
        <div className="container">
          <History onLoad={handleLoadSession} />
        </div>
      </section>

      <div className="divider" />

      {/* ── Room / Leaderboard ──────────────────────── */}
      <section className="section" id="section-room">
        <div className="container">
          <Leaderboard
            currentScore={result?.readability_score}
            currentGrade={result?.grade}
            currentLanguage={result?.language}
            currentSessionId={result?.session_id}
          />
        </div>
      </section>

      <div className="divider" />

      {/* ── Dashboard ───────────────────────────────── */}
      <section className="section" id="section-dashboard">
        <div className="container">
          <Dashboard />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="footer">
        <div className="container footer-content">
          <span className="footer-logo">⚡ FixMyCode</span>
          <span className="footer-sub">Code Clarity · AI-Powered · Real-time</span>
          <span className="footer-copy">Built with Groq · FastAPI · React</span>
        </div>
      </footer>
    </>
  );
}
