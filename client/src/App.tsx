import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import './index.css';
import { useSocket } from './hooks/useSocket';
import OrdersPanel from './components/OrdersPanel';
import ActivityFeed from './components/ActivityFeed';
import MessagePreview from './components/MessagePreview';
import GraphPanel from './components/GraphPanel';
import TriggerControls from './components/TriggerControls';

function App() {
  const { isConnected, activities, lastOrderUpdate, graphVersion, chatMessages } = useSocket();

  const handleTriggerDelay = useCallback(async (orderId: string, daysLate: number) => {
    try {
      await fetch('http://localhost:3001/api/trigger-delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, daysLate }),
      });
    } catch (err) {
      console.error('Trigger failed:', err);
    }
  }, []);

  const handleSendChat = useCallback(async (customerId: string, message: string) => {
    try {
      await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, message }),
      });
    } catch (err) {
      console.error('Chat failed:', err);
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      padding: '20px',
      maxWidth: '1600px',
      margin: '0 auto',
    }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        padding: '0 4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            🤖
          </div>
          <div>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}>
              Resolve
            </h1>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '-2px',
            }}>
              Autonomous Customer Service Agent
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            to="/chat"
            target="_blank"
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              transition: 'all 0.2s',
            }}
          >
            💬 Open Customer View
          </Link>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#22c55e' : '#ef4444',
              boxShadow: isConnected ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
            }} />
            {isConnected ? 'Live' : 'Disconnected'}
          </div>
        </div>
      </header>

      {/* ── Dashboard Grid ──────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 340px',
        gridTemplateRows: 'auto auto auto',
        gap: '16px',
      }}>
        {/* Row 1, Col 1-2: Orders */}
        <div style={{ gridColumn: '1 / 3', gridRow: '1' }}>
          <OrdersPanel lastOrderUpdate={lastOrderUpdate} />
        </div>

        {/* Col 3, Rows 1-2: Trigger Controls */}
        <div style={{ gridColumn: '3', gridRow: '1 / 3' }}>
          <TriggerControls
            onTriggerDelay={handleTriggerDelay}
            onSendChat={handleSendChat}
          />
        </div>

        {/* Row 2, Col 1: Activity Feed */}
        <div style={{ gridColumn: '1', gridRow: '2' }}>
          <ActivityFeed activities={activities} />
        </div>

        {/* Row 2, Col 2: Message Preview */}
        <div style={{ gridColumn: '2', gridRow: '2' }}>
          <MessagePreview chatMessages={chatMessages} />
        </div>

        {/* Row 3: Graph (spans full width) */}
        <div style={{ gridColumn: '1 / -1', gridRow: '3' }}>
          <GraphPanel graphVersion={graphVersion} />
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer style={{
        textAlign: 'center',
        padding: '24px 0 12px',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}>
        Powered by Neo4j · Fastino · Yutori · Senso · Tavily
      </footer>
    </div>
  );
}

export default App;
