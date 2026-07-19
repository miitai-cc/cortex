import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LayoutGrid, Plus, ChevronDown, GripVertical, User, Tag, Filter, BarChart3 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord, ProjectPriority } from '../../types/projects';

type ColumnId = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

interface KanbanColumn {
  id: ColumnId;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: 'backlog', title: '需求池', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  { id: 'todo', title: '待處理', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'in_progress', title: '進行中', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  { id: 'review', title: '待審核', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'done', title: '完成', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
];

const statusToColumn: Record<string, ColumnId> = {
  planned: 'backlog', pending: 'todo', active: 'in_progress', in_progress: 'in_progress',
  review: 'review', completed: 'done', done: 'done',
};

const priorityBadge: Record<ProjectPriority, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: '緊急' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', label: '高' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700', label: '中' },
  low: { bg: 'bg-gray-100', text: 'text-gray-600', label: '低' },
};

export default function ProjectKanbanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as ProjectPriority, assigneeName: '' });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      projectApi.updateRecord(projectId, 'task', id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'task', data),
    onSuccess: () => {
      toast.success('任務已建立');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', priority: 'medium', assigneeName: '' });
    },
    onError: () => toast.error('建立失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const tasks = records.filter(r => r.recordType === 'task');

  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => { if (t.assigneeName) set.add(t.assigneeName); });
    return Array.from(set);
  }, [tasks]);

  const filteredTasks = tasks.filter(t => {
    if (filterAssignee && t.assigneeName !== filterAssignee) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const tasksByColumn = useMemo(() => {
    const map: Record<ColumnId, ProjectRecord[]> = {
      backlog: [], todo: [], in_progress: [], review: [], done: [],
    };
    filteredTasks.forEach(t => {
      const col = statusToColumn[t.status] || 'backlog';
      map[col].push(t);
    });
    return map;
  }, [filteredTasks]);

  const totalTasks = filteredTasks.length;
  const doneTasks = tasksByColumn.done.length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId || !projectId) return;
    const statusMap: Record<ColumnId, string> = {
      backlog: 'planned', todo: 'pending', in_progress: 'in_progress', review: 'review', done: 'completed',
    };
    updateMutation.mutate({ id: taskId, data: { status: statusMap[columnId] } });
    toast.success(`任務已移至「${COLUMNS.find(c => c.id === columnId)?.title}」`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      <CommonHeroTitle
        icon={LayoutGrid}
        title="Kanban 工作管理"
        description="拖曳式看板管理專案任務"
        breadcrumb={['專案管理', 'Kanban 工作管理']}
      />

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-violet-500 outline-none shadow-sm"
            >
              <option value="">選擇專案</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500 outline-none"
            >
              <option value="">全部成員</option>
              {uniqueAssignees.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500 outline-none"
            >
              <option value="">全部優先度</option>
              <option value="critical">緊急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <BarChart3 size={14} />
              <span>完成率</span>
              <span className="font-bold text-violet-600">{completionRate}%</span>
              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
            {projectId && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors shadow-sm"
              >
                <Plus size={14} />
                新增任務
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-violet-200 border-t-violet-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <LayoutGrid className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map(col => {
              const colTasks = tasksByColumn[col.id];
              return (
                <div
                  key={col.id}
                  className={`flex-shrink-0 w-72 ${col.bgColor} rounded-xl border ${col.borderColor} p-3`}
                  onDrop={(e) => handleDrop(e, col.id)}
                  onDragOver={handleDragOver}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-bold ${col.color}`}>{col.title}</h3>
                      <span className="text-[10px] bg-white/80 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                        {colTasks.length}
                      </span>
                    </div>
                    {col.id === 'in_progress' && (
                      <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">
                        WIP ≤ 5
                      </span>
                    )}
                  </div>

                  {/* Task Cards */}
                  <div className="space-y-2 min-h-[100px]">
                    {colTasks.map(task => {
                      const badge = priorityBadge[task.priority] || priorityBadge.medium;
                      const progress = task.progress || 0;
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <GripVertical size={12} className="text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            <p className="text-sm font-medium text-gray-800 leading-tight flex-1">{task.title}</p>
                          </div>

                          {task.description && (
                            <p className="text-[11px] text-gray-400 mb-2 line-clamp-2 ml-5">{task.description}</p>
                          )}

                          {/* Progress Bar */}
                          <div className="mb-2 ml-5">
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  progress === 100 ? 'bg-emerald-500' : 'bg-violet-400'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-gray-400 mt-0.5">{progress}%</span>
                          </div>

                          <div className="flex items-center justify-between ml-5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                            {task.assigneeName && (
                              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <User size={10} />
                                {task.assigneeName}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">新增任務</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">任務標題 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  placeholder="任務標題"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
                  placeholder="任務描述"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">優先度</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as ProjectPriority })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="critical">緊緊</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">負責人</label>
                  <input
                    type="text"
                    value={form.assigneeName}
                    onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    placeholder="負責人姓名"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入任務標題'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    priority: form.priority,
                    assigneeName: form.assigneeName || undefined,
                    status: 'planned',
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? '建立中...' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
