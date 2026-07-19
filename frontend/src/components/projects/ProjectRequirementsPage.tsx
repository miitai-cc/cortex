import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileText, Plus, ChevronDown, ChevronRight, GitBranch, User, CheckCircle2, Circle, AlertCircle, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord, ProjectPriority } from '../../types/projects';

type ViewMode = 'hierarchy' | 'matrix';

export default function ProjectRequirementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchy');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as ProjectPriority, assigneeName: '',
    parentTitle: '', acceptanceCriteria: '',
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'requirement', data),
    onSuccess: () => {
      toast.success('需求已建立');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', priority: 'medium', assigneeName: '', parentTitle: '', acceptanceCriteria: '' });
    },
    onError: () => toast.error('建立失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const requirements = records.filter(r => r.recordType === 'requirement');

  const filtered = useMemo(() => {
    return requirements.filter(r => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterPriority && r.priority !== filterPriority) return false;
      if (filterOwner && r.assigneeName !== filterOwner) return false;
      return true;
    });
  }, [requirements, filterStatus, filterPriority, filterOwner]);

  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    requirements.forEach(r => { if (r.assigneeName) set.add(r.assigneeName); });
    return Array.from(set);
  }, [requirements]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusIcon = (status: string) => {
    if (status === 'completed' || status === 'done') return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (status === 'active' || status === 'in_progress') return <AlertCircle size={14} className="text-blue-500" />;
    return <Circle size={14} className="text-gray-300" />;
  };

  const priorityColor = (p: string) => {
    if (p === 'critical') return 'bg-red-100 text-red-700';
    if (p === 'high') return 'bg-orange-100 text-orange-700';
    if (p === 'medium') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <CommonHeroTitle
        icon={FileText}
        title="需求管理"
        description="管理專案需求、驗收標準與追溯性"
        breadcrumb={['專案管理', '需求管理']}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative">
            <select value={projectId} onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
              <option value="">選擇專案</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['hierarchy', 'matrix'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === v ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-white'
                }`}>
                {v === 'hierarchy' ? '樹狀檢視' : '追溯矩陣'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">全部狀態</option>
              <option value="planned">規劃中</option>
              <option value="active">進行中</option>
              <option value="completed">已完成</option>
            </select>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">全部優先度</option>
              <option value="critical">緊急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            {uniqueOwners.length > 0 && (
              <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">全部負責人</option>
                {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>

          {projectId && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm ml-auto">
              <Plus size={14} />
              新增需求
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <FileText className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : viewMode === 'hierarchy' ? (
          /* Hierarchy View */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <span className="text-xs font-medium text-gray-500">共 {filtered.length} 項需求</span>
            </div>
            {filtered.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {filtered.map(req => {
                  const meta = (req.metadata || {}) as Record<string, any>;
                  const isExpanded = expandedIds.has(req.id);
                  const children = requirements.filter(r => r.description?.includes(`parent:${req.id}`));
                  return (
                    <div key={req.id}>
                      <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(req.id)}>
                        {children.length > 0 ? (
                          <ChevronRight size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        ) : (
                          <div className="w-3.5" />
                        )}
                        {statusIcon(req.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{req.title}</p>
                          {req.description && !isExpanded && (
                            <p className="text-[11px] text-gray-400 truncate">{req.description}</p>
                          )}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor(req.priority)}`}>
                          {req.priority === 'critical' ? '緊急' : req.priority === 'high' ? '高' : req.priority === 'medium' ? '中' : '低'}
                        </span>
                        {req.assigneeName && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <User size={10} />
                            {req.assigneeName}
                          </span>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="px-5 pb-4 pl-12 bg-gray-50/30">
                          {req.description && (
                            <p className="text-xs text-gray-600 mb-2">{req.description}</p>
                          )}
                          {meta.acceptanceCriteria && (
                            <div className="bg-emerald-50 rounded-lg p-3 mt-2">
                              <p className="text-[10px] font-semibold text-emerald-600 mb-1">驗收標準</p>
                              <p className="text-xs text-emerald-700">{meta.acceptanceCriteria}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                            <span>狀態：{req.status}</span>
                            <span>建立：{req.createdAt ? new Date(req.createdAt).toLocaleDateString('zh-TW') : '-'}</span>
                          </div>
                          {children.length > 0 && (
                            <div className="mt-3 pl-4 border-l-2 border-indigo-200 space-y-1">
                              {children.map(child => (
                                <div key={child.id} className="flex items-center gap-2 text-xs text-gray-600">
                                  {statusIcon(child.status)}
                                  <span>{child.title}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-sm">無符合條件的需求</div>
            )}
          </div>
        ) : (
          /* Traceability Matrix View */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-5 bg-gray-50 border-b border-gray-200">
                {['需求名稱', '來源', '優先度', '負責人', '狀態'].map(h => (
                  <div key={h} className="px-4 py-3 text-xs font-bold text-gray-500">{h}</div>
                ))}
              </div>
              <div className="divide-y divide-gray-50">
                {filtered.map(req => (
                  <div key={req.id} className="grid grid-cols-5 hover:bg-gray-50/50 transition-colors">
                    <div className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800 truncate">{req.title}</p>
                    </div>
                    <div className="px-4 py-3 text-xs text-gray-500">
                      {(req.metadata as Record<string, any>)?.source || '內部'}
                    </div>
                    <div className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor(req.priority)}`}>
                        {req.priority === 'critical' ? '緊急' : req.priority === 'high' ? '高' : req.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-xs text-gray-500">{req.assigneeName || '-'}</div>
                    <div className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        req.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{req.status || 'planned'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">新增需求</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">需求標題 *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="需求標題" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">描述</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  placeholder="需求描述" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">驗收標準</label>
                <textarea value={form.acceptanceCriteria} onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  placeholder="此需求的驗收標準" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">優先度</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as ProjectPriority })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="critical">緊急</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">負責人</label>
                  <input type="text" value={form.assigneeName} onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="負責人姓名" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入需求標題'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    priority: form.priority,
                    assigneeName: form.assigneeName || undefined,
                    status: 'planned',
                    metadata: { acceptanceCriteria: form.acceptanceCriteria || undefined },
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? '建立中...' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
