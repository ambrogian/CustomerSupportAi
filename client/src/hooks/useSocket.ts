import { useEffect, useState, useCallback, useRef } from 'react';
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

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [lastOrderUpdate, setLastOrderUpdate] = useState<OrderUpdate | null>(null);
    const [graphVersion, setGraphVersion] = useState(0);
    const [chatMessages, setChatMessages] = useState<ChatMessageEvent[]>([]);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // Connect via Vite proxy (relative URL)
        const socket = io({
            transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            console.log('[WS] Connected');
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('[WS] Disconnected');
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

        // Live chat messages from customer ↔ agent conversations
        socket.on('chat_message', (data: ChatMessageEvent) => {
            setChatMessages(prev => [...prev, data]);
        });

        return () => {
            socket.disconnect();
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
    };
}
