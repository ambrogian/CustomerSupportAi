import { useEffect, useRef } from 'react';

interface ActivityEvent {
    timestamp: string;
    source: string;
    message: string;
    data: Record<string, unknown>;
}

interface Props {
    activities: ActivityEvent[];
}

const SOURCE_LABELS: Record<string, string> = {
    scouting: 'Scouting API',
    neo4j: 'Neo4j',
    senso: 'Senso',
    llm: 'GPT-4o',
    browsing: 'Browsing API',
    system: 'System',
};

export default function ActivityFeed({ activities }: Props) {
    const feedRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new activities arrive
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [activities]);

    const formatTime = (ts: string): string => {
        try {
            const d = new Date(ts);
            return d.toLocaleTimeString('en-US', { hour12: false });
        } catch {
            return '';
        }
    };

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="card-header">
                <span>📡</span>
                <h2>Agent Activity Feed</h2>
                <span style={{
                    marginLeft: 'auto',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                }}>
                    {activities.length} events
                </span>
            </div>
            <div
                ref={feedRef}
                className="card-body"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '8px 12px',
                    maxHeight: '400px',
                }}
            >
                {activities.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                    }}>
                        <p style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</p>
                        Waiting for agent activity...
                        <br />
                        <span style={{ fontSize: '11px' }}>
                            Use the trigger controls to simulate a delay
                        </span>
                    </div>
                ) : (
                    activities.map((event, idx) => (
                        <div
                            key={idx}
                            className="animate-slide-in"
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                marginBottom: '2px',
                                fontSize: '12px',
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                animationDelay: `${idx * 0.05}s`,
                                background: idx === activities.length - 1 ? 'rgba(102, 126, 234, 0.05)' : 'transparent',
                            }}
                        >
                            <span style={{
                                color: 'var(--text-muted)',
                                flexShrink: 0,
                                fontSize: '11px',
                            }}>
                                [{formatTime(event.timestamp)}]
                            </span>
                            <span className={`source-dot source-${event.source}`}
                                style={{ marginTop: '5px' }}
                            />
                            <span style={{
                                color: `var(--color-${event.source})`,
                                fontWeight: 600,
                                flexShrink: 0,
                                fontSize: '11px',
                                minWidth: '85px',
                            }}>
                                {SOURCE_LABELS[event.source] || event.source}:
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontSize: '12px' }}>
                                {event.message}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
