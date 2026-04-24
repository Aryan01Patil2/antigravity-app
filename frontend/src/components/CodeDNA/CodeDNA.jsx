import React from 'react';
import './CodeDNA.css';

export default function CodeDNA({ dnaBase64 }) {
  if (!dnaBase64) return null;

  return (
    <div className="dna-card glass-card">
      <div className="dna-header">
        <span className="dna-icon">🧬</span>
        <div>
          <h4 className="dna-title">Code DNA Fingerprint</h4>
          <p className="dna-subtitle">Your code's unique structural signature</p>
        </div>
      </div>
      <div className="dna-visual">
        <img
          src={dnaBase64}
          alt="Code DNA Fingerprint"
          className="dna-image"
        />
      </div>
      <button
        className="dna-download btn btn-secondary"
        onClick={() => {
          const a = document.createElement('a');
          a.href = dnaBase64;
          a.download = 'code-dna.svg';
          a.click();
        }}
      >
        ⬇ Download SVG
      </button>
    </div>
  );
}
