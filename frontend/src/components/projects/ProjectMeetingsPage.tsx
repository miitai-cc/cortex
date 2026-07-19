import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Video, Plus, ChevronDown, Clock, MapPin, Users, ChevronRight, CheckSquare, XCircle, CircleDot } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled';

export default function ProjectMeetingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', startDate: '', endDate: '', assigneeName: '', location: '',
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'meeting', data),
    onSuccess: () => {
      toast.success('會議已建立');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', startDate: '', endDate: '', assigneeName: '', location: '' });
    },
    onError: () => toast.error('建立失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const meetings = records.filter(r => r.recordType === 'meeting');

  const filtered = meetings.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return m.status !== 'completed' && m.status !== 'cancelled';
    if (filter === 'completed') return m.status === 'completed';
    if (filter === 'cancelled') return m.status === 'cancelled';
    return true;
  }).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  const statusBadge = (s: string) => {
    if (s === 'completed') return <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium"><CheckSquare size={10} />已完成</span>;
    if (s === 'cancelled') return <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"><XCircle size={10} />已取消</span>;
    return <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium"><CircleDot size={10} />即將舉行</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <CommonHeroTitle
        icon={Video}
        title="會議記錄"
        description="管理專案會議行程與決策記錄"
        breadcrumb={['專案管理', '會議記錄']}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-cyan-500 outline-none shadow-sm"
            >
              <option value="">選擇專案</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
            {(['all', 'upcoming', 'completed', 'cancelled'] as Filter[]).map(f => {
              const labels: Record<Filter, string> = { all: '全部', upcoming: '即將舉行', completed: '已完成', cancelled: '已取消' };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === f ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-500 hover:bg-white'
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
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition-colors shadow-sm"
            >
              <Plus size={14} />
              新增會議
            </button>
          )}
        </div>

        {/* Meeting List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-200 border-t-cyan-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Video className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Video className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">無會議記錄</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(meeting => {
              const isExpanded = expandedId === meeting.id;
              const meta = (meeting.metadata || {}) as Record<string, any>;
              return (
                <div key={meeting.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Meeting Header */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                  >
                    {/* Date Badge */}
                    <div className="w-14 h-14 bg-cyan-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] text-cyan-500 font-medium">
                        {meeting.startDate ? new Date(meeting.startDate).toLocaleDateString('zh-TW', { month: 'short' }) : '--'}
                      </span>
                      <span className="text-lg font-bold text-cyan-700">
                        {meeting.startDate ? new Date(meeting.startDate).getDate() : '--'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-gray-800 truncate">{meeting.title}</h3>
                        {statusBadge(meeting.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        {meeting.startDate && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(meeting.startDate).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                            {meeting.endDate && ` - ${new Date(meeting.endDate).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        )}
                        {meta.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} />
                            {meta.location}
                          </span>
                        )}
                        {meeting.assigneeName && (
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {meeting.assigneeName}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      size={16}
                      className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-4">
                      {meeting.description && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-1">議程 / 描述</h4>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.description}</p>
                        </div>
                      )}

                      {meta.agenda && Array.isArray(meta.agenda) && meta.agenda.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-1">議程項目</h4>
                          <ul className="space-y-1">
                            {meta.agenda.map((item: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-cyan-500 mt-0.5">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {meta.decisions && Array.isArray(meta.decisions) && meta.decisions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-1">決策事項</h4>
                          <div className="space-y-1">
                            {meta.decisions.map((d: string, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm bg-emerald-50 rounded-lg p-2">
                                <CheckSquare size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span className="text-emerald-800">{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {meta.actionItems && Array.isArray(meta.actionItems) && meta.actionItems.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-1">行動事項</h4>
                          <div className="space-y-1">
                            {meta.actionItems.map((item: string, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm bg-amber-50 rounded-lg p-2">
                                <CircleDot size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                <span className="text-amber-800">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-400 pt-2 border-t border-gray-100">
                        <span>建立者：{meeting.createdBy}</span>
                        {meeting.createdAt && <span>建立時間：{new Date(meeting.createdAt).toLocaleString('zh-TW')}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">新增會議</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">會議名稱 *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  placeholder="例如：週三進度會議" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">描述 / 議程</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
                  placeholder="會議議程或描述" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">開始時間</label>
                  <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">結束時間</label>
                  <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">會議地點</label>
                  <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    placeholder="會議室或線上連結" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">主持人</label>
                  <input type="text" value={form.assigneeName} onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    placeholder="主持人姓名" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入會議名稱'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    startDate: form.startDate || undefined,
                    endDate: form.endDate || undefined,
                    assigneeName: form.assigneeName || undefined,
                    status: 'scheduled',
                    metadata: { location: form.location || undefined },
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 transition-colors"
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
