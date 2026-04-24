import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import './CodeEditor.css';

const LANGUAGES = [
  { value: 'auto', label: '🔍 Auto-detect' },
  { value: 'python', label: '🐍 Python' },
  { value: 'javascript', label: '⚡ JavaScript' },
  { value: 'typescript', label: '💙 TypeScript' },
  { value: 'java', label: '☕ Java' },
  { value: 'cpp', label: '⚙️ C++' },
  { value: 'c', label: '🔩 C' },
  { value: 'go', label: '🐹 Go' },
  { value: 'rust', label: '🦀 Rust' },
  { value: 'ruby', label: '💎 Ruby' },
  { value: 'php', label: '🐘 PHP' },
];

const SAMPLE_CODE = `# ANTIGRAVITY Sample — paste your code or try this
def process_user_data(d, t, x=1):
    result = []
    for i in range(len(d)):
        if d[i] > 0:
            if d[i] > 100:
                if t == "special":
                    for j in range(d[i]):
                        if j % 2 == 0:
                            result.append(j * 3.14159 * x)
                        else:
                            result.append(j)
                else:
                    result.append(d[i] * 2)
            else:
                result.append(d[i])
        else:
            result.append(0)
    return result

def calc(a, b, c, d, e):
    return a*b + c*d - e*3600 + 86400
`;

