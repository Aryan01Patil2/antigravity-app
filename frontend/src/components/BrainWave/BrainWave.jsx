import React, { useEffect, useRef } from 'react';
import './BrainWave.css';

export default function BrainWave({ score, liveData }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef(0);
  const targetAmplitudeRef = useRef(20);
  const currentAmplitudeRef = useRef(20);

  useEffect(() => {
    // Map score to amplitude: low score = spiky, high score = calm
    const amplitude = score != null
      ? Math.max(5, (100 - score) * 0.6)
      : 20;
    targetAmplitudeRef.current = amplitude;
  }, [score, liveData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Smooth amplitude transition
      const target = targetAmplitudeRef.current;
      const curr = currentAmplitudeRef.current;
      currentAmplitudeRef.current = curr + (target - curr) * 0.04;
      const amp = currentAmplitudeRef.current;

      phaseRef.current += 0.03;

      // Determine color
      let waveColor;
      const s = score ?? 50;
      if (s >= 70) waveColor = '#34c759';
      else if (s >= 45) waveColor = '#ff9f0a';
      else waveColor = '#ff3b30';

      // Glow
      const grd = ctx.createLinearGradient(0, 0, W, 0);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(0.5, waveColor);
      grd.addColorStop(1, 'transparent');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2;
      ctx.shadowColor = waveColor;
      ctx.shadowBlur = amp > 30 ? 12 : 6;

      ctx.beginPath();
      for (let x = 0; x <= W; x++) {
        const t = x / W;
        const y = H / 2
          + Math.sin(t * Math.PI * 4 + phaseRef.current) * amp
          + Math.sin(t * Math.PI * 7 + phaseRef.current * 1.3) * (amp * 0.4)
          + Math.sin(t * Math.PI * 13 + phaseRef.current * 0.8) * (amp * 0.2);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Flat baseline
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  const s = score ?? 0;
  const statusLabel = s >= 70 ? 'Healthy' : s >= 45 ? 'Elevated' : 'Critical';
  const statusColor = s >= 70 ? '#34c759' : s >= 45 ? '#ff9f0a' : '#ff3b30';

  return (
    <div className="brainwave-card glass-card">
      <div className="brainwave-header">
        <div className="brainwave-title">
          <span className="brainwave-icon">🧠</span>
          Brain Activity Monitor
        </div>
        <div className="brainwave-status" style={{ color: statusColor }}>
          <span className="status-dot" style={{ background: statusColor }} />
          {statusLabel}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="brainwave-canvas"
        width={560}
        height={80}
      />
      <div className="brainwave-legend">
        <span style={{ color: '#34c759' }}>● Calm (70+)</span>
        <span style={{ color: '#ff9f0a' }}>● Elevated (45-70)</span>
        <span style={{ color: '#ff3b30' }}>● Critical (&lt;45)</span>
      </div>
    </div>
  );
}
