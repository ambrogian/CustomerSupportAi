import { useEffect, useState } from 'react';

interface Order {
    orderId: string;
    customerId: string;
    customerName: string;
    tier: string;
    product: string;
    status: string;
    carrier: string;
    total: number;
    trackingUrl: string;
    estimatedDelivery: string;
}

interface OrderUpdate {
    orderId: string;
    status: string;
}

interface Props {
    lastOrderUpdate: OrderUpdate | null;
}

export default function OrdersPanel({ lastOrderUpdate }: Props) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch orders on mount
    useEffect(() => {
        fetch('http://localhost:3001/api/orders')
            .then(res => res.json())
            .then(data => {
                setOrders(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch orders:', err);
                setLoading(false);
            });
    }, []);

    // Update order status when WebSocket event fires
    useEffect(() => {
        if (lastOrderUpdate) {
            setOrders(prev =>
                prev.map(o =>
                    o.orderId === lastOrderUpdate.orderId
                        ? { ...o, status: lastOrderUpdate.status }
                        : o
                )
            );
        }
    }, [lastOrderUpdate]);

    const getBadgeClass = (status: string): string => {
        switch (status) {
            case 'shipped': return 'badge badge-shipped';
            case 'delayed': return 'badge badge-delayed';
            case 'resolved': return 'badge badge-resolved';
            case 'delivered': return 'badge badge-delivered';
            default: return 'badge';
        }
    };

    const getTierBadge = (tier: string) => (
        <span style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            background: tier === 'vip' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
            color: tier === 'vip' ? '#f59e0b' : '#6b7280',
            letterSpacing: '1px',
        }}>
            {tier.toUpperCase()}
        </span>
    );

    if (loading) {
        return (
            <div className="card">
                <div className="card-header">
                    <span>📦</span>
                    <h2>Live Orders</h2>
                </div>
                <div className="card-body" style={{ textAlign: 'center', padding: '40px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Loading orders...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <span>📦</span>
                <h2>Live Orders</h2>
                <span style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                }}>
                    {orders.length} orders
                </span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{
                            borderBottom: '1px solid var(--border-color)',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            <th style={{ padding: '10px 16px', textAlign: 'left' }}>Order</th>
                            <th style={{ padding: '10px 16px', textAlign: 'left' }}>Customer</th>
                            <th style={{ padding: '10px 16px', textAlign: 'left' }}>Product</th>
                            <th style={{ padding: '10px 16px', textAlign: 'left' }}>Carrier</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order, idx) => (
                            <tr key={order.orderId} className="animate-fade-in" style={{
                                borderBottom: idx < orders.length - 1 ? '1px solid var(--border-color)' : 'none',
                                animationDelay: `${idx * 0.1}s`,
                            }}>
                                <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px' }}>
                                    #{order.orderId.replace('order-', '')}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '13px' }}>{order.customerName}</span>
                                        {getTierBadge(order.tier)}
                                    </div>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {order.product}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {order.carrier}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                                    ${order.total?.toFixed(2)}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                    <span className={getBadgeClass(order.status)}>{order.status}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
