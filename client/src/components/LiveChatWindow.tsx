import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { ChatMessageEvent, IncomingCallEvent } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import CallControls from './CallControls';

interface Props {
  chatMessages: ChatMessageEvent[];
  socket: Socket | null;
  incomingCall: IncomingCallEvent | null;
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

export default function LiveChatWindow({ chatMessages, socket, incomingCall }: Props) {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: window.innerHeight - 440 });
  const dragging = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  const targetCustomerId = latestCustomerId(chatMessages);

  const webrtc = useWebRTC({
    socket,
    role: 'agent',
    customerId: targetCustomerId || undefined,
    incomingCall,
  });

  // Auto-show on new messages; mark unread if minimized
  useEffect(() => {
    if (chatMessages.length > prevCount.current) {
      if (!visible) setVisible(true);
      if (minimized) setHasUnread(true);
    }
    prevCount.current = chatMessages.length;
  }, [chatMessages.length, visible, minimized]);

  // Auto-expand on incoming call (from parent prop or webrtc state)
  useEffect(() => {
    const hasIncoming = incomingCall || webrtc.callState === 'incoming';
    if (hasIncoming) {
      if (!visible) setVisible(true);
      if (minimized) {
        setMinimized(false);
        setHasUnread(false);
      }
    }
  }, [incomingCall, webrtc.callState, visible, minimized]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (bodyRef.current && !minimized) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [chatMessages.length, minimized, webrtc.transcriptChunks.length]);

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

  const hasActiveCall = webrtc.callState !== 'idle' && webrtc.callState !== 'ended';
  if (!visible || (chatMessages.length === 0 && !incomingCall && !hasActiveCall)) return null;

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
        <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Phone button in header */}
          {webrtc.callState === 'idle' && targetCustomerId && (
            <button
              className="live-chat-ctrl"
              onClick={() => webrtc.startCall(targetCustomerId)}
              title="Start voice call"
              style={{ color: '#22c55e' }}
            >
              &#x260E;
            </button>
          )}
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
          {/* Call controls bar */}
          {webrtc.callState !== 'idle' && (
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              background: 'rgba(0,0,0,0.02)',
            }}>
              <CallControls
                callState={webrtc.callState}
                callId={webrtc.callId}
                isMuted={webrtc.isMuted}
                callDuration={webrtc.callDuration}
                transcriptChunks={webrtc.transcriptChunks}
                onStartCall={() => targetCustomerId && webrtc.startCall(targetCustomerId)}
                onAcceptCall={webrtc.acceptCall}
                onRejectCall={webrtc.rejectCall}
                onEndCall={webrtc.endCall}
                onToggleMute={webrtc.toggleMute}
                compact
              />
            </div>
          )}

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

            {/* Show transcript chunks inline during a connected call */}
            {webrtc.callState === 'connected' && webrtc.transcriptChunks.length > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                background: 'rgba(245, 158, 11, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>
                  Live Transcript
                </div>
                {webrtc.transcriptChunks.map((chunk, i) => (
                  <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginBottom: '1px' }}>
                    {chunk.text}
                  </div>
                ))}
              </div>
            )}
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
