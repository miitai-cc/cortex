import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Database,
  Brain,
  FileText,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Zap,
  Server,
  Gauge,
  Shield,
  Timer,
  BarChart3,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts';
import { healthApi } from '../services/api';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

const mockResourceHistory = [
  { time: '00:00', cpu: 35, memory: 62, disk: 45 },
  { time: '04:00', cpu: 28, memory: 61, disk: 45 },
  { time: '08:00', cpu: 65, memory: 68, disk: 46 },
  { time: '12:00', cpu: 82, memory: 75, disk: 47 },
  { time: '16:00', cpu: 71, memory: 72, disk: 47 },
  { time: '20:00', cpu: 45, memory: 65, disk: 48 },
  { time: '現在', cpu: 38, memory: 63, disk: 48 },
];

const mockApiLatency = [
  { time: '00:00', latency: 45, p99: 120 },
  { time: '04:00', latency: 38, p99: 95 },
  { time: '08:00', latency: 82, p99: 210 },
  { time: '12:00', latency: 110, p99: 340 },
  { time: '16:00', latency: 75, p99: 180 },
  { time: '20:00', latency: 52, p99: 130 },
  { time: '現在', latency: 42, p99: 105 },
];

const mockErrorRate = [
  { time: '00:00', errors: 0, requests: 120 },
  { time: '04:00', errors: 0, requests: 85 },
  { time: '08:00', errors: 2, requests: 310 },
  { time: '12:00', errors: 5, requests: 480 },
  { time: '16:00', errors: 1, requests: 350 },
  { time: '20:00', errors: 0, requests: 180 },
  { time: '現在', errors: 0, requests: 140 },
];

const mockQueueJobs = [
  { id: '1', type: '文件索引', target: 'report_2024.pdf', status: 'processing', progress: 65, started: '2 分鐘前' },
  { id: '2', type: '向量化', target: 'dataset_v3.xlsx', status: 'queued', progress: 0, started: '等待中' },
  { id: '3', type: '圖譜更新', target: '新增 12 個節點', status: 'processing', progress: 88, started: '1 分鐘前' },
  { id: '4', type: '文件索引', target: 'notes.md', status: 'completed', progress: 100, started: '5 分鐘前' },
];

const mockAlerts = [
  { id: '1', level: 'warning', message: 'LLM 服務回應時間超過閾值 (>2s)', time: '12:34', resolved: false },
  { id: '2', level: 'info', message: '向量資料庫索引重建完成', time: '11:20', resolved: true },
  { id: '3', level: 'error', message: '文件處理佇列積壓超過 50 筆', time: '10:05', resolved: true },
  { id: '4', level: 'info', message: '系統自動備份完成', time: '08:00', resolved: true },
];

const services = [
  {
    name: 'API 服務',
    icon: Server,
    status: 'healthy',
    latency: '42ms',
    uptime: '99.98%',
    lastCheck: '3 秒前',
    version: 'v0.85',
    details: 'REST API + SSE Streaming',
  },
  {
    name: '向量資料庫',
    icon: Database,
    status: 'healthy',
    latency: '12ms',
    uptime: '99.99%',
    lastCheck: '5 秒前',
    version: 'Qdrant v1.9',
    details: '3 collections, 12,847 vectors',
  },
  {
    name: 'LLM 服務',
    icon: Brain,
    status: 'warning',
    latency: '1.2s',
    uptime: '99.85%',
    lastCheck: '8 秒前',
    version: 'GPT-4o',
    details: '平均 Token: 1,240/req',
  },
  {
    name: '文件處理',
    icon: FileText,
    status: 'healthy',
    latency: '—',
    uptime: '99.95%',
    lastCheck: '10 秒前',
    version: 'v2.1',
    details: '佇列: 2 筆處理中, 1 筆等待',
  },
  {
    name: '嵌入模型',
    icon: Zap,
    status: 'healthy',
    latency: '28ms',
    uptime: '99.97%',
    lastCheck: '6 秒前',
    version: 'text-embedding-3-small',
    details: '1536 dimensions',
  },
  {
    name: '快取服務',
    icon: Gauge,
    status: 'healthy',
    latency: '3ms',
    uptime: '99.99%',
    lastCheck: '2 秒前',
    version: 'Redis 7.2',
    details: '命中率: 87.3%, 256MB/512MB',
  },
];

const resourceGauges = [
  { name: 'CPU', value: 38, fill: '#3b82f6', icon: Cpu, unit: '%', cores: '8 核心' },
  { name: '記憶體', value: 63, fill: '#8b5cf6', icon: MemoryStick, unit: '%', detail: '10.1GB / 16GB' },
  { name: '磁碟', value: 48, fill: '#10b981', icon: HardDrive, unit: '%', detail: '240GB / 500GB' },
];

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  healthy: { color: 'text-green-600', bg: 'bg-green-50', label: '正常' },
  warning: { color: 'text-amber-600', bg: 'bg-amber-50', label: '警告' },
  error: { color: 'text-red-600', bg: 'bg-red-50', label: '異常' },
  degraded: { color: 'text-orange-600', bg: 'bg-orange-50', label: '降級' },
};

const jobStatusConfig: Record<string, { color: string; bg: string }> = {
  processing: { color: 'text-blue-600', bg: 'bg-blue-50' },
  queued: { color: 'text-gray-500', bg: 'bg-gray-50' },
  completed: { color: 'text-green-600', bg: 'bg-green-50' },
  failed: { color: 'text-red-600', bg: 'bg-red-50' },
};

