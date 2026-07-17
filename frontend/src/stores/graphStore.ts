import { create } from 'zustand';

export interface GraphNodeData {
  id: string;
  label: string;
  type: string;
  size: number;
  link_count: number;
}

export interface GraphEdgeData {
  source: string;
  target: string;
  weight: number;
  label: string;
}

export interface GraphData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

interface GraphState {
  data: GraphData | null;
  loading: boolean;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  colorMode: 'type' | 'community';
  nodeScale: number;
  setData: (data: GraphData) => void;
  setLoading: (loading: boolean) => void;
  setSelectedNode: (id: string | null) => void;
  setHoveredNode: (id: string | null) => void;
  setColorMode: (mode: 'type' | 'community') => void;
  setNodeScale: (scale: number) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  data: null,
  loading: false,
  selectedNodeId: null,
  hoveredNodeId: null,
  colorMode: 'type',
  nodeScale: 1.0,

  setData: (data) => set({ data }),
  setLoading: (loading) => set({ loading }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setNodeScale: (scale) => set({ nodeScale: scale }),
}));
