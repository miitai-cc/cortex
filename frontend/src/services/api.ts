import axios from 'axios';
import { useAuthStore } from 'eiva-fe-security';
import { API_BASE_URL, WS_BASE_URL } from '../config/env';
import { uploadDocumentStream, type DocumentIndexEvent } from '../grpc/documentWsClient';
import type { IssuePayload } from '../types/collaboration';
import type {
  PersonalProjectOverview,
  ProjectOverview,
  ProjectPayload,
  ProjectRecord,
  ProjectRecordPayload,
  ProjectRecordType,
} from '../types/projects';
import type {
  WorkflowDefinition,
  WorkflowInstanceDetail,
  WorkflowOverview,
  WorkflowTask,
} from '../types/workflows';
import type {
  AdminRecordPage,
  AdminRecordPayload,
  SystemContext,
} from '../types/systemAdmin';
import {
  LOGIN_PATH,
  rememberCurrentHashRoute,
  shouldRedirectToLogin,
} from '../utils/authNavigation';

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
    const authState = useAuthStore.getState();
    if (shouldRedirectToLogin(error, authState.token)) {
      rememberCurrentHashRoute();
      authState.logout();
      if (window.location.hash !== `#${LOGIN_PATH}`) {
        window.location.hash = `#${LOGIN_PATH}`;
      }
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
  activity: () => api.get('/dashboard/activity'),
  health: () => api.get('/dashboard/health'),
};

export type DepartmentItemStatus =
  | 'planned'
  | 'active'
  | 'pending_review'
  | 'blocked'
  | 'completed'
  | 'archived';

export type DepartmentItemPriority = 'low' | 'medium' | 'high' | 'critical';

export interface DepartmentItemPayload {
  itemType: string;
  title: string;
  description?: string;
  status: DepartmentItemStatus;
  priority: DepartmentItemPriority;
  ownerName?: string;
  amount?: number;
  dueDate?: string;
  metadata?: Record<string, unknown>;
}

export interface DepartmentItem extends DepartmentItemPayload {
  id: string;
  department: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  canEdit: boolean;
}

export interface DepartmentOverview {
  department: string;
  allowedItemTypes: string[];
  stats: {
    total: number;
    active: number;
    completed: number;
    blocked: number;
    highPriority: number;
    overdue: number;
    amountTotal: number;
  };
  items: DepartmentItem[];
  currentUser: { id: string; username: string; role: string };
}

