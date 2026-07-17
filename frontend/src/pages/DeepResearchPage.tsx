import { useState, useEffect } from 'react';
import { useResearchStore, ResearchTask } from '../stores/researchStore';
import { researchApi } from '../services/api';
import {
  FlaskConical,
  Loader2,
  Search,
  FileText,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

const STATUS_ICONS: Record<string, typeof Loader2> = {
  queued: Loader2,
  searching: Search,
  synthesizing: FileText,
  completed: CheckCircle2,
  error: AlertCircle,
};

const STATUS_LABELS: Record<string, string> = {
  queued: '佇列中',
  searching: '搜尋中',
  synthesizing: '綜合分析中',
  completed: '完成',
  error: '錯誤',
};

const STATUS_COLORS: Record<string, string> = {
  queued: 'text-gray-400',
  searching: 'text-blue-500',
  synthesizing: 'text-purple-500',
  completed: 'text-green-500',
  error: 'text-red-500',
};

export default function DeepResearchPage() {
  const { tasks, addTask, updateTask, removeTask } = useResearchStore();
  const [topic, setTopic] = useState('');
  const [queriesText, setQueriesText] = useState('');
  const [running, setRunning] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, string>>(new Map());

  const handleStart = async () => {
    if (!topic.trim()) return;
    const queries = queriesText
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);

    const taskId = addTask(topic, queries.length > 0 ? queries : [topic]);
    setRunning(true);

    updateTask(taskId, { status: 'searching' });

    try {
      const res = await researchApi.start({
        topic,
        queries: queries.length > 0 ? queries : [topic],
      });

      updateTask(taskId, { status: 'completed', synthesis: res.data.synthesis, results: res.data.sources });
      setResults((prev) => new Map(prev).set(taskId, res.data.synthesis));
      setExpandedTasks((prev) => new Set(prev).add(taskId));
    } catch {
      updateTask(taskId, { status: 'error' });
    } finally {
      setRunning(false);
      setTopic('');
      setQueriesText('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-200 bg-white">
        <CommonHeroTitle icon={FlaskConical} title="深層研究" description="自動化網路搜尋與綜合分析，擴展知識邊界" />
        <div className="space-y-3">
          <input
            type="text"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="輸入研究主題..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleStart()}
          />
          <textarea
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
            placeholder="搜尋查詢（每行一組，留空則自動生成）"
            rows={3}
            value={queriesText}
            onChange={(e) => setQueriesText(e.target.value)}
          />
          <button
            onClick={handleStart}
            disabled={!topic.trim() || running}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {running ? '研究中...' : '開始研究'}
          </button>
        </div>
      </div>

      {/* Tasks timeline */}
      <div className="flex-1 overflow-auto p-6">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FlaskConical className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">尚無研究任務</p>
            <p className="text-sm">輸入主題後點擊「開始研究」</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {tasks.map((task) => {
              const StatusIcon = STATUS_ICONS[task.status] || Loader2;
              const isExpanded = expandedTasks.has(task.id);
              const synthesis = results.get(task.id) || task.synthesis;

              return (
                <div
                  key={task.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setExpandedTasks((prev) => {
                        const next = new Set(prev);
                        if (next.has(task.id)) next.delete(task.id);
                        else next.add(task.id);
                        return next;
                      });
                    }}
                  >
                    <StatusIcon className={`w-5 h-5 ${STATUS_COLORS[task.status]} ${
                      task.status === 'queued' || task.status === 'searching' || task.status === 'synthesizing'
                        ? 'animate-spin'
                        : ''
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{task.topic}</p>
                      <p className="text-xs text-gray-400">
                        {STATUS_LABELS[task.status]} · {task.queries.length} 個查詢
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      {task.results && task.results.length > 0 && (
                        <div className="mt-3 mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-2">搜尋結果</p>
                          {task.results.map((src, i) => (
                            <div key={i} className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded mb-1">
                              {src.length > 200 ? src.slice(0, 200) + '...' : src}
                            </div>
                          ))}
                        </div>
                      )}

                      {synthesis && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-500 mb-2">綜合分析</p>
                          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                            {synthesis}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
