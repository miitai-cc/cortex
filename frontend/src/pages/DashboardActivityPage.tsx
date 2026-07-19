import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ClipboardList, FileText, FlaskConical, MessageSquare, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import { dashboardApi } from '../services/api';

const kindConfig: Record<string, { label: string; icon: typeof Activity; color: string; bg: string }> = {
  document: { label: '文件', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  content: { label: '內容', icon: Sparkles, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  query: { label: '檢索', icon: Search, color: 'text-purple-600', bg: 'bg-purple-50' },
  message: { label: '協作訊息', icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  issue: { label: 'Issue', icon: ClipboardList, color: 'text-violet-600', bg: 'bg-violet-50' },
  research: { label: '研究', icon: FlaskConical, color: 'text-orange-600', bg: 'bg-orange-50' },
  conversation: { label: '對話', icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50' },
};

function time(value?: string) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}

export default function DashboardActivityPage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState('');
  const { data, isLoading, refetch } = useQuery({ queryKey: ['dashboard-activity'], queryFn: dashboardApi.activity });
  const activities = (data?.data?.activities ?? []).filter((item: any) => !kind || item.kind === kind);
  return <div className="mx-auto max-w-11xl px-4 pb-10">
    <CommonHeroTitle icon={Activity} title="最近活動" description="由文件、檢索、協作、Issue、研究與智慧對話的真實資料彙整" extraButtons={[{ label: '重新整理', icon: RefreshCw, onClick: () => refetch() }]} />
    <div className="card mb-4 flex flex-wrap items-center gap-2">
      <button onClick={() => setKind('')} className={`rounded-lg px-3 py-1.5 text-sm ${!kind ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>全部</button>
      {Object.entries(kindConfig).map(([value, config]) => <button key={value} onClick={() => setKind(value)} className={`rounded-lg px-3 py-1.5 text-sm ${kind === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{config.label}</button>)}
    </div>
    <div className="card">
      {isLoading ? <div className="py-16 text-center text-gray-400">載入活動…</div> : <div className="space-y-1">{activities.map((item: any) => {
        const config = kindConfig[item.kind] ?? { label: item.kind, icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' };
        const Icon = config.icon;
        return <button key={item.id} onClick={() => item.path && navigate(item.path)} className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className={`rounded-lg p-2 ${config.bg} dark:bg-opacity-20`}><Icon className={`h-4 w-4 ${config.color}`} /></div>
          <div className="min-w-0 flex-1"><p className="text-sm text-gray-700 dark:text-gray-200"><strong>{item.action}</strong><span className="mx-2 text-gray-300">·</span><span>{item.target}</span></p>{item.actor && <p className="text-xs text-gray-400">操作人：{item.actor}</p>}</div>
          <time className="shrink-0 text-xs text-gray-400">{time(item.timestamp)}</time>
        </button>;
      })}{!activities.length && <div className="py-16 text-center text-gray-400">尚無符合的活動</div>}</div>}
    </div>
  </div>;
}
