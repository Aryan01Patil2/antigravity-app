import { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export function useAnalysis() {
  const [state, setState] = useState('idle'); // idle | analyzing | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const analyze = useCallback(async ({ code, language = 'auto', enableAi = true, sessionTag = null }) => {
    if (!code?.trim()) return;
    setState('analyzing');
    setError(null);
    setProgress(0);

    // Simulate progress while waiting
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + (p < 60 ? 8 : p < 85 ? 3 : 1), 90));
    }, 200);

    try {
      const { data } = await axios.post(`${API_BASE}/analyze`, {
        code,
        language,
        enable_ai: enableAi,
        session_tag: sessionTag,
      });
      clearInterval(progressInterval);
      setProgress(100);
      setResult(data);
      setState('done');
    } catch (e) {
      clearInterval(progressInterval);
      setError(e?.response?.data?.detail || e.message || 'Analysis failed');
      setState('error');
      setProgress(0);
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  return { state, result, error, progress, analyze, reset };
}
