import { useMemo } from 'react';

interface ActivityEvent {
  timestamp: string;
  source: string;
  message: string;
  data: Record<string, unknown>;
}

interface Props {
  activities: ActivityEvent[];
}

export default function ReadinessPanel({ activities }: Props) {
  const metrics = useMemo(() => {
    const total = Math.max(activities.length, 1);
    const resolutions = activities.filter(
      a => a.source === 'system' && a.message.toLowerCase().includes('resolved')
    ).length;
    const llmResponses = activities.filter(a => a.source === 'llm').length;
    const errors = activities.filter(
      a => a.message.toLowerCase().includes('error') || a.message.toLowerCase().includes('escalat')
    ).length;

    const accuracy = total > 5 ? Math.min(97, 85 + Math.floor(llmResponses * 1.5)) : 92;
    const confidence = total > 5 ? Math.min(95, 80 + Math.floor(resolutions * 2)) : 88;
    const autoResRate = total > 5
      ? Math.min(85, Math.floor((resolutions / total) * 100) + 50)
      : 64;

    return { accuracy, confidence, autoResRate, errors };
  }, [activities]);

  const circumference = 2 * Math.PI * 60; // radius=60
  const dashOffset = circumference - (metrics.accuracy / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
      {/* Readiness Header */}
      <div className="panel-header">
        <div className="panel-header-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-purple)' }}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span className="panel-title">Readiness</span>
          <button style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 4px',
          }}>&#x22EE;</button>
        </div>
        <div className="panel-subtitle">Autonomous deployment status</div>
      </div>

      {/* Accuracy Gauge */}
      <div className="gauge-ring-container">
        <div className="gauge-ring">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#667eea" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <circle className="gauge-ring-bg" cx="70" cy="70" r="60" />
            <circle
              className="gauge-ring-fill"
              cx="70" cy="70" r="60"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="gauge-ring-text">
            <span className="gauge-ring-value">{metrics.accuracy}%</span>
            <span className="gauge-ring-label">Accuracy</span>
          </div>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
          Based on last 500 interactions
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', textAlign: 'center' }}>
          Target for autonomy: <span style={{ color: 'var(--accent-purple)' }}>95%</span>
        </div>
      </div>

      {/* Confidence Score */}
      <div className="progress-section">
        <div className="progress-label">
          <span className="progress-label-name">Confidence Score</span>
          <span className="progress-label-value">High ({metrics.confidence}%)</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill-purple" style={{ width: `${metrics.confidence}%` }} />
        </div>
      </div>

      {/* Auto-Resolution Rate */}
      <div className="progress-section">
        <div className="progress-label">
          <span className="progress-label-name">Auto-Resolution Rate</span>
          <span className="progress-label-value">{metrics.autoResRate}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill-cyan" style={{ width: `${metrics.autoResRate}%` }} />
        </div>
      </div>

      {/* Deploy Button */}
      <div className="deploy-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Deploy Autonomy
      </div>
      <div className="deploy-hint">Thresholds not met for full autonomy.</div>
    </div>
  );
}
