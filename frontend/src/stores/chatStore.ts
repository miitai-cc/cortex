import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: any[];
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  setActiveConversation: (id: string) => void;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamingContent: (content: string) => void;
  resetStreaming: () => void;
  finalizeStream: (conversationId: string, references?: any[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  streamingContent: '',

  setActiveConversation: (id) => set({ activeConversationId: id }),

  createConversation: () => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const conv: Conversation = {
      id,
      title: '新對話',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversationId: id,
    }));
    return id;
  },

  deleteConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId:
        s.activeConversationId === id
          ? s.conversations.find((c) => c.id !== id)?.id ?? null
          : s.activeConversationId,
    })),

  renameConversation: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      ),
    })),

  addMessage: (conversationId, message) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() }
          : c
      ),
    })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  appendStreamingContent: (content) =>
    set((s) => ({ streamingContent: s.streamingContent + content })),

  resetStreaming: () => set({ streamingContent: '' }),

  finalizeStream: (conversationId, references) => {
    const { streamingContent, conversations } = get();
    if (!streamingContent) {
      set({ isStreaming: false });
      return;
    }
    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: streamingContent,
      references: references || [],
      timestamp: Date.now(),
    };
    const firstMsg = conversations.find((c) => c.id === conversationId)?.messages[0];
    const title = firstMsg
      ? firstMsg.content.slice(0, 40) + (firstMsg.content.length > 40 ? '...' : '')
      : '新對話';

    set({
      conversations: conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, newMsg], title, updatedAt: Date.now() }
          : c
      ),
      isStreaming: false,
      streamingContent: '',
    });
  },
}));
