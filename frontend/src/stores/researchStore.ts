import { create } from 'zustand';

export interface ResearchTask {
  id: string;
  topic: string;
  status: 'queued' | 'searching' | 'synthesizing' | 'completed' | 'error';
  queries: string[];
  results?: string[];
  synthesis?: string;
  createdAt: number;
}

interface ResearchState {
  tasks: ResearchTask[];
  panelOpen: boolean;
  addTask: (topic: string, queries: string[]) => string;
  updateTask: (id: string, updates: Partial<ResearchTask>) => void;
  removeTask: (id: string) => void;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
}

export const useResearchStore = create<ResearchState>((set) => ({
  tasks: [],
  panelOpen: false,

  addTask: (topic, queries) => {
    const id = crypto.randomUUID();
    const task: ResearchTask = {
      id,
      topic,
      status: 'queued',
      queries,
      createdAt: Date.now(),
    };
    set((s) => ({ tasks: [task, ...s.tasks], panelOpen: true }));
    return id;
  },

  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeTask: (id) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
    })),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
}));
