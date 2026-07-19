import { useMemo, useState } from 'react';
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

const sectionConfig: Record<Section, { title: string; description: string; icon: typeof Network }> = {
  overview: { title: '工作流程總覽', description: '掌握流程定義、發佈狀態、待辦工作及執行健康度', icon: Network },
  definitions: { title: '流程定義與版本', description: '管理流程草稿、版本、發佈、封存與測試執行', icon: GitBranch },
  tasks: { title: '我的流程工作', description: '處理指派給目前使用者的人工工作、核准與退回', icon: UserCheck },
  instances: { title: '流程實例', description: '查看我發起或參與的流程實例、輸入輸出及逐步歷程', icon: FileClock },
  monitoring: { title: '執行監控', description: '集中監控排隊、執行、等待人工處理與失敗的流程', icon: Activity },
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
    onSuccess: () => { toast.success('流程已通過結構驗證並發佈'); refresh(); },
    onError: (error) => toast.error(errorMessage(error, '流程發佈失敗')),
  });
  const archive = useMutation({
    mutationFn: (definition: WorkflowDefinition) => workflowApi.archive(definition.key),
    onSuccess: () => { toast.success('流程已封存，既有版本與執行歷程保留'); refresh(); },
    onError: (error) => toast.error(errorMessage(error, '流程封存失敗')),
  });
  const run = useMutation({
    mutationFn: ({ definition, input }: { definition: WorkflowDefinition; input: Record<string, unknown> }) => workflowApi.run(definition.key, input),
    onSuccess: (response) => { toast.success(`流程已排入執行：${response.data.instanceId}`); setRunDefinition(null); refresh(); },
    onError: (error) => toast.error(errorMessage(error, '流程執行失敗')),
  });
  const decide = useMutation({
    mutationFn: ({ task, action, comment }: { task: WorkflowTask; action: 'approved' | 'rejected'; comment?: string }) => workflowApi.decideTask(task.id, { action, comment }),
    onSuccess: (_response, variables) => { toast.success(variables.action === 'approved' ? '工作已核准，流程將繼續執行' : '工作已退回，流程已停止'); refresh(); },
    onError: (error) => toast.error(errorMessage(error, '流程工作處理失敗')),
  });

  const activeInstances = useMemo(() => instanceItems.filter((item) => ['queued', 'running', 'waiting', 'failed'].includes(item.status)), [instanceItems]);
  const openRun = (definition: WorkflowDefinition) => { setRunDefinition(definition); setRunInput('{\n  "requestId": "manual-001"\n}'); };
  const submitRun = () => {
    if (!runDefinition) return;
    try {
      const input = JSON.parse(runInput) as Record<string, unknown>;
      if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('輸入必須是 JSON 物件');
      run.mutate({ definition: runDefinition, input });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'JSON 格式錯誤'); }
  };
  const decideTask = (task: WorkflowTask, action: 'approved' | 'rejected') => {
    const comment = window.prompt(action === 'approved' ? '核准意見（可留空）' : '請輸入退回原因');
    if (comment === null) return;
    decide.mutate({ task, action, comment: comment.trim() || undefined });
  };

  if (!validSection) return <Navigate to="/cortex/workflows/overview" replace />;

  const definitionCards = (model?.definitions ?? []).map((definition) => (
    <article className="card" key={definition.id}>
      <div className="flex items-start justify-between gap-2"><div><span className="text-xs font-bold text-primary-600">{definition.key}</span><h3 className="mt-1 font-semibold">{definition.name}</h3></div><Status value={definition.status} /></div>
      <p className="mt-3 min-h-10 text-sm text-gray-500">{definition.description || '尚未填寫流程說明'}</p>
      <p className="mt-3 text-xs text-gray-400">版本 v{definition.currentVersion} · {displayTime(definition.updatedAt)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="btn-secondary flex items-center gap-1 text-sm" to={`/cortex/workflows/designer?workflow=${encodeURIComponent(definition.key)}`}><SquarePen className="h-4 w-4" />設計</Link>
        {definition.canEdit && definition.status !== 'published' && <button className="btn-secondary flex items-center gap-1 text-sm" onClick={() => publish.mutate(definition)}><Rocket className="h-4 w-4" />發佈</button>}
        {definition.status === 'published' && <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => openRun(definition)}><Play className="h-4 w-4" />執行</button>}
        {definition.canEdit && definition.key !== 'default' && <button className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600" onClick={() => { if (window.confirm(`封存「${definition.name}」？執行歷程會保留。`)) archive.mutate(definition); }}><Archive className="mr-1 inline h-4 w-4" />封存</button>}
      </div>
    </article>
  ));

  const instanceTable = (items: WorkflowInstance[]) => <div className="card overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b text-xs text-gray-500 dark:border-gray-700"><tr><th className="p-3">流程／版本</th><th className="p-3">狀態</th><th className="p-3">發起人</th><th className="p-3">目前節點</th><th className="p-3">開始時間</th><th className="p-3">操作</th></tr></thead><tbody>{items.map((instance) => <tr className="border-b last:border-0 dark:border-gray-700" key={instance.id}><td className="p-3"><p className="font-medium">{instance.workflowKey}</p><p className="text-xs text-gray-400">v{instance.version} · {instance.id.slice(0, 8)}</p></td><td className="p-3"><Status value={instance.status} /></td><td className="p-3">{instance.startedByName}</td><td className="p-3 text-gray-500">{instance.currentNodeId || '—'}</td><td className="p-3 text-gray-500">{displayTime(instance.startedAt)}</td><td className="p-3"><button className="btn-secondary flex items-center gap-1 text-sm" onClick={() => setDetailId(instance.id)}><Eye className="h-4 w-4" />歷程</button></td></tr>)}{!items.length && <tr><td className="p-12 text-center text-gray-500" colSpan={6}>目前沒有流程實例</td></tr>}</tbody></table></div>;

  const content = (() => {
    if (activeSection === 'overview') return <div className="space-y-6"><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{[
      { label: '流程定義', value: model?.stats.definitions ?? 0, icon: GitBranch }, { label: '已發佈', value: model?.stats.published ?? 0, icon: Rocket },
      { label: '執行中', value: model?.stats.running ?? 0, icon: RefreshCw }, { label: '等待人工', value: model?.stats.waiting ?? 0, icon: Clock3 },
      { label: '待辦工作', value: model?.stats.pendingTasks ?? 0, icon: UserCheck }, { label: '失敗', value: model?.stats.failed ?? 0, icon: XCircle },
    ].map(({ label, value, icon: Icon }) => <article className="card flex items-center gap-3" key={label}><Icon className="h-5 w-5 text-primary-600" /><div><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold">{value}</p></div></article>)}</section><section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">最近流程定義</h2><Link className="text-sm text-primary-600" to="/cortex/workflows/definitions">查看全部</Link></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{definitionCards.slice(0, 6)}{!definitionCards.length && <div className="card col-span-full py-14 text-center text-gray-500">尚無流程，請從流程設計器建立。</div>}</div></section></div>;
    if (activeSection === 'definitions') return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{definitionCards}{!definitionCards.length && <div className="card col-span-full py-14 text-center"><Network className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-3 text-gray-500">尚無流程定義</p><Link className="btn-primary mt-4 inline-block" to="/cortex/workflows/designer">開啟設計器</Link></div>}</div>;
    if (activeSection === 'tasks') return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{taskItems.map((task) => <article className="card" key={task.id}><div className="flex items-start justify-between"><UserCheck className="h-7 w-7 text-violet-500" /><Status value={task.status} /></div><h3 className="mt-3 font-semibold">{task.title}</h3><p className="mt-2 min-h-10 text-sm text-gray-500">{task.instructions || '未填寫處理說明'}</p><p className="mt-3 text-xs text-gray-400">期限：{task.dueDate || '未設定'} · 實例 {task.instanceId.slice(0, 8)}</p>{task.status === 'pending' && <div className="mt-4 flex gap-2"><button className="btn-primary flex-1" onClick={() => decideTask(task, 'approved')}><CheckCircle2 className="mr-1 inline h-4 w-4" />核准／完成</button><button className="btn-secondary flex-1 text-red-600" onClick={() => decideTask(task, 'rejected')}><XCircle className="mr-1 inline h-4 w-4" />退回</button></div>}<button className="mt-3 text-xs text-primary-600" onClick={() => setDetailId(task.instanceId)}>查看流程歷程</button></article>)}{!taskItems.length && <div className="card col-span-full py-14 text-center text-gray-500">目前沒有指派給你的流程工作</div>}</div>;
    if (activeSection === 'monitoring') return <div className="space-y-5"><section className="card flex flex-wrap items-center gap-5"><Activity className="h-8 w-8 text-primary-600" /><div><h2 className="font-semibold">每 5 秒自動更新</h2><p className="text-sm text-gray-500">顯示排隊、執行、等待人工及失敗的實例；已完成項目可至「流程實例」查閱。</p></div><button className="btn-secondary ml-auto" onClick={refresh}>立即更新</button></section>{instanceTable(activeInstances)}</div>;
    return instanceTable(instanceItems);
  })();

  return <div className="mx-auto max-w-[1600px] px-4 pb-10">
    <CommonHeroTitle icon={config.icon} title={config.title} description={config.description} breadcrumb={['工作流程管理', config.title]} extraButtons={[{ label: '重新整理', icon: RefreshCw, onClick: refresh }]} />
    {(overview.isLoading || (instances.isLoading && activeSection !== 'definitions') || (tasks.isLoading && activeSection === 'tasks')) && <div className="card flex min-h-48 items-center justify-center text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />載入工作流程資料…</div>}
    {overview.isError && <div className="card flex min-h-48 flex-col items-center justify-center text-red-600"><AlertCircle className="mb-2 h-8 w-8" />無法載入工作流程資料</div>}
    {!overview.isLoading && !overview.isError && content}
    {runDefinition && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={() => setRunDefinition(null)}><div className="card w-full max-w-xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">執行 {runDefinition.name}</h2><p className="text-xs text-gray-500">輸入 JSON 會成為流程 payload</p></div><button onClick={() => setRunDefinition(null)}><X className="h-5 w-5" /></button></div><textarea className="input-field min-h-56 font-mono text-xs" value={runInput} onChange={(event) => setRunInput(event.target.value)} /><div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setRunDefinition(null)}>取消</button><button className="btn-primary" disabled={run.isPending} onClick={submitRun}>{run.isPending ? '送出中…' : '開始執行'}</button></div></div></div>}
    {detailId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={() => setDetailId('')}><div className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">流程執行歷程</h2><p className="text-xs text-gray-500">{detail.data?.data.instance.workflowKey} · {detailId}</p></div><button onClick={() => setDetailId('')}><X className="h-5 w-5" /></button></div>{detail.isLoading && <p className="py-10 text-center text-gray-500">載入歷程…</p>}{detail.data && <div className="space-y-3">{detail.data.data.steps.map((step, index) => <article className="flex gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700" key={step.id}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${statusClass(step.status)}`}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="font-medium">{step.nodeLabel}</h3><Status value={step.status} /></div><p className="text-xs text-gray-500">{step.nodeType} · {displayTime(step.startedAt)}</p>{step.errorMessage && <p className="mt-2 text-xs text-red-600">{step.errorMessage}</p>}{step.output != null && <pre className="mt-2 max-h-36 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-900">{JSON.stringify(step.output, null, 2)}</pre>}</div></article>)}{!detail.data.data.steps.length && <p className="py-10 text-center text-gray-500">尚無步驟記錄</p>}</div>}</div></div>}
  </div>;
}
