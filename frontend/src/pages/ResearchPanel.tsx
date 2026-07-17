import { useState } from 'react';
import { useResearchStore, ResearchTask } from '../stores/researchStore';
import { researchApi } from '../services/api';
import {
  Loader2,
  Search,
  FileText,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  PanelRightClose,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { icon: typeof Loader2; label: string; color: string }> = {
  queued: { icon: Loader2, label: '佇列', color: 'text-gray-400' },
  searching: { icon: Search, label: '搜尋', color: 'text-blue-500' },
  synthesizing: { icon: FileText, label: '綜合', color: 'text-purple-500' },
  completed: { icon: CheckCircle2, label: '完成', color: 'text-green-500' },
  error: { icon: AlertCircle, label: '錯誤', color: 'text-red-500' },
};

export default function ResearchPanel() {
  const { tasks, panelOpen, setPanelOpen, addTask, updateTask, removeTask } = useResearchStore();
  const [topic, setTopic] = useState('');
  const [running, setRunning] = useState(false);

  if (!panelOpen) return null;

  const handleStart = async () => {
    if (!topic.trim() || running) return;
    const taskId = addTask(topic, [topic]);
    setRunning(true);
    updateTask(taskId, { status: 'searching' });
    try {
      const res = await researchApi.start({ topic, queries: [topic] });
      updateTask(taskId, { status: 'completed', synthesis: res.data.synthesis, results: res.data.sources });
    } catch {
      updateTask(taskId, { status: 'error' });
    } finally {
      setRunning(false);
      setTopic('');
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-30 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">深層研究</h3>
        <button onClick={() => setPanelOpen(false)} className="text-gray-400 hover:text-gray-600">
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="輸入研究主題..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          />
          <button
            onClick={handleStart}
            disabled={!topic.trim() || running}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">尚無研究任務</p>
        ) : (
          tasks.map((task) => {
            const cfg = STATUS_CONFIG[task.status];
            const Icon = cfg.icon;
            return (
              <div key={task.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${cfg.color} ${task.status === 'queued' || task.status === 'searching' || task.status === 'synthesizing' ? 'animate-spin' : ''}`} />
                  <span className="text-xs font-medium text-gray-700 truncate flex-1">{task.topic}</span>
                  <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                  <button onClick={() => removeTask(task.id)} className="text-gray-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {task.synthesis && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-3">{task.synthesis}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
