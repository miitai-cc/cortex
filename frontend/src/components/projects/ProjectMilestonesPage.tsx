import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Flag, Plus, ChevronDown, User, Calendar, Target, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord, ProjectPriority } from '../../types/projects';

type Filter = 'all' | 'in_progress' | 'completed' | 'delayed';

export default function ProjectMilestonesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', endDate: '', assigneeName: '', priority: 'medium' as ProjectPriority });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'milestone', data),
    onSuccess: () => {
      toast.success('里程碑已建立');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', endDate: '', assigneeName: '', priority: 'medium' });
    },
    onError: () => toast.error('建立失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const milestones = records.filter(r => r.recordType === 'milestone');

  const filtered = milestones.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'completed') return m.status === 'completed';
    if (filter === 'in_progress') return m.status === 'active' || m.status === 'in_progress';
    if (filter === 'delayed') {
      if (!m.endDate) return false;
      return new Date(m.endDate) < new Date() && m.status !== 'completed';
    }
    return true;
  }).sort((a, b) => {
    const da = a.endDate || a.startDate || '';
    const db = b.endDate || b.startDate || '';
    return da.localeCompare(db);
  });

  const stats = {
    total: milestones.length,
    completed: milestones.filter(m => m.status === 'completed').length,
    inProgress: milestones.filter(m => m.status === 'active' || m.status === 'in_progress').length,
    delayed: milestones.filter(m => m.endDate && new Date(m.endDate) < new Date() && m.status !== 'completed').length,
  };

  const priorityColor = (p: string) => {
    if (p === 'critical') return 'text-red-600 bg-red-50';
    if (p === 'high') return 'text-orange-600 bg-orange-50';
    if (p === 'medium') return 'text-blue-600 bg-blue-50';
    return 'text-gray-500 bg-gray-50';
  };

  const statusIcon = (m: ProjectRecord) => {
    if (m.status === 'completed') return <CheckCircle2 size={20} className="text-emerald-500" />;
    if (m.endDate && new Date(m.endDate) < new Date()) return <AlertTriangle size={20} className="text-red-500" />;
    return <Clock size={20} className="text-amber-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50">
      <CommonHeroTitle
        icon={Flag}
        title="Milestone 管理"
        description="追蹤專案重要里程碑與交付進度"
        breadcrumb={['專案管理', 'Milestone 管理']}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-rose-500 outline-none shadow-sm"
            >
              <option value="">選擇專案</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
            {(['all', 'in_progress', 'completed', 'delayed'] as Filter[]).map(f => {
              const labels: Record<Filter, string> = { all: '全部', in_progress: '進行中', completed: '已完成', delayed: '已延期' };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === f ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-500 hover:bg-white'
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {projectId && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors shadow-sm"
            >
              <Plus size={14} />
              新增里程碑
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-[11px] text-gray-400 mt-1">總里程碑</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-[11px] text-gray-400 mt-1">已完成</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            <p className="text-[11px] text-gray-400 mt-1">進行中</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-red-500">{stats.delayed}</p>
            <p className="text-[11px] text-gray-400 mt-1">已延期</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-rose-200 border-t-rose-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Flag className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Target className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">無符合篩選條件的里程碑</p>
          </div>
        ) : (
          /* Vertical Timeline */
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-rose-300 via-amber-300 to-emerald-300" />

            <div className="space-y-6">
              {filtered.map((m, idx) => {
                const progress = m.progress || (m.status === 'completed' ? 100 : 0);
                return (
                  <div key={m.id} className="relative pl-16">
                    {/* Timeline Dot */}
                    <div className="absolute left-4 top-5 z-10">
                      <div className={`w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${
                        m.status === 'completed' ? 'border-emerald-400' :
                        m.endDate && new Date(m.endDate) < new Date() ? 'border-red-400' :
                        'border-amber-400'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          m.status === 'completed' ? 'bg-emerald-400' :
                          m.endDate && new Date(m.endDate) < new Date() ? 'bg-red-400' :
                          'bg-amber-400'
                        }`} />
                      </div>
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {statusIcon(m)}
                          <div>
                            <h3 className="font-bold text-gray-800 text-sm">{m.title}</h3>
                            {m.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityColor(m.priority)}`}>
                          {m.priority === 'critical' ? '緊急' : m.priority === 'high' ? '高' : m.priority === 'medium' ? '中' : '低'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        {m.endDate && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {m.endDate}
                          </span>
                        )}
                        {m.assigneeName && (
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {m.assigneeName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Target size={12} />
                          {m.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                          <span>進度</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progress === 100 ? 'bg-emerald-500' :
                              progress >= 60 ? 'bg-blue-500' :
                              progress >= 30 ? 'bg-amber-500' :
                              'bg-gray-300'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">新增里程碑</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">名稱 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                  placeholder="里程碑名稱"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none"
                  placeholder="里程碑描述"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">目標日期</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">負責人</label>
                  <input
                    type="text"
                    value={form.assigneeName}
                    onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                    placeholder="負責人姓名"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">優先度</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as ProjectPriority })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">緊急</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                取消
              </button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入里程碑名稱'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    endDate: form.endDate || undefined,
                    assigneeName: form.assigneeName || undefined,
                    priority: form.priority,
                    status: 'planned',
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
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
