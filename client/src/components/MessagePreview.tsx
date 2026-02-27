import { useEffect, useRef, useState } from 'react';

interface ActivityEvent {
    timestamp: string;
    source: string;
    message: string;
    data: Record<string, unknown>;
}

interface Props {
    activities: ActivityEvent[];
}

interface ChatMessage {
    role: 'agent' | 'customer';
    text: string;
    timestamp: string;
    customerName?: string;
}

export default function MessagePreview({ activities }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const chatRef = useRef<HTMLDivElement>(null);

    // Extract messages from activity events
    useEffect(() => {
        const newMessages: ChatMessage[] = [];
        for (const event of activities) {
            if (event.source === 'system' && event.message.includes('Message sent')) {
                const msgText = event.data?.message as string;
                const customerName = event.data?.customerName as string;
                if (msgText) {
                    newMessages.push({
                        role: 'agent',
                        text: msgText,
                        timestamp: event.timestamp,
                        customerName,
                    });
                }
            }
        }
        setMessages(newMessages);
    }, [activities]);

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="card-header">
                <span>💬</span>
                <h2>Customer Messages</h2>
            </div>
            <div
                ref={chatRef}
                className="card-body"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '300px',
                }}
            >
                {messages.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                    }}>
                        <p style={{ fontSize: '24px', marginBottom: '8px' }}>💬</p>
                        No messages yet
                        <br />
                        <span style={{ fontSize: '11px' }}>
                            Messages will appear here when the agent responds
                        </span>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: msg.role === 'agent' ? 'flex-start' : 'flex-end',
                            }}
                        >
                            {msg.customerName && (
                                <span style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    marginBottom: '4px',
                                    marginLeft: msg.role === 'agent' ? '4px' : '0',
                                    marginRight: msg.role === 'customer' ? '4px' : '0',
                                }}>
                                    {msg.role === 'agent' ? `To ${msg.customerName}` : msg.customerName}
                                </span>
                            )}
                            <div className={`chat-bubble chat-bubble-${msg.role}`}>
                                {msg.text}
                            </div>
                            <span style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                marginTop: '4px',
                                marginLeft: msg.role === 'agent' ? '4px' : '0',
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
