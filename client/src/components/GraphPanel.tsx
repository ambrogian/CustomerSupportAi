import { useEffect, useState, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface GraphNode {
    id: string;
    _labels: string[];
    name?: string;
    product?: string;
    type?: string;
    action?: string;
    [key: string]: unknown;
}

interface GraphLink {
    source: string;
    target: string;
    type: string;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface Props {
    graphVersion: number;
}

const NODE_COLORS: Record<string, string> = {
    Customer: '#3b82f6',
    Order: '#f59e0b',
    Issue: '#ef4444',
    Resolution: '#22c55e',
};

const NODE_SIZES: Record<string, number> = {
    Customer: 10,
    Order: 8,
    Issue: 7,
    Resolution: 6,
};

export default function GraphPanel({ graphVersion }: Props) {
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

    const fetchGraph = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/graph');
            const data = await res.json();

            // Transform for force-graph
            const nodes = data.nodes.map((n: GraphNode) => ({
                ...n,
                id: n.id,
                label: n._labels?.[0] || 'Unknown',
                color: NODE_COLORS[n._labels?.[0]] || '#6b7280',
                val: NODE_SIZES[n._labels?.[0]] || 5,
            }));

            const links = data.links.map((l: GraphLink) => ({
                source: l.source,
                target: l.target,
                type: l.type,
            }));

            setGraphData({ nodes, links });
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch graph:', err);
            setLoading(false);
        }
    }, []);

    // Fetch on mount and whenever graph version changes (new nodes added)
    useEffect(() => {
        fetchGraph();
    }, [fetchGraph, graphVersion]);

    // Measure container dimensions
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDimensions({ width: rect.width, height: Math.max(rect.height, 280) });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
        const label = node._labels?.[0] || '';
        const displayName = node.name || node.product || node.type || node.action || node.id;
        const size = node.val || 5;
        const color = node.color || '#6b7280';

        // Glow effect
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
        ctx.fillStyle = color + '20';
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = color + '80';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f1f5f9';
        const shortName = String(displayName).length > 15
            ? String(displayName).substring(0, 12) + '...'
            : displayName;
        ctx.fillText(shortName, node.x, node.y + size + 12);

        // Type badge
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = color + 'cc';
        ctx.fillText(label, node.x, node.y + size + 22);
    }, []);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="card-header">
                <span>🕸️</span>
                <h2>Knowledge Graph</h2>
                <div style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    gap: '12px',
                    fontSize: '11px',
                }}>
                    {Object.entries(NODE_COLORS).map(([label, color]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: color,
                            }} />
                            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div
                ref={containerRef}
                className="graph-container"
                style={{ flex: 1, minHeight: '280px' }}
            >
                {loading ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '280px',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                    }}>
                        Loading graph...
                    </div>
                ) : (
                    <ForceGraph2D
                        graphData={graphData}
                        width={dimensions.width}
                        height={dimensions.height}
                        backgroundColor="transparent"
                        nodeCanvasObject={nodeCanvasObject}
                        nodePointerAreaPaint={(node: any, color, ctx) => {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI);
                            ctx.fillStyle = color;
                            ctx.fill();
                        }}
                        linkColor={() => '#2a3041'}
                        linkWidth={1.5}
                        linkDirectionalArrowLength={4}
                        linkDirectionalArrowRelPos={0.85}
                        linkDirectionalArrowColor={() => '#4a5568'}
                        linkLabel={(link: any) => link.type}
                        d3VelocityDecay={0.3}
                        cooldownTicks={100}
                        warmupTicks={50}
                    />
                )}
            </div>
        </div>
    );
}