export default function DashboardHealthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check(),
    refetchInterval: 10000,
  });

  const status = health?.data?.status ?? 'unknown';
  const isHealthy = status === 'ok' || status === 'healthy';

  const currentCpu = mockResourceHistory[mockResourceHistory.length - 1].cpu;
  const currentMemory = mockResourceHistory[mockResourceHistory.length - 1].memory;
  const currentLatency = mockApiLatency[mockApiLatency.length - 1].latency;
  const totalRequests = mockErrorRate.reduce((s, d) => s + d.requests, 0);
  const totalErrors = mockErrorRate.reduce((s, d) => s + d.errors, 0);
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : '0';

  return (
    <div className="space-y-6">
      <CommonHeroTitle
        icon={Heart}
        title={t('nav.dashboard.health')}
        description="即時監控系統運行狀態與效能指標"
        extraButtons={[
          { label: '重新整理', icon: RefreshCw, onClick: () => refetch() },
        ]}
      />

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={`card border-l-4 ${isHealthy ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${isHealthy ? 'bg-green-50' : 'bg-red-50'}`}>
              {isHealthy ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <p className="text-xs text-gray-500">系統狀態</p>
              <p className="text-base font-bold">{isLoading ? '—' : isHealthy ? '正常運行' : '異常'}</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50">
              <Timer className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">API 延遲</p>
              <p className="text-base font-bold">{currentLatency}ms</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">錯誤率</p>
              <p className="text-base font-bold">{errorRate}%</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-l-green-500">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">運行時間</p>
              <p className="text-base font-bold">99.97%</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50">
              <Activity className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">總請求數</p>
              <p className="text-base font-bold">{totalRequests.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {resourceGauges.map((gauge) => {
            const Icon = gauge.icon;
            return (
              <div key={gauge.name} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: gauge.fill }} />
                    <span className="text-sm font-medium text-gray-700">{gauge.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{gauge.cores || gauge.detail}</span>
                </div>
                <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${gauge.value}%`,
                      background: gauge.fill,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{gauge.value}%</span>
                  <span className="text-xs text-gray-400">{gauge.value > 80 ? '高' : gauge.value > 60 ? '中' : '低'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resource History Chart */}
        <div className="lg:col-span-3 card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">資源使用趨勢（24 小時）</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={mockResourceHistory}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fill="url(#cpuGrad)" name="CPU %" />
              <Area type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} fill="url(#memGrad)" name="記憶體 %" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-500">CPU</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-xs text-gray-500">記憶體</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Latency & Error Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">API 回應時間趨勢</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mockApiLatency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit="ms" />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Line type="monotone" dataKey="latency" stroke="#10b981" strokeWidth={2} dot={false} name="平均延遲" />
              <Line type="monotone" dataKey="p99" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" name="P99 延遲" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-500">平均延遲 ({currentLatency}ms)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-500">P99 ({mockApiLatency[mockApiLatency.length - 1].p99}ms)</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">請求量與錯誤率</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockErrorRate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Bar dataKey="requests" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="總請求" />
              <Bar dataKey="errors" fill="#ef4444" radius={[3, 3, 0, 0]} name="錯誤數" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-500">總請求 ({totalRequests})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-gray-500">錯誤 ({totalErrors})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">服務健康狀態</h3>
          <span className="text-xs text-gray-400">每 10 秒自動更新</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((svc) => {
            const cfg = statusConfig[svc.status] || statusConfig.healthy;
            const SvcIcon = svc.icon;
            return (
              <div key={svc.name} className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                svc.status === 'healthy' ? 'border-green-200 bg-green-50/30' :
                svc.status === 'warning' ? 'border-amber-200 bg-amber-50/30' :
                'border-red-200 bg-red-50/30'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${cfg.bg}`}>
                    <SvcIcon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{svc.name}</p>
                    <p className="text-xs text-gray-400">{svc.version}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{svc.details}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>延遲: {svc.latency}</span>
                  <span>可用率: {svc.uptime}</span>
                  <span className="ml-auto">{svc.lastCheck}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Processing Queue & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing Queue */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">處理佇列</h3>
            <span className="text-xs text-gray-400">{mockQueueJobs.filter(j => j.status !== 'completed').length} 筆進行中</span>
          </div>
          <div className="space-y-3">
            {mockQueueJobs.map((job) => {
              const jCfg = jobStatusConfig[job.status] || jobStatusConfig.queued;
              return (
                <div key={job.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${jCfg.bg} ${jCfg.color}`}>
                        {job.type}
                      </span>
                      <span className="text-sm text-gray-700 truncate">{job.target}</span>
                    </div>
                    <span className="text-xs text-gray-400">{job.started}</span>
                  </div>
                  {job.status === 'processing' && (
                    <div className="relative w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">最近告警</h3>
            <span className="text-xs text-gray-400">
              {mockAlerts.filter(a => !a.resolved).length} 個未解決
            </span>
          </div>
          <div className="space-y-2">
            {mockAlerts.map((alert) => {
              const alertColors: Record<string, { icon: typeof AlertCircle; color: string; bg: string; border: string }> = {
                error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                warning: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
                info: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
              };
              const aCfg = alertColors[alert.level] || alertColors.info;
              const AlertIcon = aCfg.icon;
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${aCfg.border} ${
                    alert.resolved ? 'opacity-60' : ''
                  }`}
                >
                  <AlertIcon className={`w-4 h-4 mt-0.5 shrink-0 ${aCfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{alert.time}</span>
                      {alert.resolved && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> 已解決
                        </span>
                      )}
                      {!alert.resolved && (
                        <span className="text-xs text-red-500 font-medium">未解決</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
