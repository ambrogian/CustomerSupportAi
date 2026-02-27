import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useWebRTC } from '../hooks/useWebRTC';
import CallControls from '../components/CallControls';

interface ChatMessage {
    role: 'customer' | 'agent';
    text: string;
    timestamp: string;
    action?: string;
    creditAmount?: number;
    reasoning?: string;
    toolsUsed?: string[];
}

const CUSTOMERS = [
    { id: 'customer-001', name: 'Sarah Chen', tier: 'vip', email: 'sarah@example.com' },
    { id: 'customer-002', name: 'Marcus Williams', tier: 'standard', email: 'marcus@example.com' },
    { id: 'customer-003', name: 'Priya Patel', tier: 'vip', email: 'priya@example.com' },
];

const QUICK_MESSAGES = [
    "Where is my order? It was supposed to arrive yesterday.",
    "I want a refund. This is the second time my order was delayed.",
    "Can I get some compensation for the late delivery?",
    "My package says delivered but I never received it.",
    "I'd like to cancel my order.",
];

export default function CustomerChat() {
    const [selectedCustomer, setSelectedCustomer] = useState(CUSTOMERS[0]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatRef = useRef<HTMLDivElement>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    // Initialize Socket.IO connection with customer role
    useEffect(() => {
        const s = io({
            transports: ['websocket', 'polling'],
            query: { role: 'customer', customerId: selectedCustomer.id },
        });
        setSocket(s);

        s.on('connect', () => {
            console.log(`[CustomerChat] Connected as ${selectedCustomer.name}`);
        });

        return () => {
            s.disconnect();
            setSocket(null);
        };
    }, [selectedCustomer.id]);

    const webrtc = useWebRTC({
        socket,
        role: 'customer',
        customerId: selectedCustomer.id,
    });

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return;

        const customerMsg: ChatMessage = {
            role: 'customer',
            text: text.trim(),
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, customerMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('http://localhost:3001/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: selectedCustomer.id,
                    message: text.trim(),
                }),
            });

            const data = await res.json();

            // Determine which tools were used based on the response
            const toolsUsed: string[] = ['Neo4j Context'];
            if (data.policy) toolsUsed.push('Senso Policy');
            toolsUsed.push('Fastino LLM');
            if (data.action === 'apply_credit' || data.action === 'process_refund') {
                toolsUsed.push('Yutori Browsing');
            }

            const agentMsg: ChatMessage = {
                role: 'agent',
                text: data.message || 'I apologize, I was unable to process your request. Let me connect you with a human agent.',
                timestamp: new Date().toISOString(),
                action: data.action,
                creditAmount: data.creditAmount,
                reasoning: data.reasoning,
                toolsUsed,
            };
            setMessages(prev => [...prev, agentMsg]);
        } catch (err) {
            const errorMsg: ChatMessage = {
                role: 'agent',
                text: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Header */}
            <header style={{
                background: 'white',
                borderBottom: '1px solid #e2e8f0',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '16px',
                    }}>R</div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>
                            Resolve Support
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#22c55e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}>
                            <span style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: '#22c55e', display: 'inline-block',
                            }} />
                            Online — typically replies instantly
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Call controls in header */}
                    <CallControls
                        callState={webrtc.callState}
                        callId={webrtc.callId}
                        isMuted={webrtc.isMuted}
                        callDuration={webrtc.callDuration}
                        transcriptChunks={webrtc.transcriptChunks}
                        onStartCall={() => webrtc.startCall()}
                        onAcceptCall={webrtc.acceptCall}
                        onRejectCall={webrtc.rejectCall}
                        onEndCall={webrtc.endCall}
                        onToggleMute={webrtc.toggleMute}
                    />
                    <Link to="/" style={{
                        fontSize: '12px',
                        color: '#64748b',
                        textDecoration: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        transition: 'all 0.2s',
                    }}>
                        ← Business Dashboard
                    </Link>
                </div>
            </header>

            {/* Customer Selector */}
            <div style={{
                background: 'white',
                padding: '8px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#64748b',
            }}>
                <span>Chatting as:</span>
                {CUSTOMERS.map(c => (
                    <button
                        key={c.id}
                        onClick={() => {
                            setSelectedCustomer(c);
                            setMessages([]);
                        }}
                        style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            border: selectedCustomer.id === c.id ? '2px solid #667eea' : '1px solid #e2e8f0',
                            background: selectedCustomer.id === c.id ? '#eef2ff' : 'white',
                            color: selectedCustomer.id === c.id ? '#667eea' : '#475569',
                            fontWeight: selectedCustomer.id === c.id ? 600 : 400,
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {c.name} {c.tier === 'vip' && '⭐'}
                    </button>
                ))}
            </div>

            {/* Call transcript panel (shown during connected call) */}
            {webrtc.callState === 'connected' && webrtc.transcriptChunks.length > 0 && (
                <div style={{
                    background: 'white',
                    padding: '8px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    maxHeight: '150px',
                    overflowY: 'auto',
                }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>
                        Live Transcript
                    </div>
                    {webrtc.transcriptChunks.map((chunk, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#475569', marginBottom: '1px' }}>
                            <span style={{ color: '#94a3b8', fontSize: '10px', marginRight: '6px' }}>
                                [{new Date(chunk.timestamp).toLocaleTimeString()}]
                            </span>
                            {chunk.text}
                        </div>
                    ))}
                </div>
            )}

            {/* Chat Area */}
            <div ref={chatRef} style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                maxWidth: '700px',
                width: '100%',
                margin: '0 auto',
            }}>
                {/* Welcome Message */}
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px', fontSize: '28px',
                        }}>🤖</div>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                            Hi {selectedCustomer.name.split(' ')[0]}! 👋
                        </h2>
                        <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
                            I'm your AI support agent. How can I help you today?
                        </p>

                        {/* Quick Reply Suggestions */}
                        <div style={{
                            marginTop: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxWidth: '420px',
                            margin: '24px auto 0',
                        }}>
                            {QUICK_MESSAGES.map((msg, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => sendMessage(msg)}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        background: 'white',
                                        color: '#475569',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = '#667eea';
                                        e.currentTarget.style.background = '#f8faff';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.background = 'white';
                                    }}
                                >
                                    {msg}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Messages */}
                {messages.map((msg, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'customer' ? 'flex-end' : 'flex-start',
                        animation: 'fadeInUp 0.3s ease-out',
                    }}>
                        {/* Sender Label */}
                        <span style={{
                            fontSize: '11px',
                            color: '#94a3b8',
                            marginBottom: '4px',
                            marginLeft: msg.role === 'agent' ? '12px' : '0',
                            marginRight: msg.role === 'customer' ? '12px' : '0',
                        }}>
                            {msg.role === 'agent' ? '🤖 Resolve Agent' : `${selectedCustomer.name}`}
                        </span>

                        {/* Bubble */}
                        <div style={{
                            maxWidth: '80%',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            borderBottomLeftRadius: msg.role === 'agent' ? '4px' : '16px',
                            borderBottomRightRadius: msg.role === 'customer' ? '4px' : '16px',
                            background: msg.role === 'customer'
                                ? 'linear-gradient(135deg, #667eea, #764ba2)'
                                : 'white',
                            color: msg.role === 'customer' ? 'white' : '#1e293b',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}>
                            {msg.text}
                        </div>

                        {/* Agent Action Badge (visible to customer as subtle info) */}
                        {msg.role === 'agent' && msg.action && msg.action !== 'send_message' && (
                            <div style={{
                                marginTop: '6px',
                                marginLeft: '12px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}>
                                {msg.action === 'apply_credit' && (
                                    <span style={{
                                        background: '#dcfce7',
                                        color: '#166534',
                                        padding: '2px 8px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                    }}>
                                        💳 ${msg.creditAmount?.toFixed(2)} credit applied
                                    </span>
                                )}
                                {msg.action === 'process_refund' && (
                                    <span style={{
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        padding: '2px 8px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                    }}>
                                        💰 Refund processed
                                    </span>
                                )}
                                {msg.action === 'escalate' && (
                                    <span style={{
                                        background: '#fee2e2',
                                        color: '#991b1b',
                                        padding: '2px 8px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                    }}>
                                        🔔 Escalated to human agent
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Tools Used (visible on hover via tooltip) */}
                        {msg.role === 'agent' && msg.toolsUsed && (
                            <div style={{
                                marginTop: '4px',
                                marginLeft: '12px',
                                fontSize: '10px',
                                color: '#94a3b8',
                                display: 'flex',
                                gap: '4px',
                                flexWrap: 'wrap',
                            }}>
                                {msg.toolsUsed.map((tool, i) => (
                                    <span key={i} style={{
                                        background: '#f1f5f9',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                    }}>
                                        {tool}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Timestamp */}
                        <span style={{
                            fontSize: '10px',
                            color: '#cbd5e1',
                            marginTop: '4px',
                            marginLeft: msg.role === 'agent' ? '12px' : '0',
                            marginRight: msg.role === 'customer' ? '12px' : '0',
                        }}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                ))}

                {/* Loading Indicator */}
                {loading && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        animation: 'fadeInUp 0.3s ease-out',
                    }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[0, 1, 2].map(i => (
                                <span key={i} style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: '#94a3b8',
                                    animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite both`,
                                }} />
                            ))}
                        </div>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                            Agent is thinking...
                        </span>
                    </div>
                )}
            </div>

            {/* Input Bar */}
            <div style={{
                background: 'white',
                borderTop: '1px solid #e2e8f0',
                padding: '16px 24px',
            }}>
                <div style={{
                    maxWidth: '700px',
                    margin: '0 auto',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-end',
                }}>
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        disabled={loading}
                        rows={1}
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            color: '#1e293b',
                            fontSize: '14px',
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            transition: 'border-color 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#667eea'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={loading || !input.trim()}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            border: 'none',
                            background: loading || !input.trim()
                                ? '#e2e8f0'
                                : 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: loading || !input.trim() ? '#94a3b8' : 'white',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        Send →
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
        </div>
    );
}
