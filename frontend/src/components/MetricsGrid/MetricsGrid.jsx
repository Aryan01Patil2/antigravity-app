import React from 'react';
import './MetricsGrid.css';

const METRICS_CONFIG = [
  // Core
  { key: 'line_count',           label: 'Total Lines',      icon: '≡',  suffix: '' },
  { key: 'code_lines',           label: 'Code Lines',       icon: '</>',suffix: '' },
  { key: 'function_count',       label: 'Functions',        icon: 'ƒ',  suffix: '' },
  { key: 'class_count',          label: 'Classes',          icon: '◈',  suffix: '' },
  { key: 'import_count',         label: 'Imports',          icon: '↓',  suffix: '', dangerThreshold: 15 },
  // Structure
  { key: 'avg_function_length',  label: 'Avg Fn Length',    icon: '↕',  suffix: ' ln', dangerThreshold: 30 },
  { key: 'max_nesting_depth',    label: 'Max Nesting',      icon: '⌥',  suffix: ' lvl', dangerThreshold: 4 },
  { key: 'single_branch_ifs',    label: 'No-Else IFs',      icon: '↱',  suffix: '', dangerThreshold: 8 },
  { key: 'god_functions',        label: 'God Functions',    icon: '⚠',  suffix: '', dangerThreshold: 1 },
  { key: 'max_params',           label: 'Max Params',       icon: '⋯',  suffix: '', dangerThreshold: 5 },
  // Complexity
  { key: 'cyclomatic_complexity',label: 'Cyclomatic CC',    icon: '⑂',  suffix: '', dangerThreshold: 10 },
  { key: 'halstead_volume',      label: 'Halstead Vol.',    icon: 'Ω',  suffix: '', round: 0, dangerThreshold: 1000 },
  // Documentation
  { key: 'comment_ratio',        label: 'Comment Ratio',    icon: '//',  suffix: '%', multiplier: 100, round: 1, warnLow: 0.10 },
  { key: 'todo_count',           label: 'TODO/FIXME',       icon: '!',  suffix: '', dangerThreshold: 3 },
  // Naming
  { key: 'avg_identifier_length',label: 'Avg ID Length',    icon: 'ID', suffix: ' ch', warnLow: 4 },
  { key: 'magic_numbers_count',  label: 'Magic Numbers',    icon: '#',  suffix: '', dangerThreshold: 5 },
  // Code Quality
  { key: 'long_lines_count',     label: 'Long Lines >79',   icon: '→',  suffix: '', dangerThreshold: 5 },
  { key: 'wildcard_imports',     label: 'Wildcard Imports', icon: '*',  suffix: '', dangerThreshold: 1 },
  { key: 'duplicate_score',      label: 'Dupe Score',       icon: '⧉',  suffix: '', multiplier: 100, round: 0, dangerThreshold: 60 },
];

function getMetricStatus(config, raw) {
  if (config.dangerThreshold !== undefined && raw >= config.dangerThreshold) return 'danger';
  if (config.warnLow !== undefined && raw < config.warnLow) return 'warn';
  return 'good';
}

function MetricCard({ config, value }) {
  const raw = value ?? 0;
  let display = raw;
  if (config.multiplier) display = (raw * config.multiplier).toFixed(config.round ?? 0);
  else if (config.round !== undefined) display = raw.toFixed ? raw.toFixed(config.round) : raw;

  const status = getMetricStatus(config, raw);

  return (
    <div className={`metric-card glass-card metric-${status}`}>
      <div className="metric-icon-text">{config.icon}</div>
      <div className="metric-body">
        <div className="metric-label">{config.label}</div>
        <div className="metric-value">
          {display}{config.suffix}
        </div>
      </div>
      <div className={`metric-indicator metric-indicator-${status}`} />
    </div>
  );
}

export default function MetricsGrid({ metrics }) {
  if (!metrics) return null;

  const grouped = [
    { title: 'Code Volume', keys: ['line_count','code_lines','function_count','class_count','import_count'] },
    { title: 'Structure', keys: ['avg_function_length','max_nesting_depth','single_branch_ifs','god_functions','max_params'] },
    { title: 'Complexity', keys: ['cyclomatic_complexity','halstead_volume'] },
    { title: 'Documentation & Naming', keys: ['comment_ratio','todo_count','avg_identifier_length','magic_numbers_count'] },
    { title: 'Code Quality', keys: ['long_lines_count','wildcard_imports','duplicate_score'] },
  ];

  const configByKey = Object.fromEntries(METRICS_CONFIG.map(c => [c.key, c]));

  return (
    <div className="metrics-section">
      <h3 className="metrics-title">Static Analysis Metrics</h3>
      {grouped.map(group => (
        <div key={group.title} className="metrics-group">
          <div className="metrics-group-label">{group.title}</div>
          <div className="metrics-grid">
            {group.keys.map(key => {
              const cfg = configByKey[key];
              if (!cfg) return null;
              return <MetricCard key={key} config={cfg} value={metrics[key]} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