const CodeEditor = forwardRef(function CodeEditor(
  { onCodeChange, onLanguageChange, liveData, language, onAnalyze, isAnalyzing },
  ref
) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const fileInputRef = useRef(null);
  const [lineCount, setLineCount] = useState(0);
  const [editorLanguage, setEditorLanguage] = useState('python');

  useImperativeHandle(ref, () => ({
    getValue: () => editorRef.current?.getValue() || '',
    setValue: (v) => editorRef.current?.setValue(v),
    focus: () => editorRef.current?.focus(),
  }));

  // Apply heatmap decorations from WebSocket
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !liveData?.line_data) return;

    const newDecorations = liveData.line_data
      .filter(d => d.color && d.color !== 'transparent' && d.load > 1)
      .map(d => ({
        range: new monaco.Range(d.line, 1, d.line, 1),
        options: {
          isWholeLine: true,
          className: `heatmap-line-${d.load <= 2 ? 'low' : d.load <= 5 ? 'mid' : 'high'}`,
          glyphMarginClassName: `heatmap-glyph-${d.load <= 2 ? 'low' : d.load <= 5 ? 'mid' : 'high'}`,
          minimap: { color: d.color, position: 1 },
        },
      }));

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [liveData]);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.setValue(SAMPLE_CODE);
    setLineCount(SAMPLE_CODE.split('\n').length);

    editor.onDidChangeModelContent(() => {
      const val = editor.getValue();
      setLineCount(val.split('\n').length);
      onCodeChange?.(val);
    });

    // Define ANTIGRAVITY dark theme
    monaco.editor.defineTheme('antigravity', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: '60a5fa' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'function', foreground: 'c4b5fd' },
        { token: 'variable', foreground: 'e2e8f0' },
        { token: 'type', foreground: '67e8f9' },
        { token: 'identifier', foreground: 'e2e8f0' },
      ],
      colors: {
        'editor.background': '#0d0d14',
        'editor.foreground': '#e2e8f0',
        'editorLineNumber.foreground': '#374151',
        'editorLineNumber.activeForeground': '#6b7280',
        'editor.selectionBackground': '#1e40af40',
        'editor.lineHighlightBackground': '#ffffff06',
        'editorCursor.foreground': '#60a5fa',
        'editor.findMatchBackground': '#1e3a5f80',
        'editorGutter.background': '#0d0d14',
        'editorWidget.background': '#12121f',
        'editorSuggestWidget.background': '#12121f',
        'editorSuggestWidget.border': '#ffffff10',
        'scrollbarSlider.background': '#ffffff12',
        'scrollbarSlider.hoverBackground': '#ffffff20',
      },
    });
    monaco.editor.setTheme('antigravity');
  }

  function handleLanguageChange(e) {
    const lang = e.target.value;
    setEditorLanguage(lang === 'auto' ? 'python' : lang);
    onLanguageChange?.(lang);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const code = ev.target.result;
      editorRef.current?.setValue(code);
      onCodeChange?.(code);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handlePaste() {
    navigator.clipboard.readText?.().then(text => {
      if (text) {
        editorRef.current?.setValue(text);
        onCodeChange?.(text);
      }
    }).catch(() => {
      editorRef.current?.focus();
    });
  }

  function clearEditor() {
    editorRef.current?.setValue('');
    onCodeChange?.('');
  }

  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langRef = useRef(null);

  const LANGUAGES = [
    { id: 'auto', label: 'Auto-detect', icon: '🔍' },
    { id: 'python', label: 'Python', icon: '🐍' },
    { id: 'javascript', label: 'JavaScript', icon: '⚡' },
    { id: 'typescript', label: 'TypeScript', icon: '💙' },
    { id: 'java', label: 'Java', icon: '☕' },
    { id: 'cpp', label: 'C++', icon: '⚙️' },
    { id: 'go', label: 'Go', icon: '🐹' },
    { id: 'rust', label: 'Rust', icon: '🦀' },
    { id: 'ruby', label: 'Ruby', icon: '💎' },
    { id: 'php', label: 'PHP', icon: '🐘' },
  ];

  const currentLang = LANGUAGES.find(l => l.id === language) || LANGUAGES[0];

  useEffect(() => {
    const close = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setLangDropdownOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="code-editor-container glass-card" id="code-editor-container">
      {/* ── Toolbar ────────────────── */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="mac-dots">
            <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
          </div>

          <div className="lang-selector-custom" ref={langRef}>
            <button 
              className={`lang-trigger ${langDropdownOpen ? 'active' : ''}`}
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              id="lang-selector-trigger"
            >
              <span className="lang-icon">{currentLang.icon}</span>
              <span className="lang-inner-label">{currentLang.label}</span>
              <span className="lang-chevron">▾</span>
            </button>

            {langDropdownOpen && (
              <div className="lang-dropdown glass-card animate-scale-in">
                {LANGUAGES.map(lang => (
                  <button 
                    key={lang.id}
                    className={`lang-option ${language === lang.id ? 'selected' : ''}`}
                    onClick={() => {
                      onLanguageChange(lang.id);
                      setLangDropdownOpen(false);
                    }}
                  >
                    <span className="option-icon">{lang.icon}</span>
                    <span className="option-label">{lang.label}</span>
                    {language === lang.id && <span className="option-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {lineCount > 0 && (
            <div className="editor-meta">
              <span className="meta-item">{lineCount} lines</span>
            </div>
          )}
        </div>

        <div className="editor-toolbar-right">
          <button className="editor-btn" onClick={handlePaste} title="Paste from clipboard">
            📋 Paste
          </button>
          <button className="editor-btn" onClick={() => fileInputRef.current?.click()} title="Upload file">
            📂 Upload
          </button>
          <button className="editor-btn clear-btn" onClick={clearEditor} title="Clear editor">
            ✕
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".py,.js,.ts,.java,.cpp,.c,.go,.rs,.rb,.php,.txt"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="editor-body">
        <MonacoEditor
          height="100%"
          language={editorLanguage}
          theme="antigravity"
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            fontFamily: "'DM Mono', 'Fira Code', monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
            glyphMargin: true,
            folding: true,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'line',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
            suggest: { showMethods: true, showFunctions: true },
          }}
        />
      </div>

      {/* Analyze Button */}
      <div className="editor-footer">
        <button
          className={`analyze-btn ${isAnalyzing ? 'analyzing' : ''}`}
          onClick={onAnalyze}
          disabled={isAnalyzing}
          id="analyze-button"
        >
          {isAnalyzing ? (
            <>
              <span className="spinner" />
              Analyzing...
            </>
          ) : (
            <>
              Full Analysis
            </>
          )}
        </button>
      </div>
    </div>
  );
});

export default CodeEditor;
