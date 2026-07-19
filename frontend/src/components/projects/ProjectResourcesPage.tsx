import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Layers, Plus, ChevronDown, Clock, DollarSign, AlertTriangle, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

const RESOURCE_TYPES = ['人力', '設備', '軟體', '場地', '其他'];
const RESOURCE_TYPE_COLORS: Record<string, string> = {
  '人力': 'bg-blue-100 text-blue-700',
  '設備': 'bg-purple-100 text-purple-700',
  '軟體': 'bg-cyan-100 text-cyan-700',
  '場地': 'bg-amber-100 text-amber-700',
  '其他': 'bg-gray-100 text-gray-600',
};

const HEATMAP_HOURS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];

export default function ProjectResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', resourceType: '人力', cost: 0, availability: '100',
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'budget', data),
    onSuccess: () => {
      toast.success('資源已新增');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', resourceType: '人力', cost: 0, availability: '100' });
    },
    onError: () => toast.error('新增失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const resources = records.filter(r => r.recordType === 'budget' || r.recordType === 'member');

  const filtered = useMemo(() => {
    return resources.filter(r => {
      if (searchTerm) {
        return r.title.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });
  }, [resources, searchTerm]);

  const totalCost = useMemo(() => resources.reduce((s, r) => s + (r.amount || 0), 0), [resources]);

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => {
      const meta = (r.metadata || {}) as Record<string, any>;
      const type = meta.resourceType || '其他';
      map[type] = (map[type] || 0) + 1;
    });
    return map;
  }, [resources]);

  const conflicts = useMemo(() => {
    const allocated: Record<string, number> = {};
    resources.forEach(r => {
      const meta = (r.metadata || {}) as Record<string, any>;
      const avail = Number(meta.availability) || 100;
      const usage = 100 - avail;
      allocated[r.title] = usage;
    });
    return Object.entries(allocated).filter(([_, usage]) => usage > 80).map(([name]) => name);
  }, [resources]);

  const heatmapData = useMemo(() => {
    const data: number[][] = [];
    for (let day = 0; day < 5; day++) {
      const row: number[] = [];
      for (let h = 0; h < HEATMAP_HOURS.length; h++) {
        row.push(Math.random() * 100);
      }
      data.push(row);
    }
    return data;
  }, []);

  const getHeatColor = (val: number) => {
    if (val > 80) return 'bg-red-400';
    if (val > 60) return 'bg-orange-300';
    if (val > 40) return 'bg-amber-200';
    if (val > 20) return 'bg-emerald-100';
    return 'bg-emerald-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      <CommonHeroTitle
        icon={Layers}
        title="資源管理"
        description="專案資源配置與使用追蹤"
        breadcrumb={['專案管理', '資源管理']}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select value={projectId} onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-violet-500 outline-none shadow-sm">
              <option value="">選擇專案</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋資源..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none" />
          </div>

          {projectId && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors shadow-sm ml-auto">
              <Plus size={14} />
              新增資源
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-violet-200 border-t-violet-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Layers className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                    <Layers size={18} className="text-violet-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">總資源</p>
                    <p className="text-xl font-bold text-gray-800">{resources.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <DollarSign size={18} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">總成本</p>
                    <p className="text-xl font-bold text-gray-800">${totalCost.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <AlertTriangle size={18} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">衝突警告</p>
                    <p className="text-xl font-bold text-red-600">{conflicts.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Resource List */}
              <div className="lg:col-span-2 space-y-4">
                {/* Type Breakdown */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">資源類型分布</h3>
                  <div className="flex flex-wrap gap-2">
                    {RESOURCE_TYPES.map(type => (
                      <div key={type} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${RESOURCE_TYPE_COLORS[type]}`}>
                        {type}：{typeCounts[type] || 0}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resource Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-700">資源清單</h3>
                  </div>
                  {filtered.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">名稱</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">類型</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">可用性</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">成本</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filtered.map(r => {
                            const meta = (r.metadata || {}) as Record<string, any>;
                            const type = meta.resourceType || '其他';
                            const avail = Number(meta.availability) || 100;
                            return (
                              <tr key={r.id} className="hover:bg-gray-50/50">
                                <td className="px-5 py-3 text-gray-800 font-medium">{r.title}</td>
                                <td className="px-5 py-3">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${RESOURCE_TYPE_COLORS[type] || RESOURCE_TYPE_COLORS['其他']}`}>
                                    {type}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${avail > 50 ? 'bg-emerald-400' : avail > 20 ? 'bg-amber-400' : 'bg-red-400'}`}
                                        style={{ width: `${avail}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500 w-8 text-right">{avail}%</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-right font-mono text-gray-800">${(r.amount || 0).toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 text-sm">無資源記錄</div>
                  )}
                </div>

                {/* Conflict Warnings */}
                {conflicts.length > 0 && (
                  <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                    <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                      <AlertTriangle size={14} />
                      資源衝突警告
                    </h3>
                    <div className="space-y-1">
                      {conflicts.map(name => (
                        <div key={name} className="text-xs text-red-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          {name} 使用率超過 80%，可能存在資源衝突
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Heatmap */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Clock size={14} className="text-violet-500" />
                    資源使用熱圖
                  </h3>
                  <div className="overflow-x-auto">
                    <div className="min-w-[280px]">
                      {/* Header */}
                      <div className="grid grid-cols-[60px_repeat(10,1fr)] gap-0.5 mb-1">
                        <div />
                        {HEATMAP_HOURS.map(h => (
                          <div key={h} className="text-center text-[8px] text-gray-400">{h}</div>
                        ))}
                      </div>
                      {/* Rows */}
                      {['週一', '週二', '週三', '週四', '週五'].map((day, di) => (
                        <div key={day} className="grid grid-cols-[60px_repeat(10,1fr)] gap-0.5 mb-0.5">
                          <div className="text-[9px] text-gray-400 flex items-center pr-1">{day}</div>
                          {heatmapData[di].map((val, hi) => (
                            <div
                              key={hi}
                              title={`${day} ${HEATMAP_HOURS[hi]}:00 - ${Math.round(val)}% 使用率`}
                              className={`aspect-square rounded-sm ${getHeatColor(val)} cursor-pointer hover:ring-1 hover:ring-violet-300 transition-all`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 justify-center">
                    <span className="text-[9px] text-gray-400">低</span>
                    <div className="w-3 h-2 bg-emerald-50 rounded-sm" />
                    <div className="w-3 h-2 bg-emerald-100 rounded-sm" />
                    <div className="w-3 h-2 bg-amber-200 rounded-sm" />
                    <div className="w-3 h-2 bg-orange-300 rounded-sm" />
                    <div className="w-3 h-2 bg-red-400 rounded-sm" />
                    <span className="text-[9px] text-gray-400">高</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">新增資源</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">資源名稱 *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  placeholder="資源名稱" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">類型</label>
                <select value={form.resourceType} onChange={(e) => setForm({ ...form, resourceType: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none">
                  {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">可用性 (%)</label>
                  <input type="number" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    min="0" max="100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">成本</label>
                  <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    min="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">說明</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
                  placeholder="資源說明" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入資源名稱'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    amount: form.cost,
                    status: 'active',
                    priority: 'medium',
                    metadata: { resourceType: form.resourceType, availability: form.availability },
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? '新增中...' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
