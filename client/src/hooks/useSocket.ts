import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ActivityEvent {
    timestamp: string;
    source: string;
    message: string;
    data: Record<string, unknown>;
}

export interface OrderUpdate {
    timestamp: string;
    orderId: string;
    status: string;
}

export interface ChatMessageEvent {
    timestamp: string;
    role: 'customer' | 'agent';
    customerName: string;
    message: string;
    action?: string;
    creditAmount?: number;
}

export interface IncomingCallEvent {
    callId: string;
    from: string;
    customerName?: string;
}

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [lastOrderUpdate, setLastOrderUpdate] = useState<OrderUpdate | null>(null);
    const [graphVersion, setGraphVersion] = useState(0);
    const [chatMessages, setChatMessages] = useState<ChatMessageEvent[]>([]);
    const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null);
    const [activeCall, setActiveCall] = useState<string | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        // Connect via Vite proxy (relative URL)
        const s = io({
            transports: ['websocket', 'polling'],
        });
        setSocket(s);
        const socket = s;

        socket.on('connect', () => {
            setIsConnected(true);
            // Join as agent for the dashboard
            socket.emit('join', { role: 'agent' });
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('activity', (event: ActivityEvent) => {
            setActivities(prev => [...prev, event]);
        });

        socket.on('order_updated', (data: OrderUpdate) => {
            setLastOrderUpdate(data);
        });

        socket.on('graph_updated', () => {
            setGraphVersion(v => v + 1);
        });

        // Live chat messages from customer <-> agent conversations
        socket.on('chat_message', (data: ChatMessageEvent) => {
            setChatMessages(prev => [...prev, data]);
        });

        // Call events
        socket.on('call_incoming', (data: IncomingCallEvent) => {
            setIncomingCall(data);
        });

        socket.on('call_started', (data: { callId: string }) => {
            setActiveCall(data.callId);
            setIncomingCall(null);
        });

        socket.on('call_ended', () => {
            setActiveCall(null);
            setIncomingCall(null);
        });

        socket.on('call_rejected', () => {
            setActiveCall(null);
            setIncomingCall(null);
        });

        return () => {
            s.disconnect();
        };
    }, []);

    const clearActivities = useCallback(() => {
        setActivities([]);
    }, []);

    return {
        isConnected,
        activities,
        lastOrderUpdate,
        graphVersion,
        chatMessages,
        clearActivities,
        socket,
        incomingCall,
        activeCall,
    };
}
