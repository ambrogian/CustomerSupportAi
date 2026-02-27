import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import './index.css';
import { useSocket } from './hooks/useSocket';
import TicketStream from './components/TicketStream';
import GraphPanel from './components/GraphPanel';
import ReadinessPanel from './components/ReadinessPanel';
import AnomaliesPanel from './components/AnomaliesPanel';
import TriggerControls from './components/TriggerControls';

function App() {
  const { isConnected, activities, graphVersion } = useSocket();
  const [activeTab] = useState('overview');

  const handleTriggerDelay = useCallback(async (orderId: string, daysLate: number) => {
    try {
      await fetch('/api/trigger-delay', {
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
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, message }),
      });
    } catch (err) {
      console.error('Chat failed:', err);
    }
  }, []);

  return (
    <div className="dashboard-shell">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="header">
        <div className="header-brand">
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
          }}>
            &#x25C8;
          </div>
          <h1>Resolve</h1>
          <span className="header-version">v2.0</span>
          <span className="header-live-badge">Live Training</span>
        </div>

        <nav className="nav-tabs">
          <button className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}>Overview</button>
          <button className="nav-tab">Training Sets</button>
          <button className="nav-tab">Logs</button>
          <button className="nav-tab">Settings</button>
        </nav>

        <div className="header-metrics">
          <Link
            to="/chat"
            target="_blank"
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '4px 10px',
              borderRadius: '5px',
              border: '1px solid var(--border-color)',
              transition: 'all 0.15s',
            }}
          >
            Customer View
          </Link>
          <div className="metric-item">
            <span>System Load</span>
            <div className="metric-bar">
              <div className="metric-bar-fill" style={{ width: '42%' }} />
            </div>
            <span>42%</span>
          </div>
          <div className="metric-item">
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#22c55e',
              display: 'inline-block',
            }} />
            <span>Latency 24ms</span>
          </div>
          <div style={{
            width: '1px',
            height: '20px',
            background: 'var(--border-color)',
          }} />
          <button style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px',
          }}>
            &#x1F514;
          </button>
          <div className="header-avatar">R</div>
        </div>
      </header>

      {/* ── Main 3-Column Grid ──────────────────────────────── */}
      <div className="main-grid">
        {/* Left Column: Ticket Stream */}
        <TicketStream activities={activities} />

        {/* Center Column: Knowledge Graph */}
        <div className="panel" style={{ borderRight: '1px solid var(--border-color)' }}>
          <GraphPanel graphVersion={graphVersion} />
        </div>

        {/* Right Column: Readiness + Anomalies */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <ReadinessPanel activities={activities} />
          </div>
          <AnomaliesPanel activities={activities} />
        </div>
      </div>

      {/* ── Status Bar (Footer) ─────────────────────────────── */}
      <footer className="status-bar">
        <span className={`status-dot ${isConnected ? 'status-dot-green' : 'status-dot-red'}`} />
        <span className="status-text">
          {isConnected ? 'Listening to #support-general...' : 'Disconnected — reconnecting...'}
        </span>

        <TriggerControls
          onTriggerDelay={handleTriggerDelay}
          onSendChat={handleSendChat}
        />

        <div className="status-live">
          <span className={`status-dot ${isConnected ? 'status-dot-green' : 'status-dot-red'}`} />
          {isConnected ? 'Live' : 'Offline'}
        </div>
      </footer>
    </div>
  );
}

export default App;
