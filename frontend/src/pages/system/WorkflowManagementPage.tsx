import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock3,
  Eye,
  FileClock,
  GitBranch,
  Loader2,
  Network,
  Play,
  RefreshCw,
  Rocket,
  SquarePen,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { workflowApi } from '../../services/api';
import type { WorkflowDefinition, WorkflowInstance, WorkflowTask } from '../../types/workflows';

type Section = 'overview' | 'definitions' | 'tasks' | 'instances' | 'monitoring';

const sectionConfig: Record<Section, { titleKey: string; descKey: string; icon: typeof Network }> = {
  overview: { titleKey: 'workflow.overviewTitle', descKey: 'workflow.overviewDescription', icon: Network },
  definitions: { titleKey: 'workflow.definitionsTitle', descKey: 'workflow.definitionsDescription', icon: GitBranch },
  tasks: { titleKey: 'workflow.tasksTitle', descKey: 'workflow.tasksDescription', icon: UserCheck },
  instances: { titleKey: 'workflow.instancesTitle', descKey: 'workflow.instancesDescription', icon: FileClock },
  monitoring: { titleKey: 'workflow.monitoringTitle', descKey: 'workflow.monitoringDescription', icon: Activity },
};

function errorMessage(error: unknown, fallback: string) {
  const value = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
  return value.response?.data?.error ?? value.response?.data?.message ?? value.message ?? fallback;
}

function displayTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}

function statusClass(status: string) {
  if (['completed', 'published', 'approved'].includes(status)) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (['failed', 'rejected', 'archived'].includes(status)) return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (['running'].includes(status)) return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
}

