import { useState } from 'react';

interface Props {
    onTriggerDelay: (orderId: string, daysLate: number) => void;
    onSendChat: (customerId: string, message: string) => void;
}

export default function TriggerControls({ onTriggerDelay, onSendChat }: Props) {
    const [loading, setLoading] = useState<string | null>(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState('');

    const handleTrigger = async (orderId: string, label: string, daysLate: number) => {
        setLoading(label);
        try {
            await onTriggerDelay(orderId, daysLate);
        } finally {
            setTimeout(() => setLoading(null), 1000);
        }
    };

    const handleChat = () => {
        if (chatMessage.trim()) {
            onSendChat('customer-001', chatMessage);
            setChatMessage('');
            setChatOpen(false);
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <span>🎮</span>
                <h2>Demo Controls</h2>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                <button
                    className="trigger-btn"
                    disabled={loading !== null}
                    onClick={() => handleTrigger('order-1042', 'sarah', 4)}
                >
                    <span className="icon">⚡</span>
                    <div>
                        <div style={{ fontWeight: 600 }}>Simulate FedEx Delay — Sarah (VIP)</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Order #1042 · Nike Air Max · 4 days late
                        </div>
                    </div>
                    {loading === 'sarah' && <span style={{ marginLeft: 'auto' }}>⏳</span>}
                </button>

                <button
                    className="trigger-btn"
                    disabled={loading !== null}
                    onClick={() => handleTrigger('order-1043', 'marcus', 3)}
                >
                    <span className="icon">⚡</span>
                    <div>
                        <div style={{ fontWeight: 600 }}>Simulate UPS Delay — Marcus (Standard)</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Order #1043 · Adidas Ultraboost · 3 days late
                        </div>
                    </div>
                    {loading === 'marcus' && <span style={{ marginLeft: 'auto' }}>⏳</span>}
                </button>

                <button
                    className="trigger-btn"
                    disabled={loading !== null}
                    onClick={() => handleTrigger('order-1044', 'priya', 7)}
                >
                    <span className="icon">⚡</span>
                    <div>
                        <div style={{ fontWeight: 600 }}>Simulate FedEx Delay — Priya (VIP)</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Order #1044 · New Balance 990 · 7 days late
                        </div>
                    </div>
                    {loading === 'priya' && <span style={{ marginLeft: 'auto' }}>⏳</span>}
                </button>

                <div style={{
                    height: '1px',
                    background: 'var(--border-color)',
                    margin: '4px 0',
                }} />

                {!chatOpen ? (
                    <button
                        className="trigger-btn"
                        onClick={() => setChatOpen(true)}
                    >
                        <span className="icon">💬</span>
                        <div>
                            <div style={{ fontWeight: 600 }}>Simulate Customer Chat</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Send a message as Sarah Chen
                            </div>
                        </div>
                    </button>
                ) : (
                    <div style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '12px',
                        background: 'var(--bg-card-hover)',
                    }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Chatting as <strong style={{ color: 'var(--text-primary)' }}>Sarah Chen</strong> (VIP)
                        </div>
                        <textarea
                            value={chatMessage}
                            onChange={e => setChatMessage(e.target.value)}
                            placeholder="Where is my order? It should have arrived yesterday..."
                            style={{
                                width: '100%',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                padding: '10px',
                                fontSize: '13px',
                                resize: 'none',
                                height: '60px',
                                fontFamily: 'inherit',
                                outline: 'none',
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'rgba(102, 126, 234, 0.5)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                                className="trigger-btn"
                                onClick={handleChat}
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                Send →
                            </button>
                            <button
                                className="trigger-btn"
                                onClick={() => setChatOpen(false)}
                                style={{ flex: 0, padding: '8px 16px' }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
