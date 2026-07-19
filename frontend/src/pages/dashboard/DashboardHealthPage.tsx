import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Activity, AlertCircle, CheckCircle2, Clock3, Database, FileText, Heart, RefreshCw, Server, Settings2, Zap } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { dashboardApi } from '../../services/api';

const serviceIcons: Record<string, typeof Server> = { api: Server, database: Database, qdrant: Zap, documents: FileText, embedding: Settings2, llm: Settings2 };
const statusStyle: Record<string, { labelKey: string; color: string; bg: string; border: string }> = {
  healthy: { labelKey: 'dashboard.serviceStatus.healthy', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
  warning: { labelKey: 'dashboard.serviceStatus.warning', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
  error: { labelKey: 'dashboard.serviceStatus.error', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  configured: { labelKey: 'dashboard.health.configuredProbed', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  unconfigured: { labelKey: 'dashboard.health.unconfigured', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-700', border: 'border-gray-200 dark:border-gray-600' },
};

function formatTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}

export default function DashboardHealthPage() {
  const { t } = useTranslation();
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({ queryKey: ['dashboard-health'], queryFn: dashboardApi.health, refetchInterval: 10000 });
  const model = data?.data ?? { status: 'unknown', database: false, qdrant: false, services: [], queue: [], alerts: [], metrics: {}, querySamples: [] };
  const metrics = model.metrics ?? {};
  const samples = (model.querySamples ?? []).slice().reverse().map((sample: any) => ({ ...sample, time: formatTime(sample.timestamp).split(' ')[1] ?? formatTime(sample.timestamp) }));
  return <div className="mx-auto max-w-11xl px-4 pb-10">
    <CommonHeroTitle icon={Heart} title={t('dashboard.health.title')} description={t('dashboard.health.description')} extraButtons={[{ label: t('dashboard.health.refresh'), icon: RefreshCw, onClick: () => refetch() }]} />
    <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Metric labelKey="dashboard.health.overallStatus" value={isLoading ? t('dashboard.health.checking') : model.status === 'healthy' ? t('dashboard.health.healthy') : t('dashboard.health.degraded')} ok={model.status === 'healthy'} icon={Heart} />
      <Metric labelKey="dashboard.health.database" value={model.database ? t('dashboard.health.connected') : t('dashboard.health.disconnected')} ok={model.database} icon={Database} />
      <Metric labelKey="dashboard.health.vectorDatabase" value={model.qdrant ? t('dashboard.health.connected') : t('dashboard.health.disconnected')} ok={model.qdrant} icon={Zap} />
      <Metric labelKey="dashboard.health.indexQueue" value={t('dashboard.health.items', { count: metrics.pendingDocuments ?? 0 })} ok={(metrics.pendingDocuments ?? 0) === 0} icon={Activity} />
      <Metric labelKey="dashboard.health.indexFailed" value={t('dashboard.health.items', { count: metrics.failedDocuments ?? 0 })} ok={(metrics.failedDocuments ?? 0) === 0} icon={AlertCircle} />
    </div>

    <section className="card mb-6"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{t('dashboard.health.serviceProbeTitle')}</h2><span className="text-xs text-gray-400">{t('dashboard.health.updateInterval')} · {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('zh-TW') : '—'}</span></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{model.services.map((service: any) => {
      const config = statusStyle[service.status] ?? statusStyle.unconfigured;
      const Icon = serviceIcons[service.id] ?? Server;
      return <article key={service.id} className={`rounded-xl border p-4 ${config.border}`}><div className="flex items-center gap-3"><span className={`rounded-lg p-2 ${config.bg}`}><Icon className={`h-5 w-5 ${config.color}`} /></span><div className="min-w-0 flex-1"><h3 className="font-medium">{service.name}</h3><p className="truncate text-xs text-gray-400">{service.details}</p></div><span className={`rounded-full px-2 py-1 text-[11px] ${config.bg} ${config.color}`}>{t(config.labelKey)}</span></div><p className="mt-3 text-xs text-gray-500">{service.latencyMs == null ? t('dashboard.health.noLatencyProbe') : t('dashboard.health.latencyResult', { latency: service.latencyMs })}</p></article>;
    })}</div></section>

    <div className="mb-6 grid gap-6 lg:grid-cols-2">
      <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{t('dashboard.health.queryLatencyTitle')}</h2><span className="text-xs text-gray-400">{t('dashboard.health.queryLatencySummary', { count: metrics.completedQueries ?? 0, avg: metrics.averageQueryLatencyMs ?? 0 })}</span></div>{samples.length ? <ResponsiveContainer width="100%" height={230}><LineChart data={samples}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="time" tick={{ fontSize: 10 }} /><YAxis unit="ms" tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="durationMs" name={t('dashboard.health.fullRagLatency')} stroke="#8b5cf6" strokeWidth={2} /></LineChart></ResponsiveContainer> : <div className="flex h-[230px] items-center justify-center text-sm text-gray-400">{t('dashboard.health.noQuerySamples')}</div>}</section>
      <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{t('dashboard.health.documentQueueTitle')}</h2><span className="text-xs text-gray-400">{t('dashboard.health.items', { count: model.queue.length })}</span></div><div className="max-h-[230px] space-y-2 overflow-auto">{model.queue.map((job: any) => <div key={job.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"><Clock3 className="h-4 w-4 text-amber-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{job.target}</p><p className="text-xs text-gray-400">{job.type} · {job.status}</p></div><span className="text-xs text-gray-400">{formatTime(job.updatedAt)}</span></div>)}{!model.queue.length && <div className="flex h-[190px] items-center justify-center text-sm text-emerald-600"><CheckCircle2 className="mr-2 h-5 w-5" />{t('dashboard.health.noPendingDocs')}</div>}</div></section>
    </div>
    <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{t('dashboard.health.alertsTitle')}</h2><span className="text-xs text-gray-400">{t('dashboard.health.items', { count: model.alerts.length })}</span></div><div className="space-y-2">{model.alerts.map((alert: any) => <div key={alert.id} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"><AlertCircle className="mt-0.5 h-4 w-4 text-red-600" /><div><p className="text-sm text-red-700 dark:text-red-300">{alert.message}</p><p className="text-xs text-red-400">{formatTime(alert.timestamp)}</p></div></div>)}{!model.alerts.length && <div className="py-8 text-center text-sm text-emerald-600"><CheckCircle2 className="mx-auto mb-2 h-6 w-6" />{t('dashboard.health.noAlerts')}</div>}</div></section>
  </div>;
}

function Metric({ labelKey, value, ok, icon: Icon }: { labelKey: string; value: string; ok: boolean; icon: typeof Heart }) {
  const { t } = useTranslation();
  return <div className={`card border-l-4 ${ok ? 'border-l-emerald-500' : 'border-l-red-500'}`}><div className="flex items-center gap-3"><span className={`rounded-lg p-2.5 ${ok ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs text-gray-500">{t(labelKey)}</p><p className="font-bold">{value}</p></div></div></div>;
}
