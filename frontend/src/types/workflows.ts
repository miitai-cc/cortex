export type WorkflowDefinitionStatus = 'draft' | 'published' | 'archived';
export type WorkflowInstanceStatus = 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
export type WorkflowTaskStatus = 'pending' | 'approved' | 'rejected';

export interface WorkflowDefinition {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: WorkflowDefinitionStatus;
  currentVersion: number;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  canEdit: boolean;
  nodes?: unknown[];
  edges?: unknown[];
}

export interface WorkflowUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface WorkflowOverview {
  workflows: string[];
  definitions: WorkflowDefinition[];
  stats: {
    definitions: number;
    published: number;
    queued?: number;
    running: number;
    waiting: number;
    completed: number;
    failed: number;
    pendingTasks: number;
  };
  users: WorkflowUser[];
  currentUser: WorkflowUser;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowKey: string;
  version: number;
  status: WorkflowInstanceStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  currentNodeId?: string;
  startedBy: string;
  startedByName: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface WorkflowStepRun {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: string;
  output?: unknown;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowTask {
  id: string;
  instanceId: string;
  nodeId: string;
  title: string;
  instructions?: string;
  assigneeId: string;
  assigneeName: string;
  status: WorkflowTaskStatus;
  dueDate?: string;
  formData: Record<string, unknown>;
  decisionComment?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface WorkflowInstanceDetail {
  instance: WorkflowInstance;
  steps: WorkflowStepRun[];
  tasks: WorkflowTask[];
}
