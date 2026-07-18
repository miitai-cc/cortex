import axios from 'axios';
import { useAuthStore } from 'eiva-fe-security';
import { API_BASE_URL, WS_BASE_URL } from '../config/env';
import { uploadDocumentStream, type DocumentIndexEvent } from '../grpc/documentWsClient';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const documentApi = {
  list: (params?: any) => api.get('/documents', { params }),
  get: (id: string) => api.get(`/documents/${id}`),
  preview: (id: string) => api.get(`/documents/${id}/preview`),
  upload: (file: File, onEvent: (event: DocumentIndexEvent) => void, directory = '/') =>
    uploadDocumentStream(
      `${WS_BASE_URL}/documents/ws/upload?filename=${encodeURIComponent(file.name)}&content_type=${encodeURIComponent(file.type || 'application/octet-stream')}&directory=${encodeURIComponent(directory)}`,
      file,
      onEvent,
    ),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export const directoryApi = {
  list: (path = '/') => api.get('/documents/directories', { params: { path } }),
  create: (parent: string, name: string) => api.post('/documents/directories', { parent, name }),
  copy: (path: string) => api.post('/documents/directories/copy', { path }),
  delete: (path: string) => api.delete('/documents/directories', { params: { path } }),
};

export type ContentSaveRequest = {
  title: string;
  content_kind: 'markdown' | 'web' | 'database';
  directory: string;
  content?: string;
  source_url?: string;
  sql_query?: string;
  change_note?: string;
  rag_enabled: boolean;
  pageindex_enabled: boolean;
};

export const contentApi = {
  list: () => api.get('/content'),
  create: (data: ContentSaveRequest) => api.post('/content', data),
  update: (id: string, data: ContentSaveRequest) => api.put(`/content/${id}`, data),
  versions: (id: string) => api.get(`/content/${id}/versions`),
  importVersion: (data: { content_id?: string; document_id: string; title: string; directory: string; change_note?: string }) => api.post('/content/import-version', data),
};

export const knowledgeApi = {
  overview: () => api.get('/knowledge/overview'),
  createRecord: (data: any) => api.post('/knowledge/records', data),
  updateRecord: (id: string, data: any) => api.put(`/knowledge/records/${id}`, data),
  deleteRecord: (id: string) => api.delete(`/knowledge/records/${id}`),
  reviewRecord: (id: string, data: { status: string; reviewer_id?: string; comment?: string }) => api.put(`/knowledge/records/${id}/review`, data),
  interact: (data: any) => api.post('/knowledge/interactions', data),
  saveExpert: (data: any) => api.post('/knowledge/experts', data),
  comments: (id: string) => api.get(`/knowledge/records/${id}/comments`),
  addComment: (id: string, data: { content: string; parent_id?: string }) => api.post(`/knowledge/records/${id}/comments`, data),
  bestAnswer: (id: string, comment_id: string) => api.put(`/knowledge/records/${id}/best-answer`, { comment_id }),
  createCategory: (data: any) => api.post('/knowledge/categories', data),
  updateCategory: (id: string, data: any) => api.put(`/knowledge/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/knowledge/categories/${id}`),
};

export const searchApi = {
  query: (params: { query: string; top_k?: number; use_hybrid?: boolean; document_ids?: string[] }) =>
    api.post('/rag/query', params),
};

export const healthApi = {
  check: () => api.get('/health'),
};

export const chatApi = {
  send: (data: { conversation_id?: string; message: string; history?: { role: string; content: string }[] }) =>
    api.post('/chat/send', data),
  listConversations: () => api.get('/chat/conversations'),
  deleteConversation: (id: string) => api.delete(`/chat/conversations/${id}`),
};

export const graphApi = {
  getData: () => api.get('/graph/data'),
};

export const researchApi = {
  start: (data: { topic: string; queries: string[] }) => api.post('/research/start', data),
  list: () => api.get('/research/list'),
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  queryTrend: () => api.get('/dashboard/query-trend'),
};

export const contextApi = {
  getDocuments: () => api.get('/documents'),
  getSettings: () => api.get('/chat/context/settings'),
  updateSettings: (settings: any) => api.put('/chat/context/settings', settings),
};

export const aiModelApi = {
  embed: (text: string) => api.post('/rag/embed', { text }),
  rerank: (query: string, documents: string[]) => api.post('/rag/rerank', { query, documents }),
};

export const indexingApi = {
  /** 建立索引：Returns the WebSocket URL for gitnexus index streaming */
  gitNexusWsUrl: (relative_path: string): string =>
    `${WS_BASE_URL}/indexing/ws/gitnexus?relative_path=${encodeURIComponent(relative_path)}`,
  /** 建立索引：Returns the WebSocket URL for graphify index streaming */
  graphifyWsUrl: (relative_path: string): string =>
    `${WS_BASE_URL}/indexing/ws/graphify?relative_path=${encodeURIComponent(relative_path)}`,
  /** 啟始：Starts the GitNexus HTTP server (gitnexus serve, port 4747, no path needed) */
  gitNexusServeWsUrl: (): string =>
    `${WS_BASE_URL}/indexing/ws/gitnexus/serve`,
  /** 啟始：Runs full Graphify semantic extraction (graphify extract <path>) */
  graphifyExtractWsUrl: (relative_path: string): string =>
    `${WS_BASE_URL}/indexing/ws/graphify/extract?relative_path=${encodeURIComponent(relative_path)}`,
};
