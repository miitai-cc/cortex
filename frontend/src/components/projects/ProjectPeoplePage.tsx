import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Users, Plus, ChevronDown, Mail, Phone, BarChart2, UserPlus, Percent } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord, ProjectUser } from '../../types/projects';

const ROLE_COLORS: Record<string, string> = {
  pm: 'bg-indigo-100 text-indigo-700',
  developer: 'bg-blue-100 text-blue-700',
  designer: 'bg-purple-100 text-purple-700',
  qa: 'bg-amber-100 text-amber-700',
  analyst: 'bg-emerald-100 text-emerald-700',
};
const ROLE_LABELS: Record<string, string> = {
  pm: '專案經理', developer: '開發者', designer: '設計師', qa: '品質保證', analyst: '分析師',
};

const AVATAR_COLORS = [
  'from-rose-400 to-rose-500',
  'from-blue-400 to-blue-500',
  'from-emerald-400 to-emerald-500',
  'from-amber-400 to-amber-500',
  'from-purple-400 to-purple-500',
  'from-cyan-400 to-cyan-500',
  'from-pink-400 to-pink-500',
  'from-teal-400 to-teal-500',
];

export default function ProjectPeoplePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ assigneeName: '', role: 'developer', allocation: 50 });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'member', data),
    onSuccess: () => {
      toast.success('成員已新增');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ assigneeName: '', role: 'developer', allocation: 50 });
    },
    onError: () => toast.error('新增失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const members = records.filter(r => r.recordType === 'member');
  const users = overview?.users || [];
  const stats = overview?.stats;

  const roleDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach(m => {
      const role = (m.metadata as Record<string, any>)?.role || 'developer';
      map[role] = (map[role] || 0) + 1;
    });
    return Object.entries(map).map(([role, count]) => ({
      role,
      count,
      label: ROLE_LABELS[role] || role,
      color: ROLE_COLORS[role] || 'bg-gray-100 text-gray-600',
    }));
  }, [members]);

  const totalAllocation = useMemo(() => {
    return members.reduce((sum, m) => sum + ((m.metadata as Record<string, any>)?.allocation || 0), 0);
  }, [members]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <CommonHeroTitle
        icon={Users}
        title="專案人員"
        description="管理專案團隊成員與資源分配"
        breadcrumb={['專案管理', '專案人員']}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-sky-500 outline-none shadow-sm"
            >
              <option value="">選擇專案</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {projectId && (
              <>
                <div className="bg-white rounded-xl px-4 py-2 border border-gray-100 shadow-sm">
                  <span className="text-xs text-gray-400">總成員</span>
                  <span className="ml-2 text-lg font-bold text-sky-600">{members.length}</span>
                </div>
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-medium hover:bg-sky-700 transition-colors shadow-sm"
                >
                  <UserPlus size={14} />
                  新增成員
                </button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-sky-200 border-t-sky-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Users className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center">
                    <Users size={18} className="text-sky-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">團隊成員</p>
                    <p className="text-xl font-bold text-gray-800">{members.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <BarChart2 size={18} className="text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">角色分布</p>
                    <p className="text-xl font-bold text-gray-800">{roleDistribution.length} 種</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Percent size={18} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">總配置%</p>
                    <p className="text-xl font-bold text-gray-800">{totalAllocation}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Allocation Timeline */}
            {members.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <BarChart2 size={16} className="text-sky-500" />
                  人員配置甘特圖
                </h3>
                <div className="space-y-2">
                  {members.map((m, idx) => {
                    const meta = (m.metadata || {}) as Record<string, any>;
                    const alloc = meta.allocation || 0;
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-20 truncate text-right">{m.assigneeName || m.title}</span>
                        <div className="flex-1 h-4 bg-gray-50 rounded-full overflow-hidden relative">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${
                              alloc > 80 ? 'from-red-400 to-red-500' :
                              alloc > 50 ? 'from-amber-400 to-amber-500' :
                              'from-sky-400 to-sky-500'
                            } transition-all`}
                            style={{ width: `${alloc}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-600">
                            {alloc}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Role Distribution */}
            {roleDistribution.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4">角色分布</h3>
                <div className="flex flex-wrap gap-3">
                  {roleDistribution.map(r => (
                    <div key={r.role} className={`px-4 py-2 rounded-xl ${r.color} font-medium text-sm`}>
                      {r.label}：{r.count}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Member Card Wall */}
            {members.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {members.map((m, idx) => {
                  const meta = (m.metadata || {}) as Record<string, any>;
                  const role = meta.role || 'developer';
                  const alloc = meta.allocation || 0;
                  const colorIdx = idx % AVATAR_COLORS.length;
                  const initial = (m.assigneeName || m.title || '?')[0].toUpperCase();
                  return (
                    <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[colorIdx]} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{m.assigneeName || m.title}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role] || ROLE_COLORS.developer}`}>
                            {ROLE_LABELS[role] || role}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 flex items-center gap-1"><Percent size={10} />配置</span>
                          <span className={`font-bold ${alloc > 80 ? 'text-red-500' : alloc > 50 ? 'text-amber-500' : 'text-sky-500'}`}>{alloc}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              alloc > 80 ? 'bg-red-400' : alloc > 50 ? 'bg-amber-400' : 'bg-sky-400'
                            }`}
                            style={{ width: `${alloc}%` }}
                          />
                        </div>
                        {m.description && (
                          <p className="text-[11px] text-gray-400 mt-2 line-clamp-2">{m.description}</p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1"><Mail size={10} />{meta.email || '無 Email'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                <UserPlus className="mx-auto text-gray-300 mb-4" size={40} />
                <p className="text-gray-400 text-sm">尚無團隊成員</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">新增團隊成員</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">成員姓名 *</label>
                <input type="text" value={form.assigneeName} onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  placeholder="輸入成員姓名" list="user-list" />
                <datalist id="user-list">
                  {users.map(u => (
                    <option key={u.id} value={u.username} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">角色</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">配置比例 (%)</label>
                <input type="range" min={0} max={100} value={form.allocation}
                  onChange={(e) => setForm({ ...form, allocation: Number(e.target.value) })}
                  className="w-full accent-sky-500" />
                <div className="text-center text-sm font-bold text-sky-600 mt-1">{form.allocation}%</div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.assigneeName.trim()) { toast.error('請輸入成員姓名'); return; }
                  createMutation.mutate({
                    title: form.assigneeName,
                    assigneeName: form.assigneeName,
                    status: 'active',
                    priority: 'medium',
                    metadata: { role: form.role, allocation: form.allocation },
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? '新增中...' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
