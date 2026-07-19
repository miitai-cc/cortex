import type { Context, ComponentType } from 'react';

export interface WorkflowUser {
  id: string;
  username: string;
}

export interface WorkflowEditorProps {
  apiBase?: string;
  authToken?: string;
  initialWorkflowId?: string;
  testPayload?: Record<string, unknown>;
  availableUsers?: WorkflowUser[];
  onNotify?: (message: string, type?: 'info' | 'success' | 'error') => void;
  onWorkflowChanged?: (result: unknown) => void;
  onRunResult?: (result: unknown) => void;
}

export interface WorkflowI18nValue {
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const WorkflowI18nContext: Context<WorkflowI18nValue>;
export const WorkflowEditor: ComponentType<WorkflowEditorProps>;
export default WorkflowEditor;
