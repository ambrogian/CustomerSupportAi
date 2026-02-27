import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ActivityEvent {
    timestamp: string;
    source: string;
    message: string;
    data: Record<string, unknown>;
}

interface OrderUpdate {
    timestamp: string;
    orderId: string;
    status: string;
}

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [lastOrderUpdate, setLastOrderUpdate] = useState<OrderUpdate | null>(null);
    const [graphVersion, setGraphVersion] = useState(0);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // Connect to Flask-SocketIO backend
        const socket = io('http://localhost:3001', {
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

        // Activity feed events
        socket.on('activity', (event: ActivityEvent) => {
            setActivities(prev => [...prev, event]);
        });

        // Order status updates
        socket.on('order_updated', (data: OrderUpdate) => {
            setLastOrderUpdate(data);
        });

        // Graph data changed
        socket.on('graph_updated', () => {
            setGraphVersion(v => v + 1);
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
        clearActivities,
    };
}
