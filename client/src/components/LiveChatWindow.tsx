import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessageEvent } from '../hooks/useSocket';

interface Props {
  chatMessages: ChatMessageEvent[];
}

// Map customer IDs to display names (backend emits the raw ID for customer-role messages)
const CUSTOMER_NAMES: Record<string, string> = {
  'customer-001': 'Sarah Chen',
  'customer-002': 'Marcus Williams',
  'customer-003': 'Priya Patel',
};

function displayName(msg: ChatMessageEvent): string {
  if (msg.role === 'agent') return 'Resolve Agent';
  return CUSTOMER_NAMES[msg.customerName] || msg.customerName;
}

// Derive the customer ID from the latest customer message so replies target the right customer
function latestCustomerId(msgs: ChatMessageEvent[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'customer') {
      const name = msgs[i].customerName;
      // If it already looks like an ID, use it directly
      if (name.startsWith('customer-')) return name;
      // Otherwise reverse-lookup
      const entry = Object.entries(CUSTOMER_NAMES).find(([, v]) => v === name);
      return entry ? entry[0] : null;
    }
  }
  return null;
}

export default function LiveChatWindow({ chatMessages }: Props) {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: window.innerHeight - 440 });
  const dragging = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  // Auto-show on new messages; mark unread if minimized
  useEffect(() => {
    if (chatMessages.length > prevCount.current) {
      if (!visible) setVisible(true);
      if (minimized) setHasUnread(true);
    }
    prevCount.current = chatMessages.length;
  }, [chatMessages.length, visible, minimized]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (bodyRef.current && !minimized) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [chatMessages.length, minimized]);

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.startX;
      const dy = e.clientY - dragging.current.startY;
      setPosition({ x: dragging.current.origX + dx, y: dragging.current.origY + dy });
    };
    const onMouseUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Send reply via the existing /api/chat endpoint
  const sendReply = useCallback(async () => {
    const text = replyText.trim();
    if (!text || sending) return;

    const customerId = latestCustomerId(chatMessages);
    if (!customerId) return;

    setSending(true);
    setReplyText('');
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, message: text }),
      });
    } catch (err) {
      console.error('Live chat reply failed:', err);
    } finally {
      setSending(false);
    }
  }, [replyText, sending, chatMessages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  if (!visible || chatMessages.length === 0) return null;

  return (
    <div
      className={`live-chat-window ${minimized ? 'live-chat-minimized' : ''}`}
      style={{ left: position.x, top: position.y }}
    >
      {/* Header / title bar */}
      <div className="live-chat-header" onMouseDown={onMouseDown}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Live Chat
          {hasUnread && <span className="live-chat-dot" />}
        </span>
        <span style={{ display: 'flex', gap: '4px' }}>
          <button
            className="live-chat-ctrl"
            onClick={() => { setMinimized(m => !m); setHasUnread(false); }}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '\u25B3' : '\u25BD'}
          </button>
          <button className="live-chat-ctrl" onClick={() => setVisible(false)} title="Close">
            \u2715
          </button>
        </span>
      </div>

      {/* Body + Reply */}
      {!minimized && (
        <>
          <div className="live-chat-body" ref={bodyRef}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role === 'agent' ? 'chat-bubble-agent' : 'chat-bubble-customer'}`}>
                <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px' }}>
                  {displayName(msg)} &middot; {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div>{msg.message}</div>
                {msg.action && (
                  <span className="ticket-intent" style={{ marginTop: '4px', display: 'inline-block' }}>
                    {msg.action}
                    {msg.creditAmount ? ` · $${msg.creditAmount}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Reply input */}
          <div className="live-chat-reply">
            <input
              className="live-chat-input"
              type="text"
              placeholder="Reply as agent..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <button
              className="live-chat-send"
              onClick={sendReply}
              disabled={sending || !replyText.trim()}
            >
              {sending ? '...' : '\u27A4'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
