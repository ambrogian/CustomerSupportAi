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

interface Anomaly {
  id: number;
  title: string;
  type: 'red' | 'orange';
  timestamp: string;
}

function relativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  } catch {
    return '';
  }
}

export default function AnomaliesPanel({ activities }: Props) {
  const anomalies = useMemo<Anomaly[]>(() => {
    const results: Anomaly[] = [];
    let idCounter = 1;

    for (const event of activities) {
      const msg = event.message.toLowerCase();
      if (msg.includes('escalat') || msg.includes('human review')) {
        results.push({
          id: idCounter++,
          title: 'Escalation Required',
          type: 'red',
          timestamp: event.timestamp,
        });
      } else if (msg.includes('error') || msg.includes('fail')) {
        results.push({
          id: idCounter++,
          title: 'Processing Error',
          type: 'red',
          timestamp: event.timestamp,
        });
      } else if (msg.includes('sentiment') || msg.includes('mismatch')) {
        results.push({
          id: idCounter++,
          title: 'Sentiment Mismatch',
          type: 'orange',
          timestamp: event.timestamp,
        });
      } else if (msg.includes('loop') || msg.includes('retry')) {
        results.push({
          id: idCounter++,
          title: 'Loop Detected',
          type: 'orange',
          timestamp: event.timestamp,
        });
      }
    }

    return results.reverse().slice(0, 8);
  }, [activities]);

  // Show placeholder anomalies when no real data
  const displayAnomalies: Anomaly[] = anomalies.length > 0 ? anomalies : [
    { id: 101, title: 'Sentiment Mismatch', type: 'orange', timestamp: new Date(Date.now() - 120000).toISOString() },
    { id: 102, title: 'Loop Detected', type: 'orange', timestamp: new Date(Date.now() - 300000).toISOString() },
  ];

  return (
    <div className="anomaly-section">
      <div className="anomaly-section-header">Recent Anomalies</div>
      <div className="anomaly-list">
        {displayAnomalies.map((a) => (
          <div key={a.id} className="anomaly-item">
            <div className={`anomaly-icon anomaly-icon-${a.type}`}>
              {a.type === 'red' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
            <div className="anomaly-info">
              <div className="anomaly-title">{a.title}</div>
              <div className="anomaly-meta">ID-{a.id} &middot; {relativeTime(a.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
