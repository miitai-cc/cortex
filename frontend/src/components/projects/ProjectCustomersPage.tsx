import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Plus, ChevronDown, ChevronRight, Phone, Mail, Search, User, FileText, History } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

type FilterStatus = 'all' | 'active' | 'inactive';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '合作中', color: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: '已終止', color: 'bg-gray-100 text-gray-600' },
  prospecting: { label: '洽談中', color: 'bg-blue-100 text-blue-700' },
};

const AVATAR_COLORS = [
  'from-teal-400 to-teal-500',
  'from-indigo-400 to-indigo-500',
  'from-rose-400 to-rose-500',
  'from-amber-400 to-amber-500',
  'from-purple-400 to-purple-500',
];

export default function ProjectCustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', assigneeName: '', status: 'active',
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'customer', data),
    onSuccess: () => {
      toast.success('客戶已新增');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', assigneeName: '', status: 'active' });
    },
    onError: () => toast.error('新增失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const customers = records.filter(r => r.recordType === 'customer');

  const filtered = useMemo(() => {
    return customers.filter(c => {
      if (filter === 'active' && c.status !== 'active' && c.status !== 'prospecting') return false;
      if (filter === 'inactive' && c.status !== 'inactive') return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return c.title.toLowerCase().includes(term) || (c.assigneeName || '').toLowerCase().includes(term) ||
          (c.description || '').toLowerCase().includes(term);
      }
      return true;
    });
  }, [customers, filter, searchTerm]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <CommonHeroTitle
        icon={Building2}
        title="客戶管理"
        description="管理專案相關客戶資訊與互動紀錄"
        breadcrumb={['專案管理', '客戶管理']}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select value={projectId} onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-cyan-500 outline-none shadow-sm">
              <option value="">選擇專案</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋客戶..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none" />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['all', 'active', 'inactive'] as FilterStatus[]).map(f => {
              const labels: Record<FilterStatus, string> = { all: '全部', active: '合作中', inactive: '已終止' };
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === f ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-500 hover:bg-white'
                  }`}>
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {projectId && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition-colors shadow-sm ml-auto">
              <Plus size={14} />
              新增客戶
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-200 border-t-cyan-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Building2 className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Building2 className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-sm">無客戶記錄</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((customer, idx) => {
              const meta = (customer.metadata || {}) as Record<string, any>;
              const status = STATUS_MAP[customer.status] || STATUS_MAP.active;
              const isExpanded = expandedId === customer.id;
              const colorIdx = idx % AVATAR_COLORS.length;
              const initial = customer.title[0]?.toUpperCase() || '?';
              return (
                <div key={customer.id}
                  className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all ${isExpanded ? 'ring-2 ring-cyan-300' : ''}`}>
                  {/* Card Header */}
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[colorIdx]} flex items-center justify-center text-white font-bold text-base shadow-sm`}>
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-800 truncate">{customer.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>

                    {customer.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{customer.description}</p>
                    )}

                    <div className="space-y-1.5 text-xs text-gray-500">
                      {customer.assigneeName && (
                        <div className="flex items-center gap-2">
                          <User size={12} className="text-gray-400" />
                          <span>{customer.assigneeName}</span>
                        </div>
                      )}
                      {meta.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-gray-400" />
                          <span>{meta.phone}</span>
                        </div>
                      )}
                      {meta.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-gray-400" />
                          <span>{meta.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expand Toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                    className="w-full flex items-center justify-center gap-1 py-2 bg-gray-50 text-gray-400 text-xs hover:bg-gray-100 transition-colors"
                  >
                    {isExpanded ? '收合' : '展開詳情'}
                    <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
                      {meta.contracts && Array.isArray(meta.contracts) && meta.contracts.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
                            <FileText size={10} /> 合約
                          </h4>
                          {meta.contracts.map((c: any, i: number) => (
                            <div key={i} className="text-xs text-gray-600 bg-white rounded-lg p-2 mb-1">
                              {typeof c === 'string' ? c : c.name || JSON.stringify(c)}
                            </div>
                          ))}
                        </div>
                      )}
                      {meta.interactions && Array.isArray(meta.interactions) && meta.interactions.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
                            <History size={10} /> 互動紀錄
                          </h4>
                          {meta.interactions.map((inter: any, i: number) => (
                            <div key={i} className="text-xs text-gray-600 bg-white rounded-lg p-2 mb-1">
                              {typeof inter === 'string' ? inter : inter.note || JSON.stringify(inter)}
                            </div>
                          ))}
                        </div>
                      )}
                      {meta.projectLinks && Array.isArray(meta.projectLinks) && meta.projectLinks.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-gray-500 mb-1">關聯專案</h4>
                          {meta.projectLinks.map((link: string, i: number) => (
                            <span key={i} className="inline-block text-[10px] bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full mr-1">
                              {link}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                        建立：{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('zh-TW') : '-'}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">新增客戶</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">公司名稱 *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  placeholder="公司名稱" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">聯絡人</label>
                <input type="text" value={form.assigneeName} onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  placeholder="聯絡人姓名" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">狀態</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none">
                    <option value="active">合作中</option>
                    <option value="prospecting">洽談中</option>
                    <option value="inactive">已終止</option>
                  </select>
                </div>
                <div />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">備註</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
                  placeholder="客戶備註" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入公司名稱'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    assigneeName: form.assigneeName || undefined,
                    status: form.status,
                    priority: 'medium',
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? '新增中...' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
