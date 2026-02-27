import { useEffect, useRef } from 'react';
import type { ChatMessageEvent } from '../hooks/useSocket';

interface Props {
    chatMessages: ChatMessageEvent[];
}

export default function MessagePreview({ chatMessages }: Props) {
    const chatRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [chatMessages]);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="card-header">
                <span>💬</span>
                <h2>Live Conversations</h2>
                {chatMessages.length > 0 && (
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: '11px',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#22c55e',
                        padding: '2px 8px',
                        borderRadius: '8px',
                    }}>
                        ● Live
                    </span>
                )}
            </div>
            <div
                ref={chatRef}
                className="card-body"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '400px',
                }}
            >
                {chatMessages.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                    }}>
                        <p style={{ fontSize: '24px', marginBottom: '8px' }}>💬</p>
                        No conversations yet
                        <br />
                        <span style={{ fontSize: '11px' }}>
                            Open the Customer View to start a chat
                        </span>
                    </div>
                ) : (
                    chatMessages.map((msg, idx) => (
                        <div
                            key={idx}
                            className="animate-fade-in"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: msg.role === 'customer' ? 'flex-end' : 'flex-start',
                            }}
                        >
                            {/* Sender */}
                            <span style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                marginBottom: '3px',
                                marginLeft: msg.role === 'agent' ? '4px' : '0',
                                marginRight: msg.role === 'customer' ? '4px' : '0',
                            }}>
                                {msg.role === 'agent' ? '🤖 Agent' : `👤 ${msg.customerName}`}
                            </span>

                            {/* Bubble */}
                            <div className={`chat-bubble chat-bubble-${msg.role}`} style={{
                                maxWidth: '85%',
                                fontSize: '12px',
                                padding: '8px 12px',
                            }}>
                                {msg.message.length > 150
                                    ? msg.message.substring(0, 150) + '...'
                                    : msg.message}
                            </div>

                            {/* Action Badge */}
                            {msg.role === 'agent' && msg.action && msg.action !== 'send_message' && (
                                <span style={{
                                    marginTop: '3px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    padding: '1px 6px',
                                    borderRadius: '6px',
                                    background: msg.action === 'apply_credit'
                                        ? 'rgba(34, 197, 94, 0.15)'
                                        : msg.action === 'process_refund'
                                            ? 'rgba(245, 158, 11, 0.15)'
                                            : 'rgba(239, 68, 68, 0.15)',
                                    color: msg.action === 'apply_credit'
                                        ? '#22c55e'
                                        : msg.action === 'process_refund'
                                            ? '#f59e0b'
                                            : '#ef4444',
                                }}>
                                    {msg.action === 'apply_credit' && `💳 $${msg.creditAmount?.toFixed(2)} credit`}
                                    {msg.action === 'process_refund' && '💰 Refund'}
                                    {msg.action === 'escalate' && '🔔 Escalated'}
                                </span>
                            )}

                            {/* Time */}
                            <span style={{
                                fontSize: '9px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                            }}>
                                {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