function Status({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(value)}`}>{value}</span>;
}

export default function WorkflowManagementPage() {
  const { t } = useTranslation();
  const { section = 'overview' } = useParams();
  const validSection = section in sectionConfig;
  const activeSection = (validSection ? section : 'overview') as Section;
  const config = sectionConfig[activeSection];
  const client = useQueryClient();
  const [runDefinition, setRunDefinition] = useState<WorkflowDefinition | null>(null);
  const [runInput, setRunInput] = useState('{\n  "requestId": "manual-001"\n}');
  const [detailId, setDetailId] = useState('');
  const overview = useQuery({ queryKey: ['workflow-overview'], queryFn: workflowApi.overview });
  const isAdmin = overview.data?.data.currentUser.role === 'admin';
  const instances = useQuery({
    queryKey: ['workflow-instances', isAdmin],
    queryFn: () => workflowApi.instances(isAdmin),
    enabled: ['overview', 'instances', 'monitoring'].includes(activeSection),
    refetchInterval: activeSection === 'monitoring' ? 5000 : false,
  });
  const tasks = useQuery({
    queryKey: ['workflow-tasks', isAdmin && activeSection === 'monitoring'],
    queryFn: () => workflowApi.tasks(isAdmin && activeSection === 'monitoring'),
    enabled: ['overview', 'tasks', 'monitoring'].includes(activeSection),
    refetchInterval: activeSection === 'monitoring' ? 5000 : false,
  });
  const detail = useQuery({ queryKey: ['workflow-instance', detailId], queryFn: () => workflowApi.instance(detailId), enabled: !!detailId });
  const model = overview.data?.data;
  const instanceItems = (instances.data?.data.instances ?? []) as WorkflowInstance[];
  const taskItems = tasks.data?.data.tasks ?? [];
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['workflow-overview'] });
    client.invalidateQueries({ queryKey: ['workflow-instances'] });
    client.invalidateQueries({ queryKey: ['workflow-tasks'] });
    client.invalidateQueries({ queryKey: ['workflow-instance'] });
  };
  const publish = useMutation({
    mutationFn: (definition: WorkflowDefinition) => workflowApi.publish(definition.key),
    onSuccess: () => { toast.success(t('workflow.published')); refresh(); },
    onError: (error) => toast.error(errorMessage(error, t('workflow.publishFailed'))),
  });
  const archive = useMutation({
    mutationFn: (definition: WorkflowDefinition) => workflowApi.archive(definition.key),
    onSuccess: () => { toast.success(t('workflow.archived')); refresh(); },
    onError: (error) => toast.error(errorMessage(error, t('workflow.archiveFailed'))),
  });
  const run = useMutation({
    mutationFn: ({ definition, input }: { definition: WorkflowDefinition; input: Record<string, unknown> }) => workflowApi.run(definition.key, input),
    onSuccess: (response) => { toast.success(t('workflow.runQueued', { instanceId: response.data.instanceId })); setRunDefinition(null); refresh(); },
    onError: (error) => toast.error(errorMessage(error, t('workflow.runFailed'))),
  });
  const decide = useMutation({
    mutationFn: ({ task, action, comment }: { task: WorkflowTask; action: 'approved' | 'rejected'; comment?: string }) => workflowApi.decideTask(task.id, { action, comment }),
    onSuccess: (_response, variables) => { toast.success(variables.action === 'approved' ? t('workflow.decisionApproved') : t('workflow.decisionRejected')); refresh(); },
    onError: (error) => toast.error(errorMessage(error, t('workflow.decisionFailed'))),
  });

  const activeInstances = useMemo(() => instanceItems.filter((item) => ['queued', 'running', 'waiting', 'failed'].includes(item.status)), [instanceItems]);
  const openRun = (definition: WorkflowDefinition) => { setRunDefinition(definition); setRunInput('{\n  "requestId": "manual-001"\n}'); };
  const submitRun = () => {
    if (!runDefinition) return;
    try {
      const input = JSON.parse(runInput) as Record<string, unknown>;
      if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error(t('workflow.inputMustBeObject'));
      run.mutate({ definition: runDefinition, input });
    } catch (error) { toast.error(error instanceof Error ? error.message : t('workflow.jsonParseError')); }
  };
  const decideTask = (task: WorkflowTask, action: 'approved' | 'rejected') => {
    const comment = window.prompt(action === 'approved' ? t('workflow.approveComment') : t('workflow.rejectComment'));
    if (comment === null) return;
    decide.mutate({ task, action, comment: comment.trim() || undefined });
  };

  if (!validSection) return <Navigate to="/cortex/workflows/overview" replace />;

  const definitionCards = (model?.definitions ?? []).map((definition) => (
    <article className="card" key={definition.id}>
      <div className="flex items-start justify-between gap-2"><div><span className="text-xs font-bold text-primary-600">{definition.key}</span><h3 className="mt-1 font-semibold">{definition.name}</h3></div><Status value={definition.status} /></div>
      <p className="mt-3 min-h-10 text-sm text-gray-500">{definition.description || t('workflow.noDescription')}</p>
      <p className="mt-3 text-xs text-gray-400">版本 v{definition.currentVersion} · {displayTime(definition.updatedAt)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="btn-secondary flex items-center gap-1 text-sm" to={`/cortex/workflows/designer?workflow=${encodeURIComponent(definition.key)}`}><SquarePen className="h-4 w-4" />{t('workflow.design')}</Link>
        {definition.canEdit && definition.status !== 'published' && <button className="btn-secondary flex items-center gap-1 text-sm" onClick={() => publish.mutate(definition)}><Rocket className="h-4 w-4" />{t('workflow.publish')}</button>}
        {definition.status === 'published' && <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => openRun(definition)}><Play className="h-4 w-4" />{t('workflow.execute')}</button>}
        {definition.canEdit && definition.key !== 'default' && <button className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600" onClick={() => { if (window.confirm(t('workflow.confirmArchive', { name: definition.name }))) archive.mutate(definition); }}><Archive className="mr-1 inline h-4 w-4" />{t('workflow.archive')}</button>}
      </div>
    </article>
  ));

  const instanceTable = (items: WorkflowInstance[]) => <div className="card overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b text-xs text-gray-500 dark:border-gray-700"><tr><th className="p-3">{t('workflow.instanceHeader')}</th><th className="p-3">{t('workflow.statusHeader')}</th><th className="p-3">{t('workflow.initiator')}</th><th className="p-3">{t('workflow.currentNode')}</th><th className="p-3">{t('workflow.startTime')}</th><th className="p-3">{t('workflow.actions')}</th></tr></thead><tbody>{items.map((instance) => <tr className="border-b last:border-0 dark:border-gray-700" key={instance.id}><td className="p-3"><p className="font-medium">{instance.workflowKey}</p><p className="text-xs text-gray-400">v{instance.version} · {instance.id.slice(0, 8)}</p></td><td className="p-3"><Status value={instance.status} /></td><td className="p-3">{instance.startedByName}</td><td className="p-3 text-gray-500">{instance.currentNodeId || '—'}</td><td className="p-3 text-gray-500">{displayTime(instance.startedAt)}</td><td className="p-3"><button className="btn-secondary flex items-center gap-1 text-sm" onClick={() => setDetailId(instance.id)}><Eye className="h-4 w-4" />{t('workflow.viewHistory')}</button></td></tr>)}{!items.length && <tr><td className="p-12 text-center text-gray-500" colSpan={6}>{t('workflow.noInstances')}</td></tr>}</tbody></table></div>;

  const content = (() => {
    if (activeSection === 'overview') return <div className="space-y-6"><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{[
      { labelKey: 'workflow.statsDefinitions', value: model?.stats.definitions ?? 0, icon: GitBranch }, { labelKey: 'workflow.statsPublished', value: model?.stats.published ?? 0, icon: Rocket },
      { labelKey: 'workflow.statsRunning', value: model?.stats.running ?? 0, icon: RefreshCw }, { labelKey: 'workflow.statsWaiting', value: model?.stats.waiting ?? 0, icon: Clock3 },
      { labelKey: 'workflow.statsPendingTasks', value: model?.stats.pendingTasks ?? 0, icon: UserCheck }, { labelKey: 'workflow.statsFailed', value: model?.stats.failed ?? 0, icon: XCircle },
    ].map(({ labelKey, value, icon: Icon }) => <article className="card flex items-center gap-3" key={labelKey}><Icon className="h-5 w-5 text-primary-600" /><div><p className="text-xs text-gray-500">{t(labelKey)}</p><p className="text-xl font-bold">{value}</p></div></article>)}</section><section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{t('workflow.recentDefinitions')}</h2><Link className="text-sm text-primary-600" to="/cortex/workflows/definitions">{t('workflow.viewAll')}</Link></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{definitionCards.slice(0, 6)}{!definitionCards.length && <div className="card col-span-full py-14 text-center text-gray-500">{t('workflow.noDefinitions')}</div>}</div></section></div>;
    if (activeSection === 'definitions') return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{definitionCards}{!definitionCards.length && <div className="card col-span-full py-14 text-center"><Network className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-3 text-gray-500">{t('workflow.noDefinitionsAlt')}</p><Link className="btn-primary mt-4 inline-block" to="/cortex/workflows/designer">{t('workflow.openDesigner')}</Link></div>}</div>;
    if (activeSection === 'tasks') return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{taskItems.map((task) => <article className="card" key={task.id}><div className="flex items-start justify-between"><UserCheck className="h-7 w-7 text-violet-500" /><Status value={task.status} /></div><h3 className="mt-3 font-semibold">{task.title}</h3><p className="mt-2 min-h-10 text-sm text-gray-500">{task.instructions || t('workflow.noDescription')}</p><p className="mt-3 text-xs text-gray-400">{t('workflow.due')}: {task.dueDate || t('workflow.dueUnset')} · {t('workflow.instance')} {task.instanceId.slice(0, 8)}</p>{task.status === 'pending' && <div className="mt-4 flex gap-2"><button className="btn-primary flex-1" onClick={() => decideTask(task, 'approved')}><CheckCircle2 className="mr-1 inline h-4 w-4" />{t('workflow.approve')}</button><button className="btn-secondary flex-1 text-red-600" onClick={() => decideTask(task, 'rejected')}><XCircle className="mr-1 inline h-4 w-4" />{t('workflow.reject')}</button></div>}<button className="mt-3 text-xs text-primary-600" onClick={() => setDetailId(task.instanceId)}>{t('workflow.viewHistory')}</button></article>)}{!taskItems.length && <div className="card col-span-full py-14 text-center text-gray-500">{t('workflow.noTasks')}</div>}</div>;
    if (activeSection === 'monitoring') return <div className="space-y-5"><section className="card flex flex-wrap items-center gap-5"><Activity className="h-8 w-8 text-primary-600" /><div><h2 className="font-semibold">{t('workflow.monitoringAutoRefresh')}</h2><p className="text-sm text-gray-500">{t('workflow.monitoringDescription')}</p></div><button className="btn-secondary ml-auto" onClick={refresh}>{t('workflow.refresh')}</button></section>{instanceTable(activeInstances)}</div>;
    return instanceTable(instanceItems);
  })();

  return <div className="mx-auto max-w-[1600px] px-4 pb-10">
    <CommonHeroTitle icon={config.icon} title={t(config.titleKey)} description={t(config.descKey)} breadcrumb={[t('workflow.breadcrumb'), t(config.titleKey)]} extraButtons={[{ label: t('workflow.refresh'), icon: RefreshCw, onClick: refresh }]} />
    {(overview.isLoading || (instances.isLoading && activeSection !== 'definitions') || (tasks.isLoading && activeSection === 'tasks')) && <div className="card flex min-h-48 items-center justify-center text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('workflow.loading')}</div>}
    {overview.isError && <div className="card flex min-h-48 flex-col items-center justify-center text-red-600"><AlertCircle className="mb-2 h-8 w-8" />{t('workflow.loadError')}</div>}
    {!overview.isLoading && !overview.isError && content}
    {runDefinition && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={() => setRunDefinition(null)}><div className="card w-full max-w-xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{t('workflow.runTitle', { name: runDefinition.name })}</h2><p className="text-xs text-gray-500">{t('workflow.runDescription')}</p></div><button onClick={() => setRunDefinition(null)}><X className="h-5 w-5" /></button></div><textarea className="input-field min-h-56 font-mono text-xs" value={runInput} onChange={(event) => setRunInput(event.target.value)} /><div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setRunDefinition(null)}>{t('workflow.cancel')}</button><button className="btn-primary" disabled={run.isPending} onClick={submitRun}>{run.isPending ? t('workflow.submitting') : t('workflow.startExecute')}</button></div></div></div>}
    {detailId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={() => setDetailId('')}><div className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{t('workflow.processHistory')}</h2><p className="text-xs text-gray-500">{detail.data?.data.instance.workflowKey} · {detailId}</p></div><button onClick={() => setDetailId('')}><X className="h-5 w-5" /></button></div>{detail.isLoading && <p className="py-10 text-center text-gray-500">{t('workflow.loadingHistory')}</p>}{detail.data && <div className="space-y-3">{detail.data.data.steps.map((step, index) => <article className="flex gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700" key={step.id}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${statusClass(step.status)}`}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="font-medium">{step.nodeLabel}</h3><Status value={step.status} /></div><p className="text-xs text-gray-500">{step.nodeType} · {displayTime(step.startedAt)}</p>{step.errorMessage && <p className="mt-2 text-xs text-red-600">{step.errorMessage}</p>}{step.output != null && <pre className="mt-2 max-h-36 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-900">{JSON.stringify(step.output, null, 2)}</pre>}</div></article>)}{!detail.data.data.steps.length && <p className="py-10 text-center text-gray-500">{t('workflow.noSteps')}</p>}</div>}</div></div>}
  </div>;
}
