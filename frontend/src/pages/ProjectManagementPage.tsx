import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  Flag,
  FolderKanban,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import { projectApi } from '../services/api';
import type {
  Project,
  ProjectLink,
  ProjectPayload,
  ProjectPriority,
  ProjectRecord,
  ProjectRecordPayload,
  ProjectRecordType,
  ProjectStatus,
  ProjectUser,
} from '../types/projects';

type Section = 'information' | 'gantt' | 'milestones' | 'kanban' | 'budget' | 'people' | 'requirements' | 'audits';

const sectionConfigs: Record<Section, {
  title: string;
  description: string;
  icon: typeof FolderKanban;
  recordType?: ProjectRecordType;
}> = {
  information: { title: '專案相關資訊', description: '維護專案主檔、日期、負責人、預算、相關連結與協作入口', icon: FolderKanban },
  gantt: { title: 'Gantt Chart', description: '以時間軸檢視任務與里程碑的計畫期間、進度及相依資訊', icon: BarChart3 },
  milestones: { title: 'Milestone 管理', description: '管理專案的重要交付節點、負責人、期限與完成狀態', icon: Flag, recordType: 'milestone' },
  kanban: { title: 'Kanban 工作管理', description: '用看板拖放管理待辦、進行、審核與完成工作', icon: FolderKanban, recordType: 'task' },
  budget: { title: '專案預算', description: '管理規劃、核准、承諾與實際支出，並追蹤預算使用率', icon: CircleDollarSign, recordType: 'budget' },
  people: { title: '專案人員', description: '維護專案角色、投入比例與聯絡資訊，成員會同步加入協作頻道', icon: Users, recordType: 'member' },
  requirements: { title: '需求管理', description: '保留需求來源、驗收條件、優先順序、負責人與驗證結果', icon: ClipboardList, recordType: 'requirement' },
  audits: { title: '成果稽核記錄', description: '記錄成果查核、證據、缺失、結論與後續追蹤', icon: ClipboardCheck, recordType: 'audit' },
};

const projectStatuses: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: '規劃中' },
  { value: 'active', label: '進行中' },
  { value: 'on_hold', label: '暫停' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已封存' },
];

const priorities: { value: ProjectPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '緊急' },
];

const recordStatuses: Record<ProjectRecordType, { value: string; label: string }[]> = {
  task: [
    { value: 'backlog', label: '需求池' }, { value: 'todo', label: '待處理' },
    { value: 'in_progress', label: '進行中' }, { value: 'review', label: '待審核' }, { value: 'done', label: '完成' },
  ],
  milestone: [
    { value: 'planned', label: '已規劃' }, { value: 'in_progress', label: '進行中' },
    { value: 'completed', label: '已完成' }, { value: 'delayed', label: '延遲' },
  ],
  budget: [
    { value: 'planned', label: '規劃' }, { value: 'approved', label: '核准' },
    { value: 'committed', label: '已承諾' }, { value: 'spent', label: '已支出' },
  ],
  member: [
    { value: 'active', label: '參與中' }, { value: 'pending', label: '待加入' }, { value: 'inactive', label: '已退出' },
  ],
  requirement: [
    { value: 'draft', label: '草稿' }, { value: 'approved', label: '已核准' },
    { value: 'in_progress', label: '實作中' }, { value: 'verified', label: '已驗證' }, { value: 'rejected', label: '不採用' },
  ],
  audit: [
    { value: 'planned', label: '待稽核' }, { value: 'in_review', label: '稽核中' },
    { value: 'passed', label: '通過' }, { value: 'failed', label: '未通過' }, { value: 'follow_up', label: '追蹤改善' },
  ],
};

const defaultProject = (): ProjectPayload => ({
  code: '', name: '', description: '', status: 'planning', priority: 'medium',
  managerId: '', managerName: '', startDate: '', endDate: '', budgetTotal: 0, relatedLinks: [],
});

const defaultRecord = (type: ProjectRecordType): ProjectRecordPayload => ({
  title: '', description: '', status: recordStatuses[type][0].value, priority: 'medium',
  assigneeId: '', assigneeName: '', startDate: '', endDate: '', amount: undefined,
  progress: 0, metadata: {},
});

function errorMessage(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
  return candidate.response?.data?.error ?? candidate.response?.data?.message ?? candidate.message ?? fallback;
}

