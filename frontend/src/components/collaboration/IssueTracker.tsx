import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  History,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { collaborationApi } from '../../services/api';
import type {
  CollaborationIssue,
  CollaborationOverview,
  IssueComment,
  IssueHistoryEntry,
  IssuePayload,
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../../types/collaboration';
import Modal from './Modal';

const statuses: { id: IssueStatus; label: string; color: string }[] = [
  { id: 'open', label: '待處理', color: 'border-slate-300' },
  { id: 'in_progress', label: '進行中', color: 'border-blue-400' },
  { id: 'review', label: '待驗收', color: 'border-violet-400' },
  { id: 'done', label: '已完成', color: 'border-emerald-400' },
  { id: 'closed', label: '已關閉', color: 'border-gray-400' },
];

const statusLabels = Object.fromEntries(statuses.map((status) => [status.id, status.label]));
const priorityLabels: Record<IssuePriority, string> = { low: '低', medium: '中', high: '高', urgent: '緊急' };
const typeLabels: Record<IssueType, string> = { task: '工作', bug: '錯誤', feature: '功能', improvement: '改善' };
const typeIcons = { task: CheckCircle2, bug: Bug, feature: Sparkles, improvement: Wrench };

function errorText(error: any, fallback: string) {
  return error?.response?.data?.error || fallback;
}

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}

function issuePayload(issue: CollaborationIssue, patch: Partial<IssuePayload> = {}): IssuePayload {
  return {
    title: issue.title,
    description: issue.description ?? '',
    issueType: issue.type,
    status: issue.status,
    priority: issue.priority,
    assigneeId: issue.assigneeId,
    channelId: issue.channelId,
    dueDate: issue.dueDate,
    labels: issue.labels,
    ...patch,
  };
}

