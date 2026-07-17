import axios from 'axios';
import { useAuthStore } from 'eiva-fe-security';
import { API_BASE_URL } from '../config/env';

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
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export const searchApi = {
  query: (params: { query: string; top_k?: number; use_hybrid?: boolean }) =>
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