function money(value?: number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value ?? 0);
}

function dateLabel(value?: string) {
  if (!value) return '未設定';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('zh-TW');
}

function statusLabel(type: ProjectRecordType, value: string) {
  return recordStatuses[type].find((status) => status.value === value)?.label ?? value;
}

function projectStatusLabel(value: ProjectStatus) {
  return projectStatuses.find((status) => status.value === value)?.label ?? value;
}

function cleanRecord(record: ProjectRecord): ProjectRecordPayload {
  return {
    title: record.title, description: record.description, status: record.status, priority: record.priority,
    assigneeId: record.assigneeId, assigneeName: record.assigneeName, startDate: record.startDate,
    endDate: record.endDate, amount: record.amount, progress: record.progress, metadata: record.metadata,
  };
}

function ProjectDialog({
  open,
  initial,
  users,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Project;
  users: ProjectUser[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: ProjectPayload) => void;
}) {
  const [form, setForm] = useState<ProjectPayload>(defaultProject());
  const [linksText, setLinksText] = useState('');
  useEffect(() => {
    const value = initial ? {
      code: initial.code, name: initial.name, description: initial.description ?? '', status: initial.status,
      priority: initial.priority, managerId: initial.managerId ?? '', managerName: initial.managerName ?? '',
      startDate: initial.startDate ?? '', endDate: initial.endDate ?? '', budgetTotal: initial.budgetTotal ?? 0,
      relatedLinks: initial.relatedLinks ?? [],
    } : defaultProject();
    setForm(value);
    setLinksText((value.relatedLinks ?? []).map((link) => `${link.label}|${link.url}`).join('\n'));
  }, [initial, open]);
  if (!open) return null;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const relatedLinks = linksText.split('\n').map((line) => line.trim()).filter(Boolean).map((line): ProjectLink => {
      const [label, ...parts] = line.split('|');
      const url = parts.join('|').trim() || label.trim();
      return { label: parts.length ? label.trim() : url, url };
    });
    onSave({ ...form, relatedLinks });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <form className="card max-h-[92vh] w-full max-w-3xl overflow-y-auto" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div><h2 className="text-xl font-bold">{initial ? '編輯專案' : '建立專案'}</h2><p className="text-xs text-gray-500">儲存後會自動建立專案協作頻道</p></div>
          <button type="button" className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">專案代碼<input required maxLength={40} className="input-field mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="例如 CORTEX-2026" /></label>
          <label className="text-sm">專案名稱<input required className="input-field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="text-sm">狀態<select className="input-field mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>{projectStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-sm">優先順序<select className="input-field mt-1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as ProjectPriority })}>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-sm">專案經理<select className="input-field mt-1" value={form.managerId} onChange={(e) => { const user = users.find((item) => item.id === e.target.value); setForm({ ...form, managerId: e.target.value, managerName: user?.username ?? '' }); }}><option value="">目前登入者</option>{users.map((user) => <option key={user.id} value={user.id}>{user.username} ({user.role})</option>)}</select></label>
          <label className="text-sm">核定總預算<input min={0} type="number" className="input-field mt-1" value={form.budgetTotal ?? 0} onChange={(e) => setForm({ ...form, budgetTotal: Number(e.target.value) })} /></label>
          <label className="text-sm">開始日期<input type="date" className="input-field mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label className="text-sm">結束日期<input type="date" className="input-field mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
          <label className="text-sm md:col-span-2">專案說明<textarea rows={4} className="input-field mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="text-sm md:col-span-2">相關連結（每行：名稱|URL）<textarea rows={3} className="input-field mt-1 font-mono text-xs" value={linksText} onChange={(e) => setLinksText(e.target.value)} placeholder="需求文件|https://example.com/spec" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>取消</button><button disabled={saving} className="btn-primary">{saving ? '儲存中…' : '儲存專案'}</button></div>
      </form>
    </div>
  );
}

