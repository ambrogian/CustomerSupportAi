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
  customerId?: string | null;
}

const NODE_COLORS: Record<string, string> = {
  Customer: '#06b6d4',
  Order: '#a855f7',
  Issue: '#ef4444',
  Resolution: '#22c55e',
  CallSession: '#f59e0b',
  Transcript: '#ec4899',
};

const NODE_SIZES: Record<string, number> = {
  Customer: 10,
  Order: 8,
  Issue: 7,
  Resolution: 6,
};

export default function GraphPanel({ graphVersion, customerId }: Props) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'nodes' | 'clusters'>('nodes');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [lastChange, setLastChange] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  const fetchGraph = useCallback(async () => {
    try {
      const url = customerId ? `/api/graph?customerId=${customerId}` : '/api/graph';
      const res = await fetch(url);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (!data.nodes || !data.links) { setLoading(false); return; }

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

      // Track new connections
      if (graphData.nodes.length > 0 && nodes.length > graphData.nodes.length) {
        const newNode = nodes[nodes.length - 1];
        setLastChange(`${newNode._labels?.[0] || 'Node'}: ${newNode.name || newNode.product || newNode.type || newNode.id}`);
        setTimeout(() => setLastChange(null), 8000);
      }

      setGraphData({ nodes, links });
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch graph:', err);
      setLoading(false);
    }
  }, [graphData.nodes.length, customerId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph, graphVersion]);

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

    // Outer glow
    ctx.beginPath();
    ctx.arc(node.x, node.y, size + 5, 0, 2 * Math.PI);
    ctx.fillStyle = color + '15';
    ctx.fill();

    // Inner glow
    ctx.beginPath();
    ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI);
    ctx.fillStyle = color + '25';
    ctx.fill();

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color + '60';
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

  const totalNodes = graphData.nodes.length;
  const totalLinks = graphData.links.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <div className="panel-header-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-purple)' }}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="panel-title">Knowledge Neural Map</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="graph-toggle-group">
              <button
                className={`graph-toggle-btn ${viewMode === 'nodes' ? 'active' : ''}`}
                onClick={() => setViewMode('nodes')}
              >
                Nodes
              </button>
              <button
                className={`graph-toggle-btn ${viewMode === 'clusters' ? 'active' : ''}`}
                onClick={() => setViewMode('clusters')}
              >
                Clusters
              </button>
            </div>
            <button className="graph-expand-btn" title="Fullscreen">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>
        <div className="panel-subtitle">
          Visualizing {totalNodes} active nodes and {totalLinks} relationships
        </div>
      </div>
      <div
        ref={containerRef}
        className="graph-container"
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
      >
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
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
            onNodeClick={(node: any) => setSelectedNode(node)}
            onBackgroundClick={() => setSelectedNode(null)}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={() => 'rgba(168, 85, 247, 0.15)'}
            linkWidth={1.5}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.85}
            linkDirectionalArrowColor={() => 'rgba(168, 85, 247, 0.4)'}
            linkLabel={(link: any) => link.type}
            d3VelocityDecay={0.3}
            cooldownTicks={100}
            warmupTicks={50}
          />
        )}

        {/* New Connection overlay */}
        {lastChange && (
          <div className="graph-new-connection">
            <div className="graph-new-connection-label">New Connection</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              {lastChange}
            </div>
          </div>
        )}

        {/* Node Inspector Overlay */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 260,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px',
            color: '#f8fafc',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: 'calc(100% - 32px)',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                fontWeight: 600,
                fontSize: '14px',
                color: selectedNode.color as string,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: selectedNode.color as string
                }} />
                {selectedNode._labels?.[0] || 'Node'}
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '4px'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(selectedNode)
                .filter(([k, v]) => !['x', 'y', 'vx', 'vy', 'index', 'color', 'val', 'label', '_labels'].includes(k) && v !== undefined && v !== null)
                .map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', flexDirection: 'column', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                      {k}
                    </span>
                    <span style={{ fontSize: '12px', wordBreak: 'break-word', color: '#e2e8f0' }}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
