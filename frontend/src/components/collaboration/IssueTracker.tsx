import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const statuses: { id: IssueStatus; labelKey: string; color: string }[] = [
  { id: 'open', labelKey: 'issue.statusOpen', color: 'border-slate-300' },
  { id: 'in_progress', labelKey: 'issue.statusInProgress', color: 'border-blue-400' },
  { id: 'review', labelKey: 'issue.statusReview', color: 'border-violet-400' },
  { id: 'done', labelKey: 'issue.statusDone', color: 'border-emerald-400' },
  { id: 'closed', labelKey: 'issue.statusClosed', color: 'border-gray-400' },
];

const typeIcons = { task: CheckCircle2, bug: Bug, feature: Sparkles, improvement: Wrench };

function errorText(error: any, fallback: string) {
  return error?.response?.data?.error || fallback;
}

function formatTime(value?: string, locale?: string) {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale || 'zh-TW');
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
  const { t } = useTranslation();
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
      toast.success(t('issue.statusUpdated'));
    },
    onError: (error) => toast.error(errorText(error, t('issue.statusUpdateFailed'))),
  });

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input-field w-full pl-9" placeholder={t('issue.searchPlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select className="input-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">{t('issue.allStatuses')}</option>{statuses.map((status) => <option key={status.id} value={status.id}>{t(status.labelKey)}</option>)}</select>
        <select className="input-field" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">{t('issue.allPriorities')}</option>{([['low', t('issue.priorityLow')], ['medium', t('issue.priorityMedium')], ['high', t('issue.priorityHigh')], ['urgent', t('issue.priorityUrgent')]] as const).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button onClick={() => setEditor('new')} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />{t('issue.addIssue')}</button>
      </div>
      {onlyMine && <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-700 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300">{t('issue.onlyMine', { username: overview.currentUser.username })}</div>}
      {issuesQuery.isLoading ? <div className="card py-16 text-center text-gray-500">{t('issue.loading')}</div> : (
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-5">
          {statuses.map((status) => {
            const items = issues.filter((issue) => issue.status === status.id);
            return <section key={status.id} className={`rounded-xl border-t-4 ${status.color} bg-gray-50 p-2 dark:bg-gray-800/60`}>
              <header className="mb-2 flex items-center gap-2 px-2 py-1"><span className="font-semibold text-gray-700 dark:text-gray-200">{t(status.labelKey)}</span><span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{items.length}</span></header>
              <div className="space-y-2">
                {items.map((issue) => <IssueCard key={issue.id} issue={issue} overview={overview} onOpen={() => setDetail(issue)} onStatus={(next) => updateStatus.mutate({ issue, status: next })} />)}
                {!items.length && <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-xs text-gray-400 dark:border-gray-600">{t('issue.noItems')}</div>}
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
  const { t } = useTranslation();
  const TypeIcon = typeIcons[issue.type];
  const assignee = overview.users.find((user) => user.id === issue.assigneeId)?.username || issue.assigneeName || t('issue.unassigned');
  const currentIndex = statuses.findIndex((s) => s.id === issue.status);
  return <article className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
    <button className="w-full text-left" onClick={onOpen}>
      <div className="flex items-center gap-2 text-xs"><TypeIcon className={`h-4 w-4 ${issue.type === 'bug' ? 'text-red-500' : 'text-primary-500'}`} /><span className="font-mono text-gray-500">{issue.key}</span><span className={`ml-auto rounded px-1.5 py-0.5 ${issue.priority === 'urgent' ? 'bg-red-100 text-red-700' : issue.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{t(`issue.priority${issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}` as const)}</span></div>
      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{issue.title}</h3>
      <div className="mt-3 flex flex-wrap gap-1">{issue.labels.slice(0, 3).map((label) => <span key={label} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{label}</span>)}</div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400"><UserRound className="h-3.5 w-3.5" /><span className="truncate">{assignee}</span>{!!issue.commentCount && <><MessageSquare className="ml-auto h-3.5 w-3.5" />{issue.commentCount}</>}</div>
    </button>
    {currentIndex < statuses.length - 1 && <button onClick={() => onStatus(statuses[currentIndex + 1].id)} className="mt-3 flex w-full items-center justify-center gap-1 rounded border border-gray-200 py-1 text-[11px] text-gray-500 hover:border-primary-300 hover:text-primary-600 dark:border-gray-600">{t('issue.moveTo')} {t(statuses[currentIndex + 1].labelKey)}<ChevronRight className="h-3 w-3" /></button>}
  </article>;
}

function IssueEditor({ overview, issue, onClose, onSaved }: { overview: CollaborationOverview; issue?: CollaborationIssue; onClose: () => void; onSaved: (issue: CollaborationIssue) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<IssuePayload>(() => issue ? issuePayload(issue) : { title: '', description: '', issueType: 'task', status: 'open', priority: 'medium', labels: [] });
  const [labels, setLabels] = useState((form.labels ?? []).join(', '));
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, assigneeId: form.assigneeId || undefined, channelId: form.channelId || undefined, dueDate: form.dueDate || undefined, labels: labels.split(',').map((label) => label.trim()).filter(Boolean) };
      return issue ? collaborationApi.updateIssue(issue.id, payload) : collaborationApi.createIssue(payload);
    },
    onSuccess: (response) => { toast.success(issue ? t('issue.updated') : t('issue.created')); onSaved(response.data); },
    onError: (error) => toast.error(errorText(error, t('issue.saveFailed'))),
  });
  return <Modal title={issue ? `${t('issue.edit')} ${issue.key}` : t('issue.addIssue')} onClose={onClose}><div className="space-y-4">
    <label className="block text-sm font-medium">{t('issue.title')}<input autoFocus className="input-field mt-1 w-full" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
    <label className="block text-sm font-medium">{t('issue.description')}<textarea className="input-field mt-1 min-h-28 w-full" value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">{t('issue.type')}<select className="input-field mt-1 w-full" value={form.issueType} onChange={(event) => setForm({ ...form, issueType: event.target.value as IssueType })}>{([['task', t('issue.typeTask')], ['bug', t('issue.typeBug')], ['feature', t('issue.typeFeature')], ['improvement', t('issue.typeImprovement')]] as const).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium">{t('issue.status')}<select className="input-field mt-1 w-full" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as IssueStatus })}>{statuses.map((status) => <option key={status.id} value={status.id}>{t(status.labelKey)}</option>)}</select></label><label className="text-sm font-medium">{t('issue.priority')}<select className="input-field mt-1 w-full" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as IssuePriority })}>{([['low', t('issue.priorityLow')], ['medium', t('issue.priorityMedium')], ['high', t('issue.priorityHigh')], ['urgent', t('issue.priorityUrgent')]] as const).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">{t('issue.assignee')}<select className="input-field mt-1 w-full" value={form.assigneeId ?? ''} onChange={(event) => setForm({ ...form, assigneeId: event.target.value || undefined })}><option value="">{t('issue.unassigned')}</option>{overview.users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}</select></label><label className="text-sm font-medium">{t('issue.channel')}<select className="input-field mt-1 w-full" value={form.channelId ?? ''} onChange={(event) => setForm({ ...form, channelId: event.target.value || undefined })}><option value="">{t('issue.noChannel')}</option>{overview.channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">{t('issue.dueDate')}<input type="date" className="input-field mt-1 w-full" value={form.dueDate ?? ''} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label className="text-sm font-medium">{t('issue.labels')}<input className="input-field mt-1 w-full" value={labels} onChange={(event) => setLabels(event.target.value)} placeholder={t('issue.labelsPlaceholder')} /></label></div>
    <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>{t('issue.cancel')}</button><button className="btn-primary" disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? t('issue.saving') : t('issue.save')}</button></div>
  </div></Modal>;
}

function IssueDetail({ overview, initialIssue, onClose, onEdit, onChanged }: { overview: CollaborationOverview; initialIssue: CollaborationIssue; onClose: () => void; onEdit: (issue: CollaborationIssue) => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
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
    onError: (error) => toast.error(errorText(error, t('issue.commentFailed'))),
  });
  const assignee = overview.users.find((user) => user.id === issue.assigneeId)?.username || issue.assigneeName || t('issue.unassigned');
  const reporter = overview.users.find((user) => user.id === issue.reporterId)?.username || issue.reporterName || issue.reporterId;
  const TypeIcon = typeIcons[issue.type];
  return <Modal title={`${issue.key} · ${issue.title}`} onClose={onClose} width="max-w-5xl"><div className="grid gap-6 lg:grid-cols-[1fr_280px]">
    <div>
      <div className="flex items-center gap-2"><TypeIcon className="h-5 w-5 text-primary-600" /><span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">{t(`issue.type${issue.type.charAt(0).toUpperCase() + issue.type.slice(1)}` as const)}</span><span className="rounded bg-primary-50 px-2 py-1 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{t(statuses.find(s => s.id === issue.status)?.labelKey ?? '')}</span></div>
      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-200">{issue.description || t('issue.noDescription')}</p>
      {!!issue.labels.length && <div className="mt-4 flex flex-wrap gap-2">{issue.labels.map((label) => <span key={label} className="flex items-center gap-1 rounded bg-violet-50 px-2 py-1 text-xs text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"><Tag className="h-3 w-3" />{label}</span>)}</div>}
      <section className="mt-8"><h3 className="mb-3 flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />{t('issue.comments')} ({comments.length})</h3><div className="space-y-3">{comments.map((entry) => <article key={entry.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"><div className="flex items-center gap-2"><strong className="text-sm">{entry.username}</strong><span className="text-[11px] text-gray-400">{formatTime(entry.createdAt, i18n.language)}</span>{entry.userId === overview.currentUser.id && <div className="ml-auto flex gap-1"><button className="rounded p-1 text-gray-400 hover:text-primary-600" onClick={async () => { const content = window.prompt(t('issue.editComment'), entry.content); if (!content?.trim()) return; await collaborationApi.updateIssueComment(issue.id, entry.id, content); queryClient.invalidateQueries({ queryKey: ['collaboration-issue-comments', issue.id] }); }}><Pencil className="h-3.5 w-3.5" /></button><button className="rounded p-1 text-gray-400 hover:text-red-500" onClick={async () => { if (!window.confirm(t('issue.confirmDeleteComment'))) return; await collaborationApi.deleteIssueComment(issue.id, entry.id); queryClient.invalidateQueries({ queryKey: ['collaboration-issue-comments', issue.id] }); onChanged(); }}><Trash2 className="h-3.5 w-3.5" /></button></div>}</div><p className="mt-2 whitespace-pre-wrap text-sm">{entry.content}</p></article>)}{!comments.length && <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400 dark:border-gray-600">{t('issue.noComments')}</p>}</div><div className="mt-3 flex gap-2"><textarea className="input-field min-h-20 flex-1 resize-none" placeholder={t('issue.commentPlaceholder')} value={comment} onChange={(event) => setComment(event.target.value)} /><button className="btn-primary self-end p-2.5" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()} title={t('issue.sendComment')}><Send className="h-4 w-4" /></button></div></section>
      <section className="mt-8"><h3 className="mb-3 flex items-center gap-2 font-semibold"><History className="h-4 w-4" />{t('issue.history')}</h3><div className="space-y-2">{history.map((entry) => <div key={entry.id} className="flex items-start gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" /><div><p><strong>{entry.username}</strong> {entry.action === 'created' ? t('issue.historyCreated') : entry.action === 'commented' ? t('issue.historyCommented') : t('issue.historyUpdated')}</p><p className="text-xs text-gray-400">{formatTime(entry.createdAt, i18n.language)}</p></div></div>)}</div></section>
    </div>
    <aside className="space-y-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60"><button className="btn-primary flex w-full items-center justify-center gap-2" onClick={() => onEdit(issue)}><Pencil className="h-4 w-4" />{t('issue.editIssue')}</button><InfoRow icon={UserRound} label={t('issue.assignee')} value={assignee} /><InfoRow icon={UserRound} label={t('issue.reporter')} value={reporter} /><InfoRow icon={AlertCircle} label={t('issue.priority')} value={t(`issue.priority${issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}` as const)} /><InfoRow icon={CalendarDays} label={t('issue.dueDate')} value={issue.dueDate || t('issue.notSet')} /><InfoRow icon={MessageSquare} label={t('issue.channel')} value={issue.channelName ? `#${issue.channelName}` : t('issue.notLinked')} /><InfoRow icon={Clock3} label={t('issue.createdAt')} value={formatTime(issue.createdAt, i18n.language)} />{(overview.currentUser.role === 'admin' || overview.currentUser.id === issue.reporterId) && <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800" onClick={async () => { if (!window.confirm(t('issue.confirmDelete', { key: issue.key }))) return; try { await collaborationApi.deleteIssue(issue.id); toast.success(t('issue.deleted')); onChanged(); onClose(); } catch (error) { toast.error(errorText(error, t('issue.deleteFailed'))); } }}><Trash2 className="h-4 w-4" />{t('issue.deleteIssue')}</button>}</aside>
  </div></Modal>;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Circle; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><div><p className="text-xs text-gray-400">{label}</p><p className="text-sm font-medium text-gray-700 dark:text-gray-200">{value}</p></div></div>;
}