export default function IssueTracker({ overview, onlyMine }: { overview: CollaborationOverview; onlyMine: boolean }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [editor, setEditor] = useState<CollaborationIssue | 'new' | null>(null);
  const [detail, setDetail] = useState<CollaborationIssue | null>(null);
  const issuesQuery = useQuery({
    queryKey: ['collaboration-issues', onlyMine, search, statusFilter],
    queryFn: () => collaborationApi.issues({
      q: search || undefined,
      status: statusFilter || undefined,
      assignee_id: onlyMine ? overview.currentUser.id : undefined,
    }),
  });
  const allIssues = (issuesQuery.data?.data?.issues ?? []) as CollaborationIssue[];
  const issues = priorityFilter ? allIssues.filter((issue) => issue.priority === priorityFilter) : allIssues;
  useEffect(() => {
    const linkedIssue = searchParams.get('issue');
    if (linkedIssue) {
      const found = allIssues.find((issue) => issue.id === linkedIssue);
      if (found) setDetail(found);
    }
  }, [allIssues, searchParams]);

  const updateStatus = useMutation({
    mutationFn: ({ issue, status }: { issue: CollaborationIssue; status: IssueStatus }) =>
      collaborationApi.updateIssue(issue.id, issuePayload(issue, { status })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaboration-issues'] });
      toast.success('Issue 狀態已更新');
    },
    onError: (error) => toast.error(errorText(error, '狀態更新失敗')),
  });

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input-field w-full pl-9" placeholder="搜尋 Issue 編號或標題" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select className="input-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">全部狀態</option>{statuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select>
        <select className="input-field" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">全部優先級</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button onClick={() => setEditor('new')} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />新增 Issue</button>
      </div>
      {onlyMine && <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-700 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300">目前只顯示指派給 {overview.currentUser.username} 的工作</div>}
      {issuesQuery.isLoading ? <div className="card py-16 text-center text-gray-500">載入工作項目…</div> : (
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-5">
          {statuses.map((status) => {
            const items = issues.filter((issue) => issue.status === status.id);
            return <section key={status.id} className={`rounded-xl border-t-4 ${status.color} bg-gray-50 p-2 dark:bg-gray-800/60`}>
              <header className="mb-2 flex items-center gap-2 px-2 py-1"><span className="font-semibold text-gray-700 dark:text-gray-200">{status.label}</span><span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{items.length}</span></header>
              <div className="space-y-2">
                {items.map((issue) => <IssueCard key={issue.id} issue={issue} overview={overview} onOpen={() => setDetail(issue)} onStatus={(next) => updateStatus.mutate({ issue, status: next })} />)}
                {!items.length && <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-xs text-gray-400 dark:border-gray-600">無工作項目</div>}
              </div>
            </section>;
          })}
        </div>
      )}
      {editor && <IssueEditor overview={overview} issue={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={(saved) => { setEditor(null); queryClient.invalidateQueries({ queryKey: ['collaboration-issues'] }); if (detail) setDetail(saved); }} />}
      {detail && <IssueDetail overview={overview} initialIssue={detail} onClose={() => { setDetail(null); setSearchParams({}, { replace: true }); }} onEdit={(issue) => { setDetail(null); setSearchParams({}, { replace: true }); setEditor(issue); }} onChanged={() => queryClient.invalidateQueries({ queryKey: ['collaboration-issues'] })} />}
    </div>
  );
}

function IssueCard({ issue, overview, onOpen, onStatus }: { issue: CollaborationIssue; overview: CollaborationOverview; onOpen: () => void; onStatus: (status: IssueStatus) => void }) {
  const TypeIcon = typeIcons[issue.type];
  const assignee = overview.users.find((user) => user.id === issue.assigneeId)?.username || issue.assigneeName || '未指派';
  const currentIndex = statuses.findIndex((status) => status.id === issue.status);
  return <article className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
    <button className="w-full text-left" onClick={onOpen}>
      <div className="flex items-center gap-2 text-xs"><TypeIcon className={`h-4 w-4 ${issue.type === 'bug' ? 'text-red-500' : 'text-primary-500'}`} /><span className="font-mono text-gray-500">{issue.key}</span><span className={`ml-auto rounded px-1.5 py-0.5 ${issue.priority === 'urgent' ? 'bg-red-100 text-red-700' : issue.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{priorityLabels[issue.priority]}</span></div>
      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{issue.title}</h3>
      <div className="mt-3 flex flex-wrap gap-1">{issue.labels.slice(0, 3).map((label) => <span key={label} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{label}</span>)}</div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400"><UserRound className="h-3.5 w-3.5" /><span className="truncate">{assignee}</span>{!!issue.commentCount && <><MessageSquare className="ml-auto h-3.5 w-3.5" />{issue.commentCount}</>}</div>
    </button>
    {currentIndex < statuses.length - 1 && <button onClick={() => onStatus(statuses[currentIndex + 1].id)} className="mt-3 flex w-full items-center justify-center gap-1 rounded border border-gray-200 py-1 text-[11px] text-gray-500 hover:border-primary-300 hover:text-primary-600 dark:border-gray-600">移至 {statuses[currentIndex + 1].label}<ChevronRight className="h-3 w-3" /></button>}
  </article>;
}

function IssueEditor({ overview, issue, onClose, onSaved }: { overview: CollaborationOverview; issue?: CollaborationIssue; onClose: () => void; onSaved: (issue: CollaborationIssue) => void }) {
  const [form, setForm] = useState<IssuePayload>(() => issue ? issuePayload(issue) : { title: '', description: '', issueType: 'task', status: 'open', priority: 'medium', labels: [] });
  const [labels, setLabels] = useState((form.labels ?? []).join(', '));
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, assigneeId: form.assigneeId || undefined, channelId: form.channelId || undefined, dueDate: form.dueDate || undefined, labels: labels.split(',').map((label) => label.trim()).filter(Boolean) };
      return issue ? collaborationApi.updateIssue(issue.id, payload) : collaborationApi.createIssue(payload);
    },
    onSuccess: (response) => { toast.success(issue ? 'Issue 已更新' : 'Issue 已建立'); onSaved(response.data); },
    onError: (error) => toast.error(errorText(error, 'Issue 儲存失敗')),
  });
  return <Modal title={issue ? `編輯 ${issue.key}` : '新增 Issue'} onClose={onClose}><div className="space-y-4">
    <label className="block text-sm font-medium">標題<input autoFocus className="input-field mt-1 w-full" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
    <label className="block text-sm font-medium">說明<textarea className="input-field mt-1 min-h-28 w-full" value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">類型<select className="input-field mt-1 w-full" value={form.issueType} onChange={(event) => setForm({ ...form, issueType: event.target.value as IssueType })}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium">狀態<select className="input-field mt-1 w-full" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as IssueStatus })}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label><label className="text-sm font-medium">優先級<select className="input-field mt-1 w-full" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as IssuePriority })}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">負責人<select className="input-field mt-1 w-full" value={form.assigneeId ?? ''} onChange={(event) => setForm({ ...form, assigneeId: event.target.value || undefined })}><option value="">未指派</option>{overview.users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}</select></label><label className="text-sm font-medium">關聯頻道<select className="input-field mt-1 w-full" value={form.channelId ?? ''} onChange={(event) => setForm({ ...form, channelId: event.target.value || undefined })}><option value="">不關聯頻道</option>{overview.channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">到期日<input type="date" className="input-field mt-1 w-full" value={form.dueDate ?? ''} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label className="text-sm font-medium">標籤（逗號分隔）<input className="input-field mt-1 w-full" value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="frontend, urgent" /></label></div>
    <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>取消</button><button className="btn-primary" disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? '儲存中…' : '儲存'}</button></div>
  </div></Modal>;
}

function IssueDetail({ overview, initialIssue, onClose, onEdit, onChanged }: { overview: CollaborationOverview; initialIssue: CollaborationIssue; onClose: () => void; onEdit: (issue: CollaborationIssue) => void; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const issueQuery = useQuery({ queryKey: ['collaboration-issue', initialIssue.id], queryFn: () => collaborationApi.issue(initialIssue.id) });
  const commentsQuery = useQuery({ queryKey: ['collaboration-issue-comments', initialIssue.id], queryFn: () => collaborationApi.issueComments(initialIssue.id) });
  const historyQuery = useQuery({ queryKey: ['collaboration-issue-history', initialIssue.id], queryFn: () => collaborationApi.issueHistory(initialIssue.id) });
  const issue = (issueQuery.data?.data ?? initialIssue) as CollaborationIssue;
  const comments = (commentsQuery.data?.data?.comments ?? []) as IssueComment[];
  const history = (historyQuery.data?.data?.history ?? []) as IssueHistoryEntry[];
  const [comment, setComment] = useState('');
  const addComment = useMutation({
    mutationFn: () => collaborationApi.addIssueComment(issue.id, comment),
    onSuccess: () => { setComment(''); queryClient.invalidateQueries({ queryKey: ['collaboration-issue-comments', issue.id] }); queryClient.invalidateQueries({ queryKey: ['collaboration-issue-history', issue.id] }); onChanged(); },
    onError: (error) => toast.error(errorText(error, '留言失敗')),
  });
  const assignee = overview.users.find((user) => user.id === issue.assigneeId)?.username || issue.assigneeName || '未指派';
  const reporter = overview.users.find((user) => user.id === issue.reporterId)?.username || issue.reporterName || issue.reporterId;
  const TypeIcon = typeIcons[issue.type];
  return <Modal title={`${issue.key} · ${issue.title}`} onClose={onClose} width="max-w-5xl"><div className="grid gap-6 lg:grid-cols-[1fr_280px]">
    <div>
      <div className="flex items-center gap-2"><TypeIcon className="h-5 w-5 text-primary-600" /><span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">{typeLabels[issue.type]}</span><span className="rounded bg-primary-50 px-2 py-1 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{statusLabels[issue.status]}</span></div>
      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-200">{issue.description || '未填寫說明'}</p>
      {!!issue.labels.length && <div className="mt-4 flex flex-wrap gap-2">{issue.labels.map((label) => <span key={label} className="flex items-center gap-1 rounded bg-violet-50 px-2 py-1 text-xs text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"><Tag className="h-3 w-3" />{label}</span>)}</div>}
      <section className="mt-8"><h3 className="mb-3 flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />留言 ({comments.length})</h3><div className="space-y-3">{comments.map((entry) => <article key={entry.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"><div className="flex items-center gap-2"><strong className="text-sm">{entry.username}</strong><span className="text-[11px] text-gray-400">{formatTime(entry.createdAt)}</span>{entry.userId === overview.currentUser.id && <div className="ml-auto flex gap-1"><button className="rounded p-1 text-gray-400 hover:text-primary-600" onClick={async () => { const content = window.prompt('編輯留言', entry.content); if (!content?.trim()) return; await collaborationApi.updateIssueComment(issue.id, entry.id, content); queryClient.invalidateQueries({ queryKey: ['collaboration-issue-comments', issue.id] }); }}><Pencil className="h-3.5 w-3.5" /></button><button className="rounded p-1 text-gray-400 hover:text-red-500" onClick={async () => { if (!window.confirm('確定刪除此留言？')) return; await collaborationApi.deleteIssueComment(issue.id, entry.id); queryClient.invalidateQueries({ queryKey: ['collaboration-issue-comments', issue.id] }); onChanged(); }}><Trash2 className="h-3.5 w-3.5" /></button></div>}</div><p className="mt-2 whitespace-pre-wrap text-sm">{entry.content}</p></article>)}{!comments.length && <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400 dark:border-gray-600">尚無留言</p>}</div><div className="mt-3 flex gap-2"><textarea className="input-field min-h-20 flex-1 resize-none" placeholder="新增留言" value={comment} onChange={(event) => setComment(event.target.value)} /><button className="btn-primary self-end p-2.5" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()} title="送出留言"><Send className="h-4 w-4" /></button></div></section>
      <section className="mt-8"><h3 className="mb-3 flex items-center gap-2 font-semibold"><History className="h-4 w-4" />變更歷程</h3><div className="space-y-2">{history.map((entry) => <div key={entry.id} className="flex items-start gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" /><div><p><strong>{entry.username}</strong> {entry.action === 'created' ? '建立此 Issue' : entry.action === 'commented' ? '新增留言' : '更新 Issue 內容或狀態'}</p><p className="text-xs text-gray-400">{formatTime(entry.createdAt)}</p></div></div>)}</div></section>
    </div>
    <aside className="space-y-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60"><button className="btn-primary flex w-full items-center justify-center gap-2" onClick={() => onEdit(issue)}><Pencil className="h-4 w-4" />編輯 Issue</button><InfoRow icon={UserRound} label="負責人" value={assignee} /><InfoRow icon={UserRound} label="回報人" value={reporter} /><InfoRow icon={AlertCircle} label="優先級" value={priorityLabels[issue.priority]} /><InfoRow icon={CalendarDays} label="到期日" value={issue.dueDate || '未設定'} /><InfoRow icon={MessageSquare} label="關聯頻道" value={issue.channelName ? `#${issue.channelName}` : '未關聯'} /><InfoRow icon={Clock3} label="建立時間" value={formatTime(issue.createdAt)} />{(overview.currentUser.role === 'admin' || overview.currentUser.id === issue.reporterId) && <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800" onClick={async () => { if (!window.confirm(`確定永久刪除 ${issue.key}？`)) return; try { await collaborationApi.deleteIssue(issue.id); toast.success('Issue 已刪除'); onChanged(); onClose(); } catch (error) { toast.error(errorText(error, '刪除失敗')); } }}><Trash2 className="h-4 w-4" />刪除 Issue</button>}</aside>
  </div></Modal>;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Circle; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><div><p className="text-xs text-gray-400">{label}</p><p className="text-sm font-medium text-gray-700 dark:text-gray-200">{value}</p></div></div>;
}
