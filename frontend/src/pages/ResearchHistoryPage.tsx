import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, AlertCircle, Search, FileText, Loader2 } from 'lucide-react';
import { useResearchStore } from '../stores/researchStore';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

const STATUS_CONFIG: Record<string, { icon: typeof Loader2; label: string; color: string; bg: string }> = {
  queued: { icon: Loader2, label: '佇列', color: 'text-gray-400', bg: 'bg-gray-50' },
  searching: { icon: Search, label: '搜尋中', color: 'text-blue-500', bg: 'bg-blue-50' },
  synthesizing: { icon: FileText, label: '綜合分析中', color: 'text-purple-500', bg: 'bg-purple-50' },
  completed: { icon: CheckCircle2, label: '完成', color: 'text-green-500', bg: 'bg-green-50' },
  error: { icon: AlertCircle, label: '錯誤', color: 'text-red-500', bg: 'bg-red-50' },
};

export default function ResearchHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tasks, removeTask } = useResearchStore();

  const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <CommonHeroTitle icon={Clock} title={t('nav.graph.history')} description="檢視所有已完成的研究任務" />

      {sorted.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">尚無研究紀錄</p>
          <button
            onClick={() => navigate('/cortex/graph/research')}
            className="mt-4 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            開始研究
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((task) => {
            const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.queued;
            const Icon = cfg.icon;
            return (
              <div key={task.id} className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color} ${task.status === 'queued' || task.status === 'searching' || task.status === 'synthesizing'
                      ? 'animate-spin' : ''
                      }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.topic}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {cfg.label} · {task.queries.length} 個查詢 · {new Date(task.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
                  >
                    刪除
                  </button>
                </div>
                {task.synthesis && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-3 pl-11">{task.synthesis}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
