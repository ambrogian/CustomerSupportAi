import { useState, useRef, useEffect } from 'react';

interface Props {
  onTriggerDelay: (orderId: string, daysLate: number) => void;
  onSendChat: (customerId: string, message: string) => void;
}

const TRIGGERS = [
  { id: 'sarah', orderId: 'order-1042', label: 'Sarah (VIP)', sub: '#1042 · Nike Air Max · 4d late', days: 4 },
  { id: 'marcus', orderId: 'order-1043', label: 'Marcus (Std)', sub: '#1043 · Adidas Ultraboost · 3d late', days: 3 },
  { id: 'priya', orderId: 'order-1044', label: 'Priya (VIP)', sub: '#1044 · New Balance 990 · 7d late', days: 7 },
];

export default function TriggerControls({ onTriggerDelay, onSendChat }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setChatMode(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleTrigger = async (t: typeof TRIGGERS[0]) => {
    setLoading(t.id);
    try {
      await onTriggerDelay(t.orderId, t.days);
    } finally {
      setTimeout(() => {
        setLoading(null);
        setOpen(false);
      }, 800);
    }
  };

  const handleChat = () => {
    if (chatMessage.trim()) {
      onSendChat('customer-001', chatMessage);
      setChatMessage('');
      setChatMode(false);
      setOpen(false);
    }
  };

  return (
    <div className="trigger-dropdown" ref={menuRef}>
      <button
        className="trigger-dropdown-btn"
        onClick={() => { setOpen(!open); setChatMode(false); }}
      >
        &#x26A1; Demo Controls
      </button>

      {open && (
        <div className="trigger-dropdown-menu">
          {!chatMode ? (
            <>
              {TRIGGERS.map((t) => (
                <button
                  key={t.id}
                  className="trigger-dropdown-item"
                  disabled={loading !== null}
                  onClick={() => handleTrigger(t)}
                >
                  <span style={{ fontSize: '14px' }}>&#x26A1;</span>
                  <div>
                    <div>{t.label}</div>
                    <div className="trigger-dropdown-item-sub">{t.sub}</div>
                  </div>
                  {loading === t.id && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>&#x23F3;</span>}
                </button>
              ))}
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
              <button
                className="trigger-dropdown-item"
                onClick={() => setChatMode(true)}
              >
                <span style={{ fontSize: '14px' }}>&#x1F4AC;</span>
                <div>
                  <div>Customer Chat</div>
                  <div className="trigger-dropdown-item-sub">Send as Sarah Chen</div>
                </div>
              </button>
            </>
          ) : (
            <div style={{ padding: '4px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Chatting as <strong style={{ color: 'var(--text-primary)' }}>Sarah Chen</strong> (VIP)
              </div>
              <textarea
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                placeholder="Where is my order?..."
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '8px',
                  fontSize: '12px',
                  resize: 'none',
                  height: '50px',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(102, 126, 234, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button
                  className="trigger-dropdown-item"
                  onClick={handleChat}
                  style={{ flex: 1, justifyContent: 'center', background: 'var(--bg-card-hover)' }}
                >
                  Send
                </button>
                <button
                  className="trigger-dropdown-item"
                  onClick={() => setChatMode(false)}
                  style={{ flex: 0, padding: '6px 12px' }}
                >
                  &#x2715;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
