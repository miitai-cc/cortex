import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Layers,
  Search,
  Activity,
  LayoutDashboard,
  MessageSquare,
  Share2,
  FlaskConical,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
  Database,
  Brain,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { healthApi, documentApi, graphApi, dashboardApi } from '../services/api';
import { useChatStore } from '../stores/chatStore';
import { useResearchStore } from '../stores/researchStore';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

const DOC_TYPE_COLORS: Record<string, string> = {
  pdf: '#ef4444',
  docx: '#3b82f6',
  xlsx: '#10b981',
  txt: '#8b5cf6',
  md: '#f59e0b',
  other: '#6b7280',
};

const STATUS_COLORS: Record<string, string> = {
  indexed: '#10b981',
  processing: '#f59e0b',
  pending: '#6b7280',
  failed: '#ef4444',
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check(),
    refetchInterval: 30000,
  });

  const { data: docsData } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentApi.list(),
  });

  const { data: graphData } = useQuery({
    queryKey: ['graphData'],
    queryFn: () => graphApi.getData(),
  });

  const { conversations } = useChatStore();
  const { tasks } = useResearchStore();

  const documents = docsData?.data?.data ?? docsData?.data ?? [];
  const nodes = graphData?.data?.nodes ?? [];
  const edges = graphData?.data?.edges ?? [];

  const totalDocs = Array.isArray(documents) ? documents.length : 0;
  const totalChunks = Array.isArray(documents)
    ? documents.reduce((sum: number, d: any) => sum + (d.chunk_count ?? 0), 0)
    : 0;

  const docTypeMap: Record<string, number> = {};
  const docStatusMap: Record<string, number> = {};
  if (Array.isArray(documents)) {
    documents.forEach((d: any) => {
      const ext = (d.file_type ?? 'other').split('/').pop()?.split('.').pop() ?? 'other';
      const typeKey = ext.toLowerCase();
      docTypeMap[typeKey] = (docTypeMap[typeKey] || 0) + 1;
      const status = d.status ?? 'pending';
      docStatusMap[status] = (docStatusMap[status] || 0) + 1;
    });
  }

  const docTypeData = Object.entries(docTypeMap).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
    color: DOC_TYPE_COLORS[name] || DOC_TYPE_COLORS.other,
  }));

  const docStatusData = Object.entries(docStatusMap).map(([name, value]) => ({
    name: t(`documents.status.${name}`, name),
    value,
    fill: STATUS_COLORS[name] || '#6b7280',
  }));

  const mockQueryTrend = [
    { day: '週一', queries: 12 },
    { day: '週二', queries: 19 },
    { day: '週三', queries: 8 },
    { day: '週四', queries: 25 },
    { day: '週五', queries: 32 },
    { day: '週六', queries: 15 },
    { day: '週日', queries: 22 },
  ];

  const mockActivity = [
    { id: '1', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', action: '上傳文件', target: 'research_paper.pdf', time: '5 分鐘前' },
    { id: '2', icon: Search, color: 'text-purple-600', bg: 'bg-purple-50', action: '執行檢索', target: '機器學習模型比較', time: '12 分鐘前' },
    { id: '3', icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50', action: '建立對話', target: '文件摘要分析', time: '30 分鐘前' },
    { id: '4', icon: FlaskConical, color: 'text-orange-600', bg: 'bg-orange-50', action: '深層研究', target: 'Transformer 架構演進', time: '1 小時前' },
  ];

  const kpis = [
    {
      key: 'totalDocuments',
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      value: totalDocs,
      trend: '+12%',
      trendUp: true,
    },
    {
      key: 'totalChunks',
      icon: Layers,
      color: 'text-green-600',
      bg: 'bg-green-50',
      value: totalChunks,
      trend: '+8%',
      trendUp: true,
    },
    {
      key: 'recentQueries',
      icon: Search,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      value: conversations.length,
      trend: '+23%',
      trendUp: true,
    },
    {
      key: 'systemHealth',
      icon: Activity,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      value: health?.data?.status ?? '—',
      trend: '99.9%',
      trendUp: true,
    },
  ];

  return (
    <div className="space-y-6">
      <CommonHeroTitle icon={LayoutDashboard} title={t('dashboard.title')} description="系統運行概覽與關鍵指標" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t(`dashboard.${kpi.key}`)}</p>
                <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{kpi.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">{kpi.trend}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">較上週</span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Trend */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">查詢趨勢</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">近 7 天</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={mockQueryTrend}>
              <defs>
                <linearGradient id="queryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="queries"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#queryGradient)"
                name="查詢次數"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Document Type Distribution */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">文件類型分佈</h3>
          {docTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={docTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {docTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[240px] text-gray-400 dark:text-gray-500 text-sm">
              暫無文件資料
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {docTypeData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.name}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Status */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">文件處理狀態</h3>
          {docStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={docStatusData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={60} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                  {docStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-400 dark:text-gray-500 text-sm">
              暫無資料
            </div>
          )}
        </div>

        {/* Knowledge Graph Overview */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">知識圖譜概覽</h3>
            <button
              onClick={() => navigate('/cortex/graph')}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">節點數</span>
              </div>
              <span className="text-lg font-bold text-indigo-600">{nodes.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">邊數</span>
              </div>
              <span className="text-lg font-bold text-pink-600">{edges.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">密度</span>
              </div>
              <span className="text-lg font-bold text-teal-600">
                {nodes.length > 1
                  ? ((edges.length / (nodes.length * (nodes.length - 1) / 2)) * 100).toFixed(1) + '%'
                  : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">系統狀態</h3>
            <button
              onClick={() => navigate('/cortex/dashboard/health')}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              詳情 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { name: 'API 服務', ok: true },
              { name: '向量資料庫', ok: true },
              { name: 'LLM 服務', ok: true },
              { name: '文件處理', ok: true },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">{s.name}</span>
                <span className={`flex items-center gap-1 text-xs font-medium ${s.ok ? 'text-green-600' : 'text-red-500'}`}>
                  {s.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {s.ok ? '正常' : '異常'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">最近活動</h3>
            <button
              onClick={() => navigate('/cortex/dashboard/activity')}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              全部 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {mockActivity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className={`p-2 rounded-lg ${item.bg} dark:bg-opacity-20 shrink-0`}>
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{item.action}</span>
                      <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                      <span className="text-gray-500 dark:text-gray-400 truncate">{item.target}</span>
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.time}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">快速統計</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/cortex/chat')}
              className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl hover:shadow-md transition-all text-left"
            >
              <div className="p-2.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{conversations.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">對話數</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/cortex/research')}
              className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl hover:shadow-md transition-all text-left"
            >
              <div className="p-2.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <FlaskConical className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tasks.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">研究任務</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/cortex')}
              className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl hover:shadow-md transition-all text-left"
            >
              <div className="p-2.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalChunks}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">文本區塊</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/cortex/graph')}
              className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl hover:shadow-md transition-all text-left"
            >
              <div className="p-2.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <Share2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{nodes.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">圖譜節點</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
