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
  llm: 'Qwen3-32B',
  browsing: 'Browsing API',
  tavily: 'Tavily Search',
  system: 'System',
};

function relativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  } catch {
    return '';
  }
}

export default function TicketStream({ activities }: Props) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [activities]);

  // Group consecutive activities into "tickets"
  const tickets: { id: number; events: ActivityEvent[] }[] = [];
  let currentTicket: ActivityEvent[] = [];
  let ticketId = 4920;

  for (const event of activities) {
    currentTicket.push(event);
    // End a ticket group when we get a system or llm response
    if (event.source === 'system' || event.source === 'llm') {
      tickets.push({ id: ticketId++, events: [...currentTicket] });
      currentTicket = [];
    }
  }
  // Remaining ungrouped events
  if (currentTicket.length > 0) {
    tickets.push({ id: ticketId++, events: currentTicket });
  }

  return (
    <div className="panel" style={{ borderRight: '1px solid var(--border-color)' }}>
      <div className="panel-header">
        <div className="panel-header-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-cyan)' }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="panel-title">Agent Learning</span>
          <span className="panel-badge panel-badge-processing" style={{ marginLeft: '8px' }}>Processing</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
            {activities.length} events
          </span>
        </div>
        <div className="panel-subtitle">Live ingestion stream</div>
      </div>
      <div ref={feedRef} className="panel-body">
        {activities.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 16px',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}>
            <div style={{ fontSize: '20px', marginBottom: '8px', opacity: 0.5 }}>&#x25CE;</div>
            Waiting for agent activity...
            <br />
            <span style={{ fontSize: '10px' }}>
              Use demo controls in the status bar below
            </span>
          </div>
        ) : (
          tickets.reverse().map((ticket) => (
            <div
              key={ticket.id}
              className="ticket-card"
              data-source={ticket.events[0]?.source}
            >
              <div className="ticket-header">
                <span className="ticket-number">Ticket #{ticket.id}</span>
                <span className="ticket-time">{relativeTime(ticket.events[0].timestamp)}</span>
              </div>
              {ticket.events.map((event, i) => (
                <div key={i} style={{ marginBottom: i < ticket.events.length - 1 ? '4px' : 0 }}>
                  <div className="ticket-message">
                    <span style={{
                      color: `var(--color-${event.source})`,
                      fontWeight: 600,
                      fontSize: '10px',
                      marginRight: '6px',
                    }}>
                      {SOURCE_LABELS[event.source] || event.source}
                    </span>
                    {event.message}
                  </div>
                  {event.data?.action && (
                    <span className="ticket-intent">{event.data.action as string}</span>
                  )}
                  {event.data?.creditAmount && (
                    <span className="ticket-intent" style={{ marginLeft: '4px' }}>
                      credit: ${event.data.creditAmount as string}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
