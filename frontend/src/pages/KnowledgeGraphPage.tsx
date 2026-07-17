import { useEffect, useRef, useState, useCallback } from 'react';
import { graphApi } from '../services/api';
import { useGraphStore } from '../stores/graphStore';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  Layers,
  Type,
  AlertTriangle,
} from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  'application/pdf': '#ef4444',
  'text/plain': '#3b82f6',
  'text/markdown': '#10b981',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '#f59e0b',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '#8b5cf6',
};

const COMMUNITY_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f97316',
  '#84cc16', '#06b6d4', '#a855f7', '#e11d48',
  '#0ea5e9', '#65a30d', '#d946ef', '#0891b2',
];

export default function KnowledgeGraphPage() {
  const {
    data,
    loading,
    setData,
    setLoading,
    selectedNodeId,
    setSelectedNode,
    colorMode,
    setColorMode,
  } = useGraphStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [insights, setInsights] = useState<{
    isolated: string[];
    bridges: string[];
    communities: Record<number, string[]>;
  }>({ isolated: [], bridges: [], communities: {} });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await graphApi.getData();
      setData(res.data);
      initPositions(res.data);
      analyzeGraph(res.data);
    } catch (e) {
      console.error('Failed to load graph data', e);
    } finally {
      setLoading(false);
    }
  };

  const initPositions = (graphData: { nodes: { id: string }[]; edges: { source: string; target: string }[] }) => {
    const pos = new Map<string, { x: number; y: number }>();
    const centerX = 400;
    const centerY = 300;
    const radius = 200;

    graphData.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / graphData.nodes.length;
      pos.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    // Simple force-directed layout iterations
    const iterations = 50;
    let currentPos = new Map(pos);

    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map<string, { fx: number; fy: number }>();
      for (const n of graphData.nodes) {
        forces.set(n.id, { fx: 0, fy: 0 });
      }

      // Repulsion between all nodes
      const repulsionStrength = 5000;
      for (let i = 0; i < graphData.nodes.length; i++) {
        for (let j = i + 1; j < graphData.nodes.length; j++) {
          const a = currentPos.get(graphData.nodes[i].id)!;
          const b = currentPos.get(graphData.nodes[j].id)!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = repulsionStrength / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          forces.get(graphData.nodes[i].id)!.fx += fx;
          forces.get(graphData.nodes[i].id)!.fy += fy;
          forces.get(graphData.nodes[j].id)!.fx -= fx;
          forces.get(graphData.nodes[j].id)!.fy -= fy;
        }
      }

      // Attraction along edges
      const attractionStrength = 0.01;
      for (const edge of graphData.edges) {
        const a = currentPos.get(edge.source);
        const b = currentPos.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = dist * attractionStrength;
        const fx = (dx / Math.max(dist, 1)) * force;
        const fy = (dy / Math.max(dist, 1)) * force;
        forces.get(edge.source)!.fx += fx;
        forces.get(edge.source)!.fy += fy;
        forces.get(edge.target)!.fx -= fx;
        forces.get(edge.target)!.fy -= fy;
      }

      // Center gravity
      const gravity = 0.01;
      for (const n of graphData.nodes) {
        const p = currentPos.get(n.id)!;
        forces.get(n.id)!.fx -= (p.x - centerX) * gravity;
        forces.get(n.id)!.fy -= (p.y - centerY) * gravity;
      }

      // Apply forces
      const damping = 0.5;
      for (const [id, f] of forces) {
        const p = currentPos.get(id)!;
        p.x += f.fx * damping;
        p.y += f.fy * damping;
      }
    }

    setPositions(currentPos);
  };

  const analyzeGraph = (graphData: { nodes: { id: string; label: string }[]; edges: { source: string; target: string }[] }) => {
    const adj = new Map<string, Set<string>>();
    for (const n of graphData.nodes) adj.set(n.id, new Set());
    for (const e of graphData.edges) {
      adj.get(e.source)?.add(e.target);
      adj.get(e.target)?.add(e.source);
    }

    const isolated = graphData.nodes.filter((n) => (adj.get(n.id)?.size ?? 0) <= 1).map((n) => n.label);

    // Simple community detection via BFS
    const visited = new Set<string>();
    const communities: Record<number, string[]> = {};
    let commId = 0;

    for (const n of graphData.nodes) {
      if (visited.has(n.id)) continue;
      const queue = [n.id];
      const members: string[] = [];
      visited.add(n.id);
      while (queue.length > 0) {
        const current = queue.shift()!;
        members.push(current);
        for (const neighbor of adj.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      if (members.length > 1) {
        communities[commId] = members;
        commId++;
      }
    }

    // Bridge nodes (connecting multiple communities)
    const nodeCommunity = new Map<string, number>();
    for (const [cid, members] of Object.entries(communities)) {
      for (const m of members) {
        nodeCommunity.set(m, Number(cid));
      }
    }
    const bridgeNodes = new Set<string>();
    for (const n of graphData.nodes) {
      const comms = new Set<number>();
      for (const neighbor of adj.get(n.id) ?? []) {
        const nc = nodeCommunity.get(neighbor);
        if (nc !== undefined) comms.add(nc);
      }
      if (comms.size >= 2) bridgeNodes.add(n.id);
    }
    const bridgeLabels = graphData.nodes.filter((n) => bridgeNodes.has(n.id)).map((n) => n.label);

    setInsights({ isolated, bridges: bridgeLabels, communities });
  };

  const renderGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + offset.x, h / 2 + offset.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    for (const edge of data.edges) {
      const src = positions.get(edge.source);
      const tgt = positions.get(edge.target);
      if (!src || !tgt) continue;

      ctx.beginPath();
      ctx.moveTo(src.x - 400, src.y - 300);
      ctx.lineTo(tgt.x - 400, tgt.y - 300);

      const alpha = Math.min(edge.weight * 0.5, 0.8);
      ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
      ctx.lineWidth = Math.max(edge.weight * 2, 0.5);
      ctx.stroke();
    }

    // Draw nodes
    for (const node of data.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const x = pos.x - 400;
      const y = pos.y - 300;
      const radius = Math.max(node.size * 3, 5);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);

      let color = '#6366f1';
      if (colorMode === 'type') {
        color = TYPE_COLORS[node.type] || '#6366f1';
      } else {
        const communityIdx = Object.entries(insights.communities).findIndex(([, members]) =>
          members.includes(node.id)
        );
        color = COMMUNITY_COLORS[communityIdx % COMMUNITY_COLORS.length] || '#6366f1';
      }

      ctx.fillStyle = color;
      ctx.fill();

      if (node.id === selectedNodeId) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = '#374151';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label, x, y + radius + 14);
    }

    ctx.restore();

    animationRef.current = requestAnimationFrame(() => renderGraph());
  }, [data, positions, zoom, offset, colorMode, selectedNodeId, insights]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(() => renderGraph());
    return () => cancelAnimationFrame(animationRef.current);
  }, [renderGraph]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(z * delta, 5)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = (e.clientX - rect.left - rect.width / 2 - offset.x) / zoom + 400;
    const my = (e.clientY - rect.top - rect.height / 2 - offset.y) / zoom + 300;

    let closest: string | null = null;
    let closestDist = 20;

    for (const node of data.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const dist = Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = node.id;
      }
    }

    setSelectedNode(closest === selectedNodeId ? null : closest);
  }, [data, positions, zoom, offset, selectedNodeId]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const selectedNode = data?.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex h-full">
      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        />

        {/* Graph controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.3, 5))}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.3, 0.1))}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600"
            title="縮小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-600"
            title="重設視圖"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Color mode toggle */}
        <div className="absolute top-4 right-4 flex gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <button
            onClick={() => setColorMode('type')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              colorMode === 'type' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Type className="w-3.5 h-3.5 inline mr-1" />
            類型
          </button>
          <button
            onClick={() => setColorMode('community')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              colorMode === 'community' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5 inline mr-1" />
            社群
          </button>
        </div>

        {/* Statistics overlay */}
        {data && (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-gray-500 shadow-sm border border-gray-200">
            節點: {data.nodes.length} | 邊: {data.edges.length}
          </div>
        )}
      </div>

      {/* Insights panel */}
      <div className="w-72 bg-white border-l border-gray-200 overflow-auto p-4 shrink-0">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">圖譜洞察</h3>

        {selectedNode && (
          <div className="mb-4 p-3 bg-primary-50 rounded-lg">
            <p className="text-xs text-primary-600 font-medium mb-1">選中節點</p>
            <p className="text-sm font-medium text-gray-800">{selectedNode.label}</p>
            <p className="text-xs text-gray-500 mt-1">類型: {selectedNode.type}</p>
            <p className="text-xs text-gray-500">連接數: {selectedNode.link_count}</p>
          </div>
        )}

        {insights.isolated.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-700">孤立節點 ({insights.isolated.length})</span>
            </div>
            <div className="space-y-1">
              {insights.isolated.slice(0, 10).map((label) => (
                <div key={label} className="text-xs text-gray-500 bg-amber-50 px-2 py-1 rounded">
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {insights.bridges.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">橋接節點 ({insights.bridges.length})</span>
            </div>
            <div className="space-y-1">
              {insights.bridges.slice(0, 10).map((label) => (
                <div key={label} className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs text-gray-400">
            拖曳畫布移動視圖 · 滾輪縮放 · 點擊節點查看詳情
          </p>
        </div>
      </div>
    </div>
  );
}
