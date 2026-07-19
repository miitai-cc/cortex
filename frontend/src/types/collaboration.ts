export interface CollaborationUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface CollaborationWorkspace {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  channelCount: number;
  createdAt?: string;
}

export interface CollaborationChannel {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdBy: string;
  memberCount: number;
  unreadCount: number;
  createdAt?: string;
}

export interface CollaborationOverview {
  currentUser: CollaborationUser;
  workspaces: CollaborationWorkspace[];
  channels: CollaborationChannel[];
  users: CollaborationUser[];
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface CollaborationMessage {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  content: string;
  parentId?: string;
  issueId?: string;
  mentions: string[];
  reactions: MessageReaction[];
  threadCount: number;
  createdAt?: string;
  updatedAt?: string;
  edited: boolean;
}

export type IssueStatus = 'open' | 'in_progress' | 'review' | 'done' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
export type IssueType = 'task' | 'bug' | 'feature' | 'improvement';

export interface CollaborationIssue {
  id: string;
  key: string;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  reporterId: string;
  reporterName?: string;
  assigneeId?: string;
  assigneeName?: string;
  channelId?: string;
  channelName?: string;
  dueDate?: string;
  labels: string[];
  commentCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueComment {
  id: string;
  userId: string;
  username: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueHistoryEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt?: string;
}

export interface IssuePayload {
  title: string;
  description?: string;
  issueType?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string;
  channelId?: string;
  dueDate?: string;
  labels?: string[];
}