function RecordDialog({
  type,
  open,
  initial,
  users,
  saving,
  onClose,
  onSave,
}: {
  type: ProjectRecordType;
  open: boolean;
  initial?: ProjectRecord;
  users: ProjectUser[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: ProjectRecordPayload) => void;
}) {
  const [form, setForm] = useState<ProjectRecordPayload>(defaultRecord(type));
  useEffect(() => setForm(initial ? cleanRecord(initial) : defaultRecord(type)), [initial, open, type]);
  if (!open) return null;
  const metadata = form.metadata ?? {};
  const setMetadata = (key: string, value: string | number) => setForm({ ...form, metadata: { ...metadata, [key]: value } });
  const setUser = (id: string) => {
    const user = users.find((item) => item.id === id);
    setForm({ ...form, assigneeId: id, assigneeName: user?.username ?? '' });
  };
  const specialFields = (() => {
    if (type === 'member') return <>
      <label className="text-sm">專案角色<input className="input-field mt-1" value={String(metadata.role ?? '')} onChange={(e) => setMetadata('role', e.target.value)} placeholder="例如 PM、開發、稽核" /></label>
      <label className="text-sm">投入比例 (%)<input min={0} max={100} type="number" className="input-field mt-1" value={Number(metadata.allocation ?? 100)} onChange={(e) => setMetadata('allocation', Number(e.target.value))} /></label>
    </>;
    if (type === 'budget') return <>
      <label className="text-sm">預算科目<input className="input-field mt-1" value={String(metadata.category ?? '')} onChange={(e) => setMetadata('category', e.target.value)} /></label>
      <label className="text-sm">供應商／請款單位<input className="input-field mt-1" value={String(metadata.vendor ?? '')} onChange={(e) => setMetadata('vendor', e.target.value)} /></label>
    </>;
    if (type === 'requirement') return <>
      <label className="text-sm">需求來源<input className="input-field mt-1" value={String(metadata.source ?? '')} onChange={(e) => setMetadata('source', e.target.value)} /></label>
      <label className="text-sm">驗收條件<input className="input-field mt-1" value={String(metadata.acceptanceCriteria ?? '')} onChange={(e) => setMetadata('acceptanceCriteria', e.target.value)} /></label>
    </>;
    if (type === 'audit') return <>
      <label className="text-sm">稽核證據<input className="input-field mt-1" value={String(metadata.evidence ?? '')} onChange={(e) => setMetadata('evidence', e.target.value)} /></label>
      <label className="text-sm">結論／缺失<input className="input-field mt-1" value={String(metadata.finding ?? '')} onChange={(e) => setMetadata('finding', e.target.value)} /></label>
    </>;
    if (type === 'milestone') return <label className="text-sm md:col-span-2">交付成果<input className="input-field mt-1" value={String(metadata.deliverable ?? '')} onChange={(e) => setMetadata('deliverable', e.target.value)} /></label>;
    return <label className="text-sm md:col-span-2">相依工作／補充資訊<input className="input-field mt-1" value={String(metadata.dependency ?? '')} onChange={(e) => setMetadata('dependency', e.target.value)} /></label>;
  })();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <form className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto" onSubmit={(e) => { e.preventDefault(); onSave(form); }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{initial ? '編輯' : '新增'}{sectionConfigs[Object.keys(sectionConfigs).find((key) => sectionConfigs[key as Section].recordType === type) as Section]?.title ?? '工作項目'}</h2><button type="button" className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">標題<input required className="input-field mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="text-sm">狀態<select className="input-field mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{recordStatuses[type].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-sm">優先順序<select className="input-field mt-1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as ProjectPriority })}>{priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-sm">{type === 'member' ? '選擇成員' : '負責人'}<select className="input-field mt-1" value={form.assigneeId} onChange={(e) => setUser(e.target.value)}><option value="">未指派</option>{users.map((user) => <option key={user.id} value={user.id}>{user.username} ({user.role})</option>)}</select></label>
          {(type === 'budget') && <label className="text-sm">金額<input min={0} type="number" className="input-field mt-1" value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: e.target.value ? Number(e.target.value) : undefined })} /></label>}
          {type !== 'member' && <><label className="text-sm">開始日期<input type="date" className="input-field mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label><label className="text-sm">完成／到期日<input type="date" className="input-field mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label></>}
          {!['member', 'budget'].includes(type) && <label className="text-sm md:col-span-2">完成進度：{form.progress ?? 0}%<input type="range" min={0} max={100} className="mt-2 w-full" value={form.progress ?? 0} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} /></label>}
          {specialFields}
          <label className="text-sm md:col-span-2">說明<textarea rows={3} className="input-field mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>取消</button><button disabled={saving} className="btn-primary">{saving ? '儲存中…' : '儲存'}</button></div>
      </form>
    </div>
  );
}

