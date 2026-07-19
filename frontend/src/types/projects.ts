export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectRecordType = 'milestone' | 'task' | 'budget' | 'member' | 'requirement' | 'audit' | 'meeting' | 'email' | 'customer' | 'vendor';

export interface ProjectLink {
  label: string;
  url: string;
}

export interface ProjectPayload {
  code: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  managerId?: string;
  managerName?: string;
  startDate?: string;
  endDate?: string;
  budgetTotal?: number;
  relatedLinks?: ProjectLink[];
}

export interface Project extends ProjectPayload {
  id: string;
  collaborationWorkspaceId?: string;
  collaborationChannelId?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  canEdit: boolean;
}

export interface ProjectRecordPayload {
  title: string;
  description?: string;
  status: string;
  priority: ProjectPriority;
  assigneeId?: string;
  assigneeName?: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
  progress?: number;
  metadata?: Record<string, unknown>;
}

export interface ProjectRecord extends ProjectRecordPayload {
  id: string;
  projectId: string;
  recordType: ProjectRecordType;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  canEdit: boolean;
}

export interface ProjectUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface ProjectStats {
  taskCount?: number;
  taskDone?: number;
  progress?: number;
  milestoneCount?: number;
  milestoneCompleted?: number;
  memberCount?: number;
  openRequirements?: number;
  pendingAudits?: number;
  budgetCommitted?: number;
  budgetSpent?: number;
}

export interface ProjectOverview {
  currentUser: ProjectUser;
  projects: Project[];
  selectedProject?: Project;
  records: ProjectRecord[];
  stats: ProjectStats;
  users: ProjectUser[];
}

export interface PersonalProjectOverview {
  projects: Project[];
  tasks: ProjectRecord[];
  milestones: ProjectRecord[];
  audits: ProjectRecord[];
}
