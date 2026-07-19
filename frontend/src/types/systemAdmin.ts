export type AdminFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'url'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'tags';

export interface AdminFieldOption {
  label: string;
  value: string;
}

export interface AdminFieldDefinition {
  path: string;
  label: string;
  type?: AdminFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: AdminFieldOption[];
  createOnly?: boolean;
  grid?: boolean;
}

export interface AdminEntityDefinition {
  entity: string;
  title: string;
  description: string;
  itemName: string;
  fields: AdminFieldDefinition[];
}

export interface AdminRecord {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  data: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminRecordPayload {
  key: string;
  name: string;
  description?: string;
  data: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
}

export interface AdminRecordPage {
  records: AdminRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SystemUserContext {
  id: string;
  username: string;
  company: string;
  departmentKey?: string;
  departmentName: string;
  displayName: string;
  jobTitle: string;
  roleKey: string;
  roleName: string;
  permissionLabel: string;
  permissions: string[];
  canAdmin: boolean;
}

export interface SystemMenuPolicy {
  key: string;
  name: string;
  path: string;
  enabled: boolean;
  sortOrder: number;
}

export interface SystemContext {
  currentUser: SystemUserContext;
  menus: SystemMenuPolicy[];
  about: {
    companyName?: string;
    productName?: string;
    version?: string;
    website?: string;
    copyright?: string;
  };
}
