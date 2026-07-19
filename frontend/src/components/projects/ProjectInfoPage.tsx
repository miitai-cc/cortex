import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Info, Edit3, Trash2, ExternalLink, MessageSquare, Calendar, Users, ChevronDown, Clock, Tag, DollarSign } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { Project, ProjectStatus, ProjectPriority } from '../../types/projects';

const statusColors: Record<ProjectStatus, string> = {
  planning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  on_hold: 'bg-orange-100 text-orange-800 border-orange-300',
  completed: 'bg-blue-100 text-blue-800 border-blue-300',
  archived: 'bg-gray-100 text-gray-600 border-gray-300',
};
const statusLabels: Record<ProjectStatus, string> = {
  planning: '規劃中', active: '進行中', on_hold: '暫停', completed: '已完成', archived: '已封存',
};
const priorityColors: Record<ProjectPriority, string> = {
  low: 'text-gray-500', medium: 'text-blue-500', high: 'text-orange-500', critical: 'text-red-600',
};
const priorityLabels: Record<ProjectPriority, string> = {
  low: '低', medium: '中', high: '高', critical: '緊急',
};

export default function ProjectInfoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectApi.deleteProject(id),
    onSuccess: () => {
      toast.success('專案已刪除');
      queryClient.invalidateQueries({ queryKey: ['projectOverview'] });
      setSearchParams({});
    },
    onError: () => toast.error('刪除失敗'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => projectApi.updateProject(id, data),
    onSuccess: () => {
      toast.success('專案已更新');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowEditModal(false);
    },
    onError: () => toast.error('更新失敗'),
  });

  const projects = overview?.projects || [];
  const selectedProject = overview?.selectedProject;
  const stats = overview?.stats;
  const records = overview?.records || [];
  const recentMilestones = records.filter(r => r.recordType === 'milestone').slice(0, 3);

  const handleSelectProject = (id: string) => {
    setSearchParams({ project: id });
  };

  const handleEdit = () => {
    if (selectedProject) {
      setEditForm({
        name: selectedProject.name,
        code: selectedProject.code,
        description: selectedProject.description,
        status: selectedProject.status,
        priority: selectedProject.priority,
        managerName: selectedProject.managerName,
        startDate: selectedProject.startDate,
        endDate: selectedProject.endDate,
        budgetTotal: selectedProject.budgetTotal,
      });
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedProject && editForm) {
      updateMutation.mutate({ id: selectedProject.id, data: editForm });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <CommonHeroTitle
        icon={Info}
        title="專案資訊"
        description="查看專案基本資訊與相關連結"
        breadcrumb={['專案管理', '專案資訊']}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] })}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Project Selector */}
        <div className="mb-6">
          <div className="relative inline-block w-full max-w-md">
            <select
              value={projectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="w-full appearance-none bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
            >
              <option value="">-- 請選擇專案 --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={18} />
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        )}

        {!isLoading && !selectedProject && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Info className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案以查看資訊</p>
          </div>
        )}

        {selectedProject && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Main Card */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-indigo-200 text-sm font-mono">{selectedProject.code}</span>
                      <h2 className="text-white text-xl font-bold mt-1">{selectedProject.name}</h2>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[selectedProject.status]}`}>
                      {statusLabels[selectedProject.status]}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    {selectedProject.description || '暫無描述'}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <Users size={12} />
                        <span>負責人</span>
                      </div>
                      <p className="text-gray-800 font-medium text-sm">{selectedProject.managerName || '未指派'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <Calendar size={12} />
                        <span>起始日</span>
                      </div>
                      <p className="text-gray-800 font-medium text-sm">{selectedProject.startDate || '未設定'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <Calendar size={12} />
                        <span>結束日</span>
                      </div>
                      <p className="text-gray-800 font-medium text-sm">{selectedProject.endDate || '未設定'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <DollarSign size={12} />
                        <span>預算</span>
                      </div>
                      <p className="text-gray-800 font-medium text-sm">
                        {selectedProject.budgetTotal ? `$${selectedProject.budgetTotal.toLocaleString()}` : '未設定'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <div className={`flex items-center gap-1 ${priorityColors[selectedProject.priority]}`}>
                      <Tag size={14} />
                      <span className="text-sm font-semibold">優先度：{priorityLabels[selectedProject.priority]}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 px-6 py-4 flex items-center gap-3">
                  {selectedProject.canEdit && (
                    <>
                      <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
                        <Edit3 size={14} />
                        編輯專案
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('確定要刪除此專案嗎？')) {
                            deleteMutation.mutate(selectedProject.id);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        <Trash2 size={14} />
                        刪除專案
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                    <p className="text-2xl font-bold text-indigo-600">{stats.taskCount || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">任務總數</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                    <p className="text-2xl font-bold text-emerald-600">{stats.taskDone || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">已完成任務</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                    <p className="text-2xl font-bold text-purple-600">{stats.milestoneCount || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">里程碑</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                    <p className="text-2xl font-bold text-orange-600">{stats.memberCount || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">團隊成員</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Sidebar */}
            <div className="space-y-6">
              {/* Related Links */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <ExternalLink size={14} className="text-indigo-500" />
                  相關連結
                </h3>
                {selectedProject.relatedLinks && selectedProject.relatedLinks.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProject.relatedLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-indigo-50 text-sm text-gray-700 hover:text-indigo-600 transition-colors"
                      >
                        <ExternalLink size={12} />
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">暫無相關連結</p>
                )}
              </div>

              {/* Collaboration */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <MessageSquare size={14} className="text-purple-500" />
                  協作空間
                </h3>
                {selectedProject.collaborationWorkspaceId ? (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-sm text-purple-700 font-medium">已連結協作空間</p>
                    <p className="text-xs text-purple-500 mt-1">點擊前往團隊討論區</p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">尚未建立協作空間</p>
                  </div>
                )}
              </div>

              {/* Mini Timeline */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Clock size={14} className="text-emerald-500" />
                  近期里程碑
                </h3>
                {recentMilestones.length > 0 ? (
                  <div className="space-y-3">
                    {recentMilestones.map((m) => (
                      <div key={m.id} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{m.title}</p>
                          <p className="text-xs text-gray-400">{m.endDate || '未設定日期'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">暫無里程碑</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">編輯專案資訊</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">專案名稱</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">專案代碼</label>
                <input
                  type="text"
                  value={editForm.code || ''}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">描述</label>
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">狀態</label>
                  <select
                    value={editForm.status || 'planning'}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ProjectStatus })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="planning">規劃中</option>
                    <option value="active">進行中</option>
                    <option value="on_hold">暫停</option>
                    <option value="completed">已完成</option>
                    <option value="archived">已封存</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">優先度</label>
                  <select
                    value={editForm.priority || 'medium'}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as ProjectPriority })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="critical">緊急</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">起始日</label>
                  <input
                    type="date"
                    value={editForm.startDate || ''}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">結束日</label>
                  <input
                    type="date"
                    value={editForm.endDate || ''}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">預算</label>
                <input
                  type="number"
                  value={editForm.budgetTotal || ''}
                  onChange={(e) => setEditForm({ ...editForm, budgetTotal: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
