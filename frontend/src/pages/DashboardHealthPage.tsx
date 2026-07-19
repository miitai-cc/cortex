import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, CheckCircle2, Clock3, Database, FileText, Heart, RefreshCw, Server, Settings2, Zap } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import { dashboardApi } from '../services/api';

const serviceIcons: Record<string, typeof Server> = { api: Server, database: Database, qdrant: Zap, documents: FileText, embedding: Settings2, llm: Settings2 };
const statusStyle: Record<string, { label: string; color: string; bg: string; border: string }> = {
  healthy: { label: '正常', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
  warning: { label: '警告', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
  error: { label: '異常', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  configured: { label: '已設定（未探測）', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  unconfigured: { label: '未設定', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-700', border: 'border-gray-200 dark:border-gray-600' },
};

function formatTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}

export default function DashboardHealthPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({ queryKey: ['dashboard-health'], queryFn: dashboardApi.health, refetchInterval: 10000 });
  const model = data?.data ?? { status: 'unknown', database: false, qdrant: false, services: [], queue: [], alerts: [], metrics: {}, querySamples: [] };
  const metrics = model.metrics ?? {};
  const samples = (model.querySamples ?? []).slice().reverse().map((sample: any) => ({ ...sample, time: formatTime(sample.timestamp).split(' ')[1] ?? formatTime(sample.timestamp) }));
  return <div className="mx-auto max-w-7xl px-4 pb-10">
    <CommonHeroTitle icon={Heart} title="系統健康" description="後端即時探測資料庫、Qdrant、文件索引佇列與已完成檢索延遲；未探測服務會明確標示" extraButtons={[{ label: '重新整理', icon: RefreshCw, onClick: () => refetch() }]} />
    <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Metric label="整體狀態" value={isLoading ? '檢查中…' : model.status === 'healthy' ? '正常' : '降級'} ok={model.status === 'healthy'} icon={Heart} />
      <Metric label="關聯資料庫" value={model.database ? '可連線' : '無法連線'} ok={model.database} icon={Database} />
      <Metric label="向量資料庫" value={model.qdrant ? '可連線' : '無法連線'} ok={model.qdrant} icon={Zap} />
      <Metric label="索引佇列" value={`${metrics.pendingDocuments ?? 0} 筆`} ok={(metrics.pendingDocuments ?? 0) === 0} icon={Activity} />
      <Metric label="索引失敗" value={`${metrics.failedDocuments ?? 0} 筆`} ok={(metrics.failedDocuments ?? 0) === 0} icon={AlertCircle} />
    </div>

    <section className="card mb-6"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">服務探測</h2><span className="text-xs text-gray-400">每 10 秒更新 · {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('zh-TW') : '—'}</span></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{model.services.map((service: any) => {
      const config = statusStyle[service.status] ?? statusStyle.unconfigured;
      const Icon = serviceIcons[service.id] ?? Server;
      return <article key={service.id} className={`rounded-xl border p-4 ${config.border}`}><div className="flex items-center gap-3"><span className={`rounded-lg p-2 ${config.bg}`}><Icon className={`h-5 w-5 ${config.color}`} /></span><div className="min-w-0 flex-1"><h3 className="font-medium">{service.name}</h3><p className="truncate text-xs text-gray-400">{service.details}</p></div><span className={`rounded-full px-2 py-1 text-[11px] ${config.bg} ${config.color}`}>{config.label}</span></div><p className="mt-3 text-xs text-gray-500">{service.latencyMs == null ? '此服務未執行主動延遲探測' : `本次探測：${service.latencyMs} ms`}</p></article>;
    })}</div></section>

    <div className="mb-6 grid gap-6 lg:grid-cols-2">
      <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">已完成檢索延遲</h2><span className="text-xs text-gray-400">最近 {metrics.completedQueries ?? 0} 筆 · 平均 {metrics.averageQueryLatencyMs ?? 0} ms</span></div>{samples.length ? <ResponsiveContainer width="100%" height={230}><LineChart data={samples}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="time" tick={{ fontSize: 10 }} /><YAxis unit="ms" tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="durationMs" name="完整 RAG 延遲" stroke="#8b5cf6" strokeWidth={2} /></LineChart></ResponsiveContainer> : <div className="flex h-[230px] items-center justify-center text-sm text-gray-400">尚無已完成檢索樣本</div>}</section>
      <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">文件處理佇列</h2><span className="text-xs text-gray-400">{model.queue.length} 筆</span></div><div className="max-h-[230px] space-y-2 overflow-auto">{model.queue.map((job: any) => <div key={job.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"><Clock3 className="h-4 w-4 text-amber-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{job.target}</p><p className="text-xs text-gray-400">{job.type} · {job.status}</p></div><span className="text-xs text-gray-400">{formatTime(job.updatedAt)}</span></div>)}{!model.queue.length && <div className="flex h-[190px] items-center justify-center text-sm text-emerald-600"><CheckCircle2 className="mr-2 h-5 w-5" />目前沒有待處理文件</div>}</div></section>
    </div>
    <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">未解決告警</h2><span className="text-xs text-gray-400">{model.alerts.length} 個</span></div><div className="space-y-2">{model.alerts.map((alert: any) => <div key={alert.id} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"><AlertCircle className="mt-0.5 h-4 w-4 text-red-600" /><div><p className="text-sm text-red-700 dark:text-red-300">{alert.message}</p><p className="text-xs text-red-400">{formatTime(alert.timestamp)}</p></div></div>)}{!model.alerts.length && <div className="py-8 text-center text-sm text-emerald-600"><CheckCircle2 className="mx-auto mb-2 h-6 w-6" />目前沒有未解決的索引告警</div>}</div></section>
  </div>;
}

function Metric({ label, value, ok, icon: Icon }: { label: string; value: string; ok: boolean; icon: typeof Heart }) {
  return <div className={`card border-l-4 ${ok ? 'border-l-emerald-500' : 'border-l-red-500'}`}><div className="flex items-center gap-3"><span className={`rounded-lg p-2.5 ${ok ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs text-gray-500">{label}</p><p className="font-bold">{value}</p></div></div></div>;
}
