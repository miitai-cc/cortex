import type { AdminEntityDefinition, AdminFieldDefinition } from '../types/systemAdmin';

const base: AdminFieldDefinition[] = [
  { path: 'key', label: '識別碼', required: true, grid: true, help: '不可重複的穩定代碼' },
  { path: 'name', label: '名稱', required: true, grid: true },
  { path: 'description', label: '說明', type: 'textarea' },
  { path: 'isActive', label: '啟用', type: 'checkbox', grid: true },
  { path: 'sortOrder', label: '排序', type: 'number', grid: true },
];

const definition = (
  entity: string,
  title: string,
  description: string,
  itemName: string,
  fields: AdminFieldDefinition[],
): AdminEntityDefinition => ({ entity, title, description, itemName, fields });

export const systemAdminEntities: Record<string, AdminEntityDefinition> = {
  users: definition('users', '使用者管理', '維護登入帳號、個人資料、部門、職稱、角色與權限摘要。', '使用者', [
    { path: 'key', label: '登入帳號', required: true, grid: true },
    { path: 'name', label: '姓名', required: true, grid: true },
    { path: 'data.email', label: 'Email', type: 'email', required: true, grid: true },
    { path: 'data.password', label: '密碼', type: 'password', createOnly: true, help: '新增時至少 8 字；編輯時留空表示不變更' },
    { path: 'data.company', label: '公司', required: true, grid: true },
    { path: 'data.departmentKey', label: '部門代碼', placeholder: '例如 mis', grid: true },
    { path: 'data.jobTitle', label: '職稱', grid: true },
    { path: 'data.role', label: '角色', type: 'select', required: true, grid: true, options: [
      { value: 'admin', label: '系統管理員' }, { value: 'user', label: '一般使用者' },
    ] },
    { path: 'data.permissionSummary', label: '權限顯示名稱', placeholder: '留空時顯示角色名稱' },
    { path: 'isActive', label: '啟用', type: 'checkbox', grid: true },
  ]),
  departments: definition('departments', '部門管理', '維護組織部門、主管與成本中心。', '部門', [
    ...base,
    { path: 'data.manager', label: '部門主管', grid: true },
    { path: 'data.costCenter', label: '成本中心', grid: true },
  ]),
  roles: definition('roles', '角色管理', '建立角色並配置其權限代碼。', '角色', [
    ...base,
    { path: 'data.permissionCodes', label: '權限代碼', type: 'tags', required: true, grid: true, help: '以逗號分隔；* 表示完整權限' },
  ]),
  permissions: definition('permissions', '權限管理', '維護資源與操作層級的權限字典。', '權限', [
    ...base,
    { path: 'data.resource', label: '資源', required: true, grid: true },
    { path: 'data.actions', label: '允許操作', type: 'tags', placeholder: 'read,create,update,delete', grid: true },
  ]),
  menus: definition('menus', '選單管理', '維護主選單顯示、路徑及排序；停用後導覽列會隱藏。', '選單', [
    ...base,
    { path: 'data.path', label: 'Hash Route 路徑', required: true, placeholder: '/cortex/documents', grid: true },
    { path: 'data.icon', label: 'Icon 名稱' },
  ]),
  'ai-models': definition('ai-models', 'AI Model 管理', '維護可選模型、用途、提供者與服務端點。', 'AI Model', [
    ...base,
    { path: 'data.provider', label: 'Provider', required: true, grid: true },
    { path: 'data.model', label: '模型名稱', required: true, grid: true },
    { path: 'data.purpose', label: '用途', type: 'select', grid: true, options: ['chat', 'embedding', 'reranking', 'pageindex', 'vision'].map((value) => ({ value, label: value })) },
    { path: 'data.endpoint', label: 'Endpoint', type: 'url' },
  ]),
  contexts: definition('contexts', '上下文管理', '維護 Prompt 上下文模板、範圍與 Token 限制。', '上下文', [
    ...base,
    { path: 'data.scope', label: '適用範圍', grid: true },
    { path: 'data.maxTokens', label: '最大 Token', type: 'number', grid: true },
    { path: 'data.template', label: '上下文模板', type: 'textarea', required: true },
  ]),
  channels: definition('channels', 'Channel 管理', '維護通訊 Channel 類型、可見性與資料保留政策。', 'Channel', [
    ...base,
    { path: 'data.channelType', label: 'Channel 類型', type: 'select', grid: true, options: ['team', 'project', 'notification', 'integration'].map((value) => ({ value, label: value })) },
    { path: 'data.visibility', label: '可見性', type: 'select', grid: true, options: [{ value: 'public', label: '公開' }, { value: 'private', label: '私人' }] },
    { path: 'data.retentionDays', label: '保留天數', type: 'number' },
  ]),
  schedules: definition('schedules', '排程管理', '維護排程表達式、時區及工作處理器。', '排程', [
    ...base,
    { path: 'data.cron', label: 'Cron', required: true, grid: true },
    { path: 'data.timezone', label: '時區', placeholder: 'Asia/Taipei', grid: true },
    { path: 'data.handler', label: '執行工作', required: true, grid: true },
  ]),
  'ai-providers': definition('ai-providers', 'AI Providers 管理', '維護 AI 服務供應商、Base URL 與秘密參照；不儲存明文密鑰。', 'AI Provider', [
    ...base,
    { path: 'data.provider', label: 'Provider 類型', required: true, grid: true },
    { path: 'data.baseUrl', label: 'Base URL', type: 'url', required: true, grid: true },
    { path: 'data.credentialRef', label: 'Credential Secret 參照', required: true },
  ]),
  'auto-approve': definition('auto-approve', 'Auto-Approve', '維護自動核准規則、條件與金額上限。', '自動核准規則', [
    ...base,
    { path: 'data.scope', label: '適用範圍', required: true, grid: true },
    { path: 'data.condition', label: '判斷條件', required: true, grid: true },
    { path: 'data.maxAmount', label: '金額上限', type: 'number' },
  ]),
  'auto-complete': definition('auto-complete', 'Auto complete', '維護輸入自動完成資料源、觸發條件與模板。', '自動完成規則', [
    ...base,
    { path: 'data.scope', label: '適用範圍', required: true, grid: true },
    { path: 'data.trigger', label: '觸發字元／條件', grid: true },
    { path: 'data.template', label: '完成模板', type: 'textarea', required: true },
  ]),
  notifications: definition('notifications', 'Notification', '維護通知事件、傳遞管道、收件者與訊息模板。', '通知規則', [
    ...base,
    { path: 'data.event', label: '觸發事件', required: true, grid: true },
    { path: 'data.channel', label: '通知管道', type: 'select', grid: true, options: ['in-app', 'email', 'webhook'].map((value) => ({ value, label: value })) },
    { path: 'data.recipients', label: '收件者', type: 'tags' },
    { path: 'data.template', label: '通知模板', type: 'textarea', required: true },
  ]),
  'commit-messages': definition('commit-messages', 'Commit Message', '維護 Commit Message 規範與產生模板。', 'Commit Message 規則', [
    ...base,
    { path: 'data.pattern', label: '格式／Regex', required: true, grid: true },
    { path: 'data.language', label: '預設語言', grid: true },
    { path: 'data.includeIssue', label: '必須包含 Issue', type: 'checkbox' },
  ]),
  sandboxes: definition('sandboxes', 'Sandbox', '維護執行環境、網路政策及資源限制。', 'Sandbox', [
    ...base,
    { path: 'data.runtime', label: 'Runtime', required: true, grid: true },
    { path: 'data.networkPolicy', label: '網路政策', type: 'select', grid: true, options: [{ value: 'disabled', label: '禁止' }, { value: 'restricted', label: '限制' }, { value: 'enabled', label: '允許' }] },
    { path: 'data.cpuLimit', label: 'CPU 限制', type: 'number' },
    { path: 'data.memoryMb', label: '記憶體 MB', type: 'number' },
  ]),
  languages: definition('languages', '語言管理', '維護可使用的語言、Locale 與預設備援語言。', '語言', [
    ...base,
    { path: 'data.locale', label: 'Locale', required: true, grid: true },
    { path: 'data.fallback', label: '備援語言', type: 'checkbox' },
  ]),
  'enterprise-systems': definition('enterprise-systems', '企業資訊系統', '維護可使用的企業資訊系統、分類與區域。', '企業資訊系統', [
    ...base,
    { path: 'data.url', label: '系統網址', type: 'url', required: true, grid: true },
    { path: 'data.category', label: '分類', required: true, grid: true },
    { path: 'data.area', label: '區域', required: true, grid: true },
  ]),
  about: definition('about', '關於', '維護公司、產品、版本、網站及版權資訊。', '關於資訊', [
    ...base,
    { path: 'data.companyName', label: '公司名稱', required: true, grid: true },
    { path: 'data.productName', label: '產品名稱', required: true, grid: true },
    { path: 'data.version', label: '顯示版本', grid: true },
    { path: 'data.website', label: '官方網站', type: 'url' },
    { path: 'data.copyright', label: '版權文字' },
  ]),
};
