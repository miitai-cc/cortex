import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClipboardCheck, Plus, ChevronDown, CheckCircle2, XCircle, AlertCircle, Upload, User, Calendar, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

type FilterType = 'all' | 'pass' | 'fail' | 'follow_up';

export default function ProjectAuditsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showChecklist, setShowChecklist] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', status: 'pass', assigneeName: '',
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'audit', data),
    onSuccess: () => {
      toast.success('稽核記錄已建立');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', status: 'pass', assigneeName: '' });
    },
    onError: () => toast.error('建立失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const audits = records.filter(r => r.recordType === 'audit');

  const filtered = useMemo(() => {
    return audits.filter(a => {
      if (filter === 'pass') return a.status === 'pass' || a.status === 'completed';
      if (filter === 'fail') return a.status === 'fail' || a.status === 'failed';
      if (filter === 'follow_up') return a.status === 'follow_up' || a.status === 'pending';
      return true;
    });
  }, [audits, filter]);

  const stats = useMemo(() => ({
    total: audits.length,
    pass: audits.filter(a => a.status === 'pass' || a.status === 'completed').length,
    fail: audits.filter(a => a.status === 'fail' || a.status === 'failed').length,
    followUp: audits.filter(a => a.status === 'follow_up' || a.status === 'pending').length,
  }), [audits]);

  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;

  const statusIcon = (s: string) => {
    if (s === 'pass' || s === 'completed') return <CheckCircle2 size={16} className="text-emerald-500" />;
    if (s === 'fail' || s === 'failed') return <XCircle size={16} className="text-red-500" />;
    return <AlertCircle size={16} className="text-amber-500" />;
  };

  const statusBadge = (s: string) => {
    if (s === 'pass' || s === 'completed') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">通過</span>;
    if (s === 'fail' || s === 'failed') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">不合格</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">待跟進</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <CommonHeroTitle
        icon={ClipboardCheck}
        title="成果稽核"
        description="專案成果品質稽核與缺失追蹤"
        breadcrumb={['專案管理', '成果稽核']}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select value={projectId} onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm">
              <option value="">選擇專案</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
            {(['all', 'pass', 'fail', 'follow_up'] as FilterType[]).map(f => {
              const labels: Record<FilterType, string> = { all: '全部', pass: '通過', fail: '不合格', follow_up: '待跟進' };
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === f ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:bg-white'
                  }`}>
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {projectId && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors shadow-sm">
              <Plus size={14} />
              新增稽核
            </button>
          )}
        </div>

        {/* Stats + Pass Rate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-[11px] text-gray-400 mt-1">總稽核</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.pass}</p>
              <p className="text-[11px] text-gray-400 mt-1">通過</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-red-500">{stats.fail}</p>
              <p className="text-[11px] text-gray-400 mt-1">不合格</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.followUp}</p>
              <p className="text-[11px] text-gray-400 mt-1">待跟進</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">通過率</span>
              <span className={`text-lg font-bold ${passRate >= 80 ? 'text-emerald-600' : passRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                {passRate}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  passRate >= 80 ? 'bg-emerald-500' : passRate >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${passRate}%` }}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-200 border-t-teal-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <ClipboardCheck className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                <ClipboardCheck className="mx-auto text-gray-300 mb-4" size={40} />
                <p className="text-gray-400 text-sm">無稽核記錄</p>
              </div>
            ) : (
              filtered.map(audit => {
                const meta = (audit.metadata || {}) as Record<string, any>;
                const checklist = meta.checklist || [];
                return (
                  <div key={audit.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center gap-4 p-4">
                      <div className="flex-shrink-0">{statusIcon(audit.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-800">{audit.title}</h3>
                          {statusBadge(audit.status)}
                        </div>
                        {audit.description && (
                          <p className="text-xs text-gray-500 line-clamp-1">{audit.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                          {audit.assigneeName && <span className="flex items-center gap-1"><User size={10} />{audit.assigneeName}</span>}
                          {audit.createdAt && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(audit.createdAt).toLocaleDateString('zh-TW')}</span>}
                        </div>
                      </div>
                      {checklist.length > 0 && (
                        <button
                          onClick={() => setShowChecklist(showChecklist === audit.id ? null : audit.id)}
                          className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                        >
                          檢視稽核項目 ({checklist.length})
                        </button>
                      )}
                    </div>

                    {showChecklist === audit.id && checklist.length > 0 && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                        <h4 className="text-xs font-semibold text-gray-500 mb-3">稽核項目</h4>
                        <div className="space-y-2">
                          {checklist.map((item: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              {item.passed ? (
                                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                              )}
                              <div>
                                <span className={`text-xs ${item.passed ? 'text-gray-700' : 'text-red-600'}`}>{item.name || item}</span>
                                {item.note && <p className="text-[10px] text-gray-400 mt-0.5">{item.note}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence Upload Area */}
                    {audit.status === 'fail' || audit.status === 'follow_up' ? (
                      <div className="border-t border-gray-100 p-4">
                        <h4 className="text-xs font-semibold text-gray-500 mb-2">佐證資料</h4>
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-teal-300 transition-colors cursor-pointer">
                          <Upload size={20} className="mx-auto text-gray-300 mb-1" />
                          <p className="text-[11px] text-gray-400">點擊或拖曳上傳佐證資料</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">新增稽核記錄</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">稽核項目 *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="稽核項目名稱" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">說明</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                  placeholder="稽核說明" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">結果</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none">
                    <option value="pass">通過</option>
                    <option value="fail">不合格</option>
                    <option value="follow_up">待跟進</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">稽核人員</label>
                  <input type="text" value={form.assigneeName} onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    placeholder="稽核人員姓名" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入稽核項目'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    status: form.status,
                    assigneeName: form.assigneeName || undefined,
                    priority: 'medium',
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? '建立中...' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