function GanttView({ records, onEdit }: { records: ProjectRecord[]; onEdit: (record: ProjectRecord) => void }) {
  const timed = records.filter((record) => ['task', 'milestone'].includes(record.recordType) && record.startDate && record.endDate);
  if (!timed.length) return <div className="card py-14 text-center text-gray-500">尚無同時設定開始與結束日期的任務或里程碑。</div>;
  const timestamps = timed.flatMap((record) => [new Date(`${record.startDate}T00:00:00`).getTime(), new Date(`${record.endDate}T00:00:00`).getTime()]);
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const span = Math.max(86_400_000, max - min + 86_400_000);
  return (
    <div className="card overflow-x-auto">
      <div className="mb-5 flex min-w-[760px] items-center justify-between text-xs text-gray-500"><span>{new Date(min).toLocaleDateString('zh-TW')}</span><span>專案時間軸</span><span>{new Date(max).toLocaleDateString('zh-TW')}</span></div>
      <div className="min-w-[760px] space-y-3">
        {timed.map((record) => {
          const start = new Date(`${record.startDate}T00:00:00`).getTime();
          const end = new Date(`${record.endDate}T00:00:00`).getTime();
          const left = ((start - min) / span) * 100;
          const width = Math.max(2, ((end - start + 86_400_000) / span) * 100);
          return <div key={record.id} className="grid grid-cols-[190px_1fr] items-center gap-3">
            <button className="truncate text-left text-sm font-medium hover:text-primary-600" onClick={() => onEdit(record)}>{record.recordType === 'milestone' ? '◆ ' : ''}{record.title}</button>
            <div className="relative h-8 rounded bg-gray-100 dark:bg-gray-700"><button title={`${record.progress}% · ${statusLabel(record.recordType, record.status)}`} onClick={() => onEdit(record)} className={`absolute top-1 h-6 overflow-hidden rounded text-left text-[10px] text-white ${record.recordType === 'milestone' ? 'bg-violet-500' : 'bg-primary-600'}`} style={{ left: `${left}%`, width: `${width}%` }}><span className="relative z-10 px-2">{record.progress}%</span><span className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${record.progress}%` }} /></button></div>
          </div>;
        })}
      </div>
    </div>
  );
}

function KanbanView({ records, onEdit, onDelete, onMove }: { records: ProjectRecord[]; onEdit: (record: ProjectRecord) => void; onDelete: (record: ProjectRecord) => void; onMove: (record: ProjectRecord, status: string) => void }) {
  const [dragId, setDragId] = useState('');
  return <div className="grid min-w-[980px] grid-cols-5 gap-3 overflow-x-auto pb-2">{recordStatuses.task.map((column) => {
    const items = records.filter((record) => record.recordType === 'task' && record.status === column.value);
    return <section key={column.value} className="min-h-80 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50" onDragOver={(e) => e.preventDefault()} onDrop={() => { const record = records.find((item) => item.id === dragId); if (record && record.status !== column.value) onMove(record, column.value); setDragId(''); }}>
      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{column.label}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs dark:bg-gray-700">{items.length}</span></div>
      <div className="space-y-2">{items.map((record) => <article key={record.id} draggable onDragStart={() => setDragId(record.id)} className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <button className="w-full text-left" onClick={() => onEdit(record)}><p className="font-medium">{record.title}</p><p className="mt-1 text-xs text-gray-500">{record.assigneeName || '未指派'} · {record.progress}%</p><div className="mt-2 h-1.5 rounded bg-gray-100 dark:bg-gray-700"><span className="block h-full rounded bg-primary-500" style={{ width: `${record.progress}%` }} /></div></button>
        {record.canEdit && <button className="mt-2 text-xs text-red-500" onClick={() => onDelete(record)}>刪除</button>}
      </article>)}</div>
    </section>;
  })}</div>;
}

function RecordsView({ type, records, onEdit, onDelete }: { type: ProjectRecordType; records: ProjectRecord[]; onEdit: (record: ProjectRecord) => void; onDelete: (record: ProjectRecord) => void }) {
  const items = records.filter((record) => record.recordType === type);
  if (!items.length) return <div className="card py-14 text-center text-gray-500">尚無資料，請按「新增」建立第一筆記錄。</div>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((record) => <article className="card" key={record.id}>
    <div className="flex items-start justify-between gap-2"><div><span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{statusLabel(type, record.status)}</span><h3 className="mt-3 font-semibold">{record.title}</h3></div>{record.canEdit && <div className="flex"><button className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => onEdit(record)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1.5 text-red-500 hover:bg-red-50" onClick={() => onDelete(record)}><Trash2 className="h-4 w-4" /></button></div>}</div>
    <p className="mt-2 line-clamp-3 min-h-10 text-sm text-gray-500">{record.description || '未填寫說明'}</p>
    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-gray-400">負責人</dt><dd>{record.assigneeName || '未指派'}</dd></div><div><dt className="text-gray-400">期限</dt><dd>{dateLabel(record.endDate)}</dd></div>{type === 'budget' ? <div className="col-span-2"><dt className="text-gray-400">金額</dt><dd className="text-lg font-bold text-emerald-600">{money(record.amount)}</dd></div> : <div className="col-span-2"><dt className="text-gray-400">進度</dt><dd><div className="mt-1 h-2 rounded bg-gray-100 dark:bg-gray-700"><span className="block h-full rounded bg-primary-500" style={{ width: `${record.progress}%` }} /></div></dd></div>}</dl>
    {Object.entries(record.metadata ?? {}).filter(([, value]) => value !== '').slice(0, 3).map(([key, value]) => <p key={key} className="mt-2 truncate text-xs text-gray-500"><span className="text-gray-400">{key}：</span>{String(value)}</p>)}
  </article>)}</div>;
}

export default function ProjectManagementPage() {
  const { section = 'information' } = useParams();
  const validSection = section in sectionConfigs;
  const activeSection = (validSection ? section : 'information') as Section;
  const config = sectionConfigs[activeSection];
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('project') ?? undefined;
  const client = useQueryClient();
  const [projectOpen, setProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordType, setRecordType] = useState<ProjectRecordType>(config.recordType ?? 'task');
  const [editingRecord, setEditingRecord] = useState<ProjectRecord | undefined>();

  const overview = useQuery({ queryKey: ['project-overview', selectedId], queryFn: () => projectApi.overview(selectedId) });
  const model = overview.data?.data;
  const project = model?.selectedProject;
  useEffect(() => {
    if (!selectedId && model?.selectedProject?.id) setSearchParams({ project: model.selectedProject.id }, { replace: true });
  }, [model?.selectedProject?.id, selectedId, setSearchParams]);
  useEffect(() => {
    if (!project) return;
    const selection = { id: project.id, name: `[${project.code}] ${project.name}` };
    localStorage.setItem('cortex-selected-project', JSON.stringify(selection));
    window.dispatchEvent(new CustomEvent('cortex-project-changed', { detail: selection }));
  }, [project?.code, project?.id, project?.name]);
  useEffect(() => setRecordType(config.recordType ?? 'task'), [config.recordType]);

  const refresh = () => {
    client.invalidateQueries({ queryKey: ['project-overview'] });
    client.invalidateQueries({ queryKey: ['personal-projects'] });
    client.invalidateQueries({ queryKey: ['collaboration-overview'] });
  };
  const saveProject = useMutation({
    mutationFn: (payload: ProjectPayload) => editingProject ? projectApi.updateProject(editingProject.id, payload) : projectApi.createProject(payload),
    onSuccess: (response) => { toast.success(editingProject ? '專案已更新' : '專案與協作頻道已建立'); setProjectOpen(false); setEditingProject(undefined); const id = response.data.id; if (id) setSearchParams({ project: id }); refresh(); },
    onError: (error) => toast.error(errorMessage(error, '專案儲存失敗')),
  });
  const deleteProject = useMutation({
    mutationFn: (id: string) => projectApi.deleteProject(id),
    onSuccess: () => {
      toast.success('專案已刪除，協作頻道歷程已保留');
      localStorage.removeItem('cortex-selected-project');
      window.dispatchEvent(new CustomEvent('cortex-project-changed', { detail: { name: '未選專案' } }));
      setSearchParams({});
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, '專案刪除失敗')),
  });
  const saveRecord = useMutation({
    mutationFn: (payload: ProjectRecordPayload) => {
      if (!project) throw new Error('請先建立專案');
      return editingRecord ? projectApi.updateRecord(project.id, recordType, editingRecord.id, payload) : projectApi.createRecord(project.id, recordType, payload);
    },
    onSuccess: () => { toast.success(editingRecord ? '資料已更新並同步至協作頻道' : '資料已新增並同步至協作頻道'); setRecordOpen(false); setEditingRecord(undefined); refresh(); },
    onError: (error) => toast.error(errorMessage(error, '資料儲存失敗')),
  });
  const deleteRecord = useMutation({
    mutationFn: (record: ProjectRecord) => projectApi.deleteRecord(record.projectId, record.recordType, record.id),
    onSuccess: () => { toast.success('資料已刪除'); refresh(); },
    onError: (error) => toast.error(errorMessage(error, '資料刪除失敗')),
  });
  const moveRecord = useMutation({
    mutationFn: ({ record, status }: { record: ProjectRecord; status: string }) => projectApi.updateRecord(record.projectId, record.recordType, record.id, { ...cleanRecord(record), status }),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error, '看板狀態更新失敗')),
  });

  if (!validSection) return <Navigate to="/cortex/projects/information" replace />;
  const openRecord = (type: ProjectRecordType, record?: ProjectRecord) => { setRecordType(type); setEditingRecord(record); setRecordOpen(true); };
  const removeRecord = (record: ProjectRecord) => { if (window.confirm(`確定刪除「${record.title}」？`)) deleteRecord.mutate(record); };
  const records = model?.records ?? [];
  const stats = model?.stats ?? {};
  const budgetRate = project?.budgetTotal ? Math.min(100, Math.round(((stats.budgetSpent ?? 0) / project.budgetTotal) * 100)) : 0;

  const content = (() => {
    if (!project) return <div className="card py-16 text-center"><FolderKanban className="mx-auto h-12 w-12 text-gray-300" /><h2 className="mt-4 text-lg font-semibold">尚未建立專案</h2><p className="mt-1 text-sm text-gray-500">建立第一個專案後即可使用時程、看板、預算、人員、需求與稽核功能。</p><button className="btn-primary mt-5" onClick={() => { setEditingProject(undefined); setProjectOpen(true); }}><Plus className="mr-2 inline h-4 w-4" />建立專案</button></div>;
    if (activeSection === 'information') return <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      <section className="card"><div className="flex items-start justify-between"><div><span className="text-xs font-bold text-primary-600">{project.code}</span><h2 className="mt-1 text-2xl font-bold">{project.name}</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{projectStatusLabel(project.status)}</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{project.description || '尚未填寫專案說明。'}</p><dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-gray-400">專案經理</dt><dd className="font-medium">{project.managerName}</dd></div><div><dt className="text-xs text-gray-400">計畫期間</dt><dd>{dateLabel(project.startDate)} ～ {dateLabel(project.endDate)}</dd></div><div><dt className="text-xs text-gray-400">核定預算</dt><dd className="font-medium">{money(project.budgetTotal)}</dd></div><div><dt className="text-xs text-gray-400">優先順序</dt><dd>{priorities.find((item) => item.value === project.priority)?.label}</dd></div></dl></section>
      <div className="space-y-5"><section className="card"><h3 className="flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4" />相關連結</h3><div className="mt-3 space-y-2">{(project.relatedLinks ?? []).map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm hover:border-primary-400 dark:border-gray-700"><span>{link.label}</span><ExternalLink className="h-4 w-4" /></a>)}{!project.relatedLinks?.length && <p className="text-sm text-gray-500">尚未設定相關連結</p>}</div></section><section className="card"><h3 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />團隊協作</h3><p className="mt-2 text-sm text-gray-500">所有異動會自動寫入專案協作頻道。</p>{project.collaborationChannelId && <Link className="btn-primary mt-4 inline-flex items-center gap-2" to={`/cortex/collaboration/channels?channel=${encodeURIComponent(project.collaborationChannelId)}`}><MessageSquare className="h-4 w-4" />開啟專案頻道</Link>}</section></div>
    </div>;
    if (activeSection === 'gantt') return <GanttView records={records} onEdit={(record) => openRecord(record.recordType, record)} />;
    if (activeSection === 'kanban') return <KanbanView records={records} onEdit={(record) => openRecord('task', record)} onDelete={removeRecord} onMove={(record, status) => moveRecord.mutate({ record, status })} />;
    return <RecordsView type={config.recordType!} records={records} onEdit={(record) => openRecord(config.recordType!, record)} onDelete={removeRecord} />;
  })();

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-12">
      <CommonHeroTitle icon={config.icon} title={config.title} description={config.description} breadcrumb={['專案管理', project?.name ?? '尚未選擇']} extraButtons={[{ label: '重新整理', icon: RefreshCw, onClick: () => overview.refetch() }, { label: '新增專案', icon: Plus, onClick: () => { setEditingProject(undefined); setProjectOpen(true); } }]} />
      <section className="card mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-3 text-sm"><span className="shrink-0 text-gray-500">操作專案</span><select className="input-field" value={project?.id ?? ''} onChange={(e) => setSearchParams(e.target.value ? { project: e.target.value } : {})}><option value="">請選擇專案</option>{model?.projects.map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}</select></label>
        {project?.canEdit && <><button className="btn-secondary flex items-center justify-center gap-2" onClick={() => { setEditingProject(project); setProjectOpen(true); }}><Pencil className="h-4 w-4" />編輯專案</button><button className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => { if (window.confirm(`確定刪除「${project.name}」及其專案資料？協作頻道歷程將保留。`)) deleteProject.mutate(project.id); }}><Trash2 className="h-4 w-4" />刪除專案</button></>}
        {project && activeSection === 'gantt' && <><button className="btn-primary" onClick={() => openRecord('task')}><Plus className="mr-1 inline h-4 w-4" />新增任務</button><button className="btn-secondary" onClick={() => openRecord('milestone')}><Plus className="mr-1 inline h-4 w-4" />新增里程碑</button></>}
        {project && config.recordType && <button className="btn-primary flex items-center justify-center gap-2" onClick={() => openRecord(config.recordType!)}><Plus className="h-4 w-4" />新增</button>}
      </section>
      {overview.isLoading && <div className="card flex min-h-56 items-center justify-center text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />載入專案資料…</div>}
      {overview.isError && <div className="card flex min-h-56 flex-col items-center justify-center text-red-600"><AlertCircle className="mb-2 h-8 w-8" /><p>專案資料載入失敗</p><p className="mt-1 text-sm text-gray-500">{errorMessage(overview.error, '請確認後端服務已啟動並完成資料庫遷移。')}</p></div>}
      {project && !overview.isLoading && <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[{ label: '整體進度', value: `${stats.progress ?? 0}%`, icon: RefreshCw }, { label: '工作完成', value: `${stats.taskDone ?? 0}/${stats.taskCount ?? 0}`, icon: CheckCircle2 }, { label: '里程碑', value: `${stats.milestoneCompleted ?? 0}/${stats.milestoneCount ?? 0}`, icon: Flag }, { label: '專案人員', value: stats.memberCount ?? 0, icon: Users }, { label: '待驗需求', value: stats.openRequirements ?? 0, icon: ClipboardList }, { label: '待稽核', value: stats.pendingAudits ?? 0, icon: ClipboardCheck }].map(({ label, value, icon: Icon }) => <article className="card flex items-center gap-3" key={label}><Icon className="h-5 w-5 text-primary-600" /><div><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold">{value}</p></div></article>)}
      </section>}
      {project && activeSection === 'budget' && <section className="card mb-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-gray-500">已支出 / 核定預算</p><p className="text-2xl font-bold text-emerald-600">{money(stats.budgetSpent)} / {money(project.budgetTotal)}</p></div><div className="text-right"><p className="text-sm text-gray-500">承諾金額</p><p className="font-semibold">{money(stats.budgetCommitted)}</p></div></div><div className="mt-4 h-3 rounded-full bg-gray-100 dark:bg-gray-700"><span className={`block h-full rounded-full ${budgetRate > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${budgetRate}%` }} /></div><p className="mt-1 text-right text-xs text-gray-500">預算使用率 {budgetRate}%</p></section>}
      {!overview.isLoading && !overview.isError && content}
      <ProjectDialog open={projectOpen} initial={editingProject} users={model?.users ?? []} saving={saveProject.isPending} onClose={() => { setProjectOpen(false); setEditingProject(undefined); }} onSave={(payload) => saveProject.mutate(payload)} />
      <RecordDialog type={recordType} open={recordOpen} initial={editingRecord} users={model?.users ?? []} saving={saveRecord.isPending} onClose={() => { setRecordOpen(false); setEditingRecord(undefined); }} onSave={(payload) => saveRecord.mutate(payload)} />
    </div>
  );
}