export const departmentApi = {
  overview: (department: string) =>
    api.get<DepartmentOverview>(`/departments/${encodeURIComponent(department)}`),
  createItem: (department: string, data: DepartmentItemPayload) =>
    api.post<DepartmentItem>(`/departments/${encodeURIComponent(department)}/items`, data),
  updateItem: (department: string, id: string, data: DepartmentItemPayload) =>
    api.put<DepartmentItem>(
      `/departments/${encodeURIComponent(department)}/items/${encodeURIComponent(id)}`,
      data,
    ),
  deleteItem: (department: string, id: string) =>
    api.delete(`/departments/${encodeURIComponent(department)}/items/${encodeURIComponent(id)}`),
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

export const codexApi = {
  websocketUrl: (token: string) =>
    `${WS_BASE_URL}/codex/ws/prompt?token=${encodeURIComponent(token)}`,
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

export const collaborationApi = {
  overview: () => api.get('/collaboration/overview'),
  createWorkspace: (data: { name: string; description?: string }) =>
    api.post('/collaboration/workspaces', data),
  updateWorkspace: (id: string, data: { name: string; description?: string }) =>
    api.put(`/collaboration/workspaces/${id}`, data),
  deleteWorkspace: (id: string) => api.delete(`/collaboration/workspaces/${id}`),
  createChannel: (data: {
    workspaceId: string;
    name: string;
    description?: string;
    isPrivate?: boolean;
    memberIds?: string[];
  }) => api.post('/collaboration/channels', data),
  updateChannel: (
    id: string,
    data: {
      workspaceId: string;
      name: string;
      description?: string;
      isPrivate?: boolean;
      memberIds?: string[];
    },
  ) => api.put(`/collaboration/channels/${id}`, data),
  deleteChannel: (id: string) => api.delete(`/collaboration/channels/${id}`),
  members: (channelId: string) => api.get(`/collaboration/channels/${channelId}/members`),
  addMembers: (channelId: string, userIds: string[]) =>
    api.post(`/collaboration/channels/${channelId}/members`, { userIds }),
  removeMember: (channelId: string, userId: string) =>
    api.delete(`/collaboration/channels/${channelId}/members/${userId}`),
  markRead: (channelId: string) => api.post(`/collaboration/channels/${channelId}/read`),
  messages: (channelId: string, parentId?: string) =>
    api.get(`/collaboration/channels/${channelId}/messages`, {
      params: parentId ? { parent_id: parentId } : undefined,
    }),
  sendMessage: (
    channelId: string,
    data: { content: string; parentId?: string; issueId?: string },
  ) => api.post(`/collaboration/channels/${channelId}/messages`, data),
  updateMessage: (id: string, content: string) =>
    api.put(`/collaboration/messages/${id}`, { content }),
  deleteMessage: (id: string) => api.delete(`/collaboration/messages/${id}`),
  toggleReaction: (id: string, emoji: string) =>
    api.post(`/collaboration/messages/${id}/reactions`, { emoji }),
  searchMessages: (q: string, channelId?: string) =>
    api.get('/collaboration/messages/search', { params: { q, channel_id: channelId } }),
  issues: (params?: { q?: string; status?: string; assignee_id?: string; channel_id?: string }) =>
    api.get('/collaboration/issues', { params }),
  issue: (id: string) => api.get(`/collaboration/issues/${id}`),
  createIssue: (data: IssuePayload) => api.post('/collaboration/issues', data),
  updateIssue: (id: string, data: IssuePayload) => api.put(`/collaboration/issues/${id}`, data),
  deleteIssue: (id: string) => api.delete(`/collaboration/issues/${id}`),
  issueComments: (id: string) => api.get(`/collaboration/issues/${id}/comments`),
  addIssueComment: (id: string, content: string) =>
    api.post(`/collaboration/issues/${id}/comments`, { content }),
  updateIssueComment: (issueId: string, commentId: string, content: string) =>
    api.put(`/collaboration/issues/${issueId}/comments/${commentId}`, { content }),
  deleteIssueComment: (issueId: string, commentId: string) =>
    api.delete(`/collaboration/issues/${issueId}/comments/${commentId}`),
  issueHistory: (id: string) => api.get(`/collaboration/issues/${id}/history`),
  websocketUrl: (channelId: string, token: string) =>
    `${WS_BASE_URL}/collaboration/ws?channel_id=${encodeURIComponent(channelId)}&token=${encodeURIComponent(token)}`,
};

export const projectApi = {
  overview: (projectId?: string) =>
    api.get<ProjectOverview>('/projects', {
      params: projectId ? { project_id: projectId } : undefined,
    }),
  personal: () => api.get<PersonalProjectOverview>('/projects/personal'),
  createProject: (data: ProjectPayload) => api.post('/projects', data),
  updateProject: (id: string, data: ProjectPayload) => api.put(`/projects/${id}`, data),
  deleteProject: (id: string) => api.delete(`/projects/${id}`),
  createRecord: (projectId: string, recordType: ProjectRecordType, data: ProjectRecordPayload) =>
    api.post<ProjectRecord>(`/projects/${projectId}/records/${recordType}`, data),
  updateRecord: (
    projectId: string,
    recordType: ProjectRecordType,
    id: string,
    data: ProjectRecordPayload,
  ) => api.put<ProjectRecord>(`/projects/${projectId}/records/${recordType}/${id}`, data),
  deleteRecord: (projectId: string, recordType: ProjectRecordType, id: string) =>
    api.delete(`/projects/${projectId}/records/${recordType}/${id}`),
};

export const workflowApi = {
  overview: () => api.get<WorkflowOverview>('/workflows'),
  definition: (key: string) => api.get<WorkflowDefinition>(`/workflow/${encodeURIComponent(key)}`),
  publish: (key: string) => api.post(`/workflow/${encodeURIComponent(key)}/publish`),
  archive: (key: string) => api.delete(`/workflow/${encodeURIComponent(key)}`),
  run: (key: string, input: Record<string, unknown>) =>
    api.post(`/workflow/${encodeURIComponent(key)}/run`, input),
  instances: (all = false) => api.get('/workflow/instances', { params: all ? { all: true } : undefined }),
  instance: (id: string) => api.get<WorkflowInstanceDetail>(`/workflow/instances/${id}`),
  tasks: (all = false) => api.get<{ tasks: WorkflowTask[] }>('/workflow/tasks', { params: all ? { all: true } : undefined }),
  decideTask: (id: string, data: { action: 'approved' | 'rejected'; comment?: string; formData?: Record<string, unknown> }) =>
    api.put(`/workflow/tasks/${id}`, data),
};

export interface CommonSystemLink {
  label: string;
  url: string;
}

export interface EnterpriseSystemLink {
  label: string;
  url: string;
  category: string;
  area: string;
}

export interface SystemSettingsPayload {
  embeddingModel: string;
  rerankingModel: string;
  pageindexModel: string;
  openaiBaseUrl: string;
  pageindexBaseUrl: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  commonLinks: CommonSystemLink[];
  imapServer?: string;
  imapPort?: string;
  imapUsername?: string;
  smtpServer?: string;
  smtpPort?: string;
  smtpUsername?: string;
  googleMailApiEnabled?: boolean;
  enterpriseSystems: EnterpriseSystemLink[];
}

export interface SystemSettingsResponse extends SystemSettingsPayload {
  openaiApiKeyConfigured: boolean;
  pageindexApiKeyConfigured: boolean;
  restartRequired: boolean;
  systemVersion: string;
}

export const systemSettingsApi = {
  get: () => api.get<SystemSettingsResponse>('/settings/system'),
  update: (data: SystemSettingsPayload) => api.put('/settings/system', data),
};

export const usersDirectoryApi = {
  getUsers: () => api.get('/settings/directory'),
};

export const systemAdminApi = {
  context: () => api.get<SystemContext>('/settings/context'),
  list: (entity: string, params: { page: number; pageSize: number; search?: string }) =>
    api.get<AdminRecordPage>(`/settings/admin/${encodeURIComponent(entity)}`, { params }),
  create: (entity: string, data: AdminRecordPayload) =>
    api.post(`/settings/admin/${encodeURIComponent(entity)}`, data),
  update: (entity: string, id: string, data: AdminRecordPayload) =>
    api.put(`/settings/admin/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`, data),
  delete: (entity: string, id: string) =>
    api.delete(`/settings/admin/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`),
};
