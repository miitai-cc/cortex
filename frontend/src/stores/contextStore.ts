import { create } from 'zustand';

export interface ContextDocument {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  chunk_count: number;
}

export interface ContextSettings {
  topK: number;
  useHybrid: boolean;
  similarityThreshold: number;
  includeMetadata: boolean;
}

interface ContextState {
  selectedDocs: ContextDocument[];
  settings: ContextSettings;
  panelOpen: boolean;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  addDocument: (doc: ContextDocument) => void;
  removeDocument: (id: string) => void;
  toggleDocument: (doc: ContextDocument) => void;
  clearDocuments: () => void;
  selectAll: (docs: ContextDocument[]) => void;
  updateSettings: (settings: Partial<ContextSettings>) => void;
  isSelected: (id: string) => boolean;
}

export const useContextStore = create<ContextState>((set, get) => ({
  selectedDocs: [],
  settings: {
    topK: 5,
    useHybrid: true,
    similarityThreshold: 0.7,
    includeMetadata: true,
  },
  panelOpen: false,

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),

  addDocument: (doc) =>
    set((s) => {
      if (s.selectedDocs.find((d) => d.id === doc.id)) return s;
      return { selectedDocs: [...s.selectedDocs, doc] };
    }),

  removeDocument: (id) =>
    set((s) => ({
      selectedDocs: s.selectedDocs.filter((d) => d.id !== id),
    })),

  toggleDocument: (doc) =>
    set((s) => {
      const exists = s.selectedDocs.find((d) => d.id === doc.id);
      if (exists) {
        return { selectedDocs: s.selectedDocs.filter((d) => d.id !== doc.id) };
      }
      return { selectedDocs: [...s.selectedDocs, doc] };
    }),

  clearDocuments: () => set({ selectedDocs: [] }),

  selectAll: (docs) => set({ selectedDocs: [...docs] }),

  updateSettings: (updates) =>
    set((s) => ({
      settings: { ...s.settings, ...updates },
    })),

  isSelected: (id) => get().selectedDocs.some((d) => d.id === id),
}));
