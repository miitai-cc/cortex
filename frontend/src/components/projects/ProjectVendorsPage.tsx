import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Truck, Plus, ChevronDown, Star, Phone, Mail, Search, Filter, FileText, CheckCircle2, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

type FilterStatus = 'all' | 'active' | 'evaluating' | 'inactive';

const VENDOR_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: '合作中', color: 'bg-emerald-100 text-emerald-700' },
  evaluating: { label: '評估中', color: 'bg-blue-100 text-blue-700' },
  inactive: { label: '已終止', color: 'bg-gray-100 text-gray-600' },
};

export default function ProjectVendorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', assigneeName: '', status: 'active',
    taxId: '', phone: '', email: '', rating: 3,
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'vendor', data),
    onSuccess: () => {
      toast.success('廠商已新增');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', assigneeName: '', status: 'active', taxId: '', phone: '', email: '', rating: 3 });
    },
    onError: () => toast.error('新增失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const vendors = records.filter(r => r.recordType === 'vendor');

  const filtered = useMemo(() => {
    return vendors.filter(v => {
      if (filter === 'active' && v.status !== 'active') return false;
      if (filter === 'evaluating' && v.status !== 'evaluating') return false;
      if (filter === 'inactive' && v.status !== 'inactive') return false;
      if (searchTerm) {
        return v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (v.assigneeName || '').toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });
  }, [vendors, filter, searchTerm]);

  const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={12} className={s <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50">
      <CommonHeroTitle
        icon={Truck}
        title="廠商管理"
        description="管理專案合作廠商與合約資訊"
        breadcrumb={['專案管理', '廠商管理']}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select value={projectId} onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-orange-500 outline-none shadow-sm">
              <option value="">選擇專案</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋廠商..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['all', 'active', 'evaluating', 'inactive'] as FilterStatus[]).map(f => {
              const labels: Record<FilterStatus, string> = { all: '全部', active: '合作中', evaluating: '評估中', inactive: '已終止' };
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filter === f ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-500 hover:bg-white'
                  }`}>
                  {labels[f]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('table')}
              className={`px-2 py-1 rounded text-xs ${viewMode === 'table' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>表格</button>
            <button onClick={() => setViewMode('cards')}
              className={`px-2 py-1 rounded text-xs ${viewMode === 'cards' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>卡片</button>
          </div>

          {projectId && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition-colors shadow-sm ml-auto">
              <Plus size={14} />
              新增廠商
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-200 border-t-orange-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Truck className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">廠商名稱</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">統編</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">聯絡人</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">電話</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">狀態</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">評分</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">合約</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(vendor => {
                      const meta = (vendor.metadata || {}) as Record<string, any>;
                      const status = VENDOR_STATUS[vendor.status] || VENDOR_STATUS.active;
                      const rating = meta.rating || 3;
                      return (
                        <tr key={vendor.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                                {vendor.title[0]?.toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-800">{vendor.title}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-500 font-mono text-xs">{meta.taxId || '-'}</td>
                          <td className="px-5 py-3 text-gray-600">{vendor.assigneeName || '-'}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{meta.phone || '-'}</td>
                          <td className="px-5 py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-3"><StarRating rating={rating} /></td>
                          <td className="px-5 py-3 text-xs text-gray-500">
                            {meta.contractPeriod || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-sm">無廠商記錄</div>
            )}
          </div>
        ) : (
          /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(vendor => {
              const meta = (vendor.metadata || {}) as Record<string, any>;
              const status = VENDOR_STATUS[vendor.status] || VENDOR_STATUS.active;
              const rating = meta.rating || 3;
              return (
                <div key={vendor.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold shadow-sm">
                      {vendor.title[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-800 truncate">{vendor.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-500 mb-3">
                    {meta.taxId && <p>統編：{meta.taxId}</p>}
                    {vendor.assigneeName && <p className="flex items-center gap-1"><User size={10} />{vendor.assigneeName}</p>}
                    {meta.phone && <p className="flex items-center gap-1"><Phone size={10} />{meta.phone}</p>}
                    {meta.email && <p className="flex items-center gap-1"><Mail size={10} />{meta.email}</p>}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <StarRating rating={rating} />
                    {meta.contractPeriod && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <FileText size={10} />
                        {meta.contractPeriod}
                      </span>
                    )}
                  </div>

                  {meta.contractAmount && (
                    <div className="mt-2 text-xs text-gray-400">
                      合約金額：${Number(meta.contractAmount).toLocaleString()}
                    </div>
                  )}

                  {meta.paymentTerms && (
                    <div className="mt-1 text-[10px] text-gray-400">
                      付款條件：{meta.paymentTerms}
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
              <h3 className="text-lg font-bold text-gray-800">新增廠商</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">廠商名稱 *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="公司名稱" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">統一編號</label>
                  <input type="text" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="8位數字" maxLength={8} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">狀態</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none">
                    <option value="active">合作中</option>
                    <option value="evaluating">評估中</option>
                    <option value="inactive">已終止</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">聯絡人</label>
                  <input type="text" value={form.assigneeName} onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="聯絡人姓名" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">電話</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="電話號碼" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">評分（1-5）</label>
                  <input type="range" min={1} max={5} value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                    className="w-full accent-orange-500" />
                  <div className="flex items-center gap-1 mt-1">
                    <StarRating rating={form.rating} />
                    <span className="text-xs text-gray-500 ml-1">{form.rating}/5</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">備註</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
                  placeholder="廠商備註" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入廠商名稱'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    assigneeName: form.assigneeName || undefined,
                    status: form.status,
                    priority: 'medium',
                    metadata: {
                      taxId: form.taxId || undefined,
                      phone: form.phone || undefined,
                      email: form.email || undefined,
                      rating: form.rating,
                    },
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? '新增中...' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
