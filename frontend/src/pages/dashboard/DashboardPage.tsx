import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Search,
  Share2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { dashboardApi, graphApi, systemSettingsApi } from '../../services/api';

const typeColors: Record<string, string> = { pdf: '#ef4444', docx: '#3b82f6', xlsx: '#10b981', pptx: '#f97316', txt: '#8b5cf6', md: '#f59e0b', other: '#6b7280' };
const statusColors: Record<string, string> = { indexed: '#10b981', processing: '#f59e0b', pending: '#6b7280', failed: '#ef4444' };
const activityIcons: Record<string, typeof FileText> = { document: FileText, content: Layers, query: Search, message: MessageSquare, issue: ClipboardList, research: FlaskConical, conversation: MessageSquare };

function time(value?: string) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statsQuery = useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.stats });
  const trendQuery = useQuery({ queryKey: ['dashboard-query-trend'], queryFn: dashboardApi.queryTrend });
  const activityQuery = useQuery({ queryKey: ['dashboard-activity'], queryFn: dashboardApi.activity });
  const healthQuery = useQuery({ queryKey: ['dashboard-health'], queryFn: dashboardApi.health, refetchInterval: 30000 });
  const graphQuery = useQuery({ queryKey: ['graphData'], queryFn: graphApi.getData });
  const settingsQuery = useQuery({ queryKey: ['system-settings'], queryFn: systemSettingsApi.get });
  const stats = statsQuery.data?.data ?? { totalDocuments: 0, totalChunks: 0, totalQueries: 0, issues: 0, messages: 0, conversations: 0, researches: 0, documentTypes: [], documentStatuses: [] };
  const health = healthQuery.data?.data ?? { status: 'unknown', services: [] };
  const trend = trendQuery.data?.data?.trend ?? [];
  const activities = (activityQuery.data?.data?.activities ?? []).slice(0, 8);
  const nodes = graphQuery.data?.data?.nodes ?? [];
  const edges = graphQuery.data?.data?.edges ?? [];
  const documentTypes = stats.documentTypes.map((item: any) => ({ ...item, name: item.name.toUpperCase(), color: typeColors[item.name] ?? typeColors.other }));
  const documentStatuses = stats.documentStatuses.map((item: any) => ({ ...item, fill: statusColors[item.name] ?? statusColors.pending }));
  const indexedCount = documentStatuses.find((item: any) => item.name === 'indexed')?.value ?? 0;
  const kpis = [
    { labelKey: 'dashboard.kpi.totalDocuments', value: stats.totalDocuments, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', detail: t('dashboard.kpi.documentsIndexed', { count: indexedCount }) },
    { labelKey: 'dashboard.kpi.totalChunks', value: stats.totalChunks, icon: Layers, color: 'text-emerald-600', bg: 'bg-emerald-50', detail: t('dashboard.kpi.chunksDetail') },
    { labelKey: 'dashboard.kpi.totalQueries', value: stats.totalQueries, icon: Search, color: 'text-violet-600', bg: 'bg-violet-50', detail: t('dashboard.kpi.queriesDetail') },
    { labelKey: 'dashboard.kpi.issues', value: stats.issues, icon: ClipboardList, color: 'text-orange-600', bg: 'bg-orange-50', detail: t('dashboard.kpi.issuesDetail', { count: stats.messages }) },
  ];
  return <div className="mx-auto max-w-11xl space-y-6 px-4 pb-10">
    <CommonHeroTitle icon={LayoutDashboard} title={t('dashboard.overviewTitle')} description={t('dashboard.overviewDescription')} onRefresh={() => { statsQuery.refetch(); trendQuery.refetch(); activityQuery.refetch(); healthQuery.refetch(); graphQuery.refetch(); }} />
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{kpis.map((item) => <div key={item.labelKey} className="card flex items-center gap-4"><span className={`rounded-xl p-3 ${item.bg} dark:bg-opacity-20`}><item.icon className={`h-6 w-6 ${item.color}`} /></span><div><p className="text-xs uppercase tracking-wider text-gray-500">{t(item.labelKey)}</p><p className="text-2xl font-bold">{item.value}</p><p className="text-xs text-gray-400">{item.detail}</p></div></div>)}</div>

    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card lg:col-span-2"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{t('dashboard.queryTrend')}</h2><span className="text-xs text-gray-400">{t('dashboard.queryTrendPeriod')}</span></div><ResponsiveContainer width="100%" height={250}><AreaChart data={trend}><defs><linearGradient id="realQueryGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="queries" name={t('dashboard.queryTrend')} stroke="#8b5cf6" strokeWidth={2} fill="url(#realQueryGradient)" /></AreaChart></ResponsiveContainer></section>
      <section className="card"><h2 className="mb-4 font-semibold">{t('dashboard.documentTypes')}</h2>{documentTypes.length ? <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={documentTypes} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={3}>{documentTypes.map((item: any) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="flex h-[210px] items-center justify-center text-sm text-gray-400">{t('dashboard.noDocuments')}</div>}<div className="flex flex-wrap justify-center gap-3">{documentTypes.map((item: any) => <span key={item.name} className="flex items-center gap-1 text-xs text-gray-500"><i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.name} {item.value}</span>)}</div></section>
    </div>

    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card"><h2 className="mb-4 font-semibold">{t('dashboard.documentIndexStatus')}</h2>{documentStatuses.length ? <ResponsiveContainer width="100%" height={210}><BarChart data={documentStatuses} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name={t('dashboard.documentIndexStatus')} radius={[0, 4, 4, 0]}>{documentStatuses.map((item: any) => <Cell key={item.name} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer> : <div className="flex h-[210px] items-center justify-center text-sm text-gray-400">{t('dashboard.noDocuments')}</div>}</section>
      <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{t('dashboard.knowledgeGraph')}</h2><button className="flex items-center gap-1 text-xs text-primary-600" onClick={() => navigate('/cortex/graph')}>{t('dashboard.knowledgeGraph.view')} <ArrowRight className="h-3 w-3" /></button></div><div className="space-y-3"><Summary labelKey="dashboard.knowledgeGraph.nodes" value={nodes.length} icon={Share2} /><Summary labelKey="dashboard.knowledgeGraph.edges" value={edges.length} icon={Activity} /><Summary labelKey="dashboard.knowledgeGraph.density" value={nodes.length > 1 ? `${((edges.length / (nodes.length * (nodes.length - 1) / 2)) * 100).toFixed(1)}%` : '0%'} icon={Layers} /></div></section>
      <section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{t('dashboard.serviceStatus')}</h2><button className="flex items-center gap-1 text-xs text-primary-600" onClick={() => navigate('/cortex/dashboard/health')}>{t('dashboard.serviceStatus.details')} <ArrowRight className="h-3 w-3" /></button></div><div className="space-y-2">{health.services.slice(0, 5).map((service: any) => { const ok = service.status === 'healthy' || service.status === 'configured'; const statusKey = service.status === 'configured' ? 'dashboard.serviceStatus.configured' : ok ? 'dashboard.serviceStatus.healthy' : service.status === 'warning' ? 'dashboard.serviceStatus.warning' : 'dashboard.serviceStatus.error'; return <div key={service.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"><span className="text-sm">{service.name}</span><span className={`ml-auto flex items-center gap-1 text-xs ${ok ? 'text-emerald-600' : service.status === 'warning' ? 'text-amber-600' : 'text-red-500'}`}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}{t(statusKey)}</span></div>; })}</div></section>
    </div>

    <div className="grid gap-6 lg:grid-cols-2"><section className="card"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{t('dashboard.recentActivity')}</h2><button className="flex items-center gap-1 text-xs text-primary-600" onClick={() => navigate('/cortex/dashboard/activity')}>{t('dashboard.recentActivity.viewAll')} <ArrowRight className="h-3 w-3" /></button></div><div className="space-y-1">{activities.map((item: any) => { const Icon = activityIcons[item.kind] ?? Activity; return <button key={item.id} onClick={() => item.path && navigate(item.path)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"><span className="rounded-lg bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/20"><Icon className="h-4 w-4" /></span><p className="min-w-0 flex-1 truncate text-sm"><strong>{item.action}</strong> · {item.target}</p><span className="flex shrink-0 items-center gap-1 text-[11px] text-gray-400"><Clock className="h-3 w-3" />{time(item.timestamp)}</span></button>; })}{!activities.length && <p className="py-10 text-center text-sm text-gray-400">{t('dashboard.noActivity')}</p>}</div></section>
      <section className="card flex flex-col"><h2 className="mb-4 font-semibold">{t('dashboard.quickEntries')}</h2><div className="grid grid-cols-2 gap-3 mb-6"><Quick labelKey="dashboard.quickEntries.teamMessages" value={stats.messages} icon={MessageSquare} onClick={() => navigate('/cortex/collaboration/channels')} /><Quick labelKey="dashboard.quickEntries.issues" value={stats.issues} icon={ClipboardList} onClick={() => navigate('/cortex/collaboration/issues')} /><Quick labelKey="dashboard.quickEntries.smartChat" value={stats.conversations} icon={MessageSquare} onClick={() => navigate('/cortex/chat/history')} /><Quick labelKey="dashboard.quickEntries.researchTasks" value={stats.researches} icon={FlaskConical} onClick={() => navigate('/cortex/graph/history')} /></div></section>
    </div>
  </div>;
}

function Summary({ labelKey, value, icon: Icon }: { labelKey: string; value: number | string; icon: typeof Share2 }) {
  const { t } = useTranslation();
  return <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"><Icon className="h-4 w-4 text-primary-600" /><span className="text-sm text-gray-600 dark:text-gray-300">{t(labelKey)}</span><strong className="ml-auto text-lg">{value}</strong></div>;
}
function Quick({ labelKey, value, icon: Icon, onClick }: { labelKey: string; value: number; icon: typeof MessageSquare; onClick: () => void }) {
  const { t } = useTranslation();
  return <button onClick={onClick} className="rounded-xl bg-gradient-to-br from-primary-50 to-indigo-50 p-4 text-left transition hover:shadow-md dark:from-gray-800 dark:to-gray-700"><Icon className="h-5 w-5 text-primary-600" /><p className="mt-2 text-2xl font-bold">{value}</p><p className="text-xs text-gray-500 dark:text-gray-300">{t(labelKey)}</p></button>;
}
