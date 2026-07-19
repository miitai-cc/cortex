import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield, Plus, ChevronDown, AlertTriangle, User, Target, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord, ProjectPriority } from '../../types/projects';

interface RiskDot {
  id: string;
  title: string;
  probability: number;
  impact: number;
  level: string;
  owner: string;
  status: string;
}

const LEVEL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', label: '高風險' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: '中風險' },
  low: { bg: 'bg-green-100', text: 'text-green-700', label: '低風險' },
};

function getRiskLevel(prob: number, impact: number): string {
  const score = prob * impact;
  if (score >= 12) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

function getCellColor(prob: number, impact: number): string {
  const score = prob * impact;
  if (score >= 12) return 'bg-red-100 border-red-200';
  if (score >= 8) return 'bg-orange-50 border-orange-200';
  if (score >= 5) return 'bg-amber-50 border-amber-200';
  if (score >= 2) return 'bg-yellow-50 border-yellow-200';
  return 'bg-green-50 border-green-200';
}

export default function ProjectRisksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [filterLevel, setFilterLevel] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', probability: 3, impact: 3, assigneeName: '', mitigation: '',
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'requirement', data),
    onSuccess: () => {
      toast.success('風險已建立');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', probability: 3, impact: 3, assigneeName: '', mitigation: '' });
    },
    onError: () => toast.error('建立失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];

  const risks: RiskDot[] = useMemo(() => {
    return records.filter(r => {
      const meta = (r.metadata || {}) as Record<string, any>;
      return meta.probability !== undefined || r.recordType === 'requirement';
    }).map(r => {
      const meta = (r.metadata || {}) as Record<string, any>;
      const prob = meta.probability || 1;
      const impact = meta.impact || 1;
      return {
        id: r.id,
        title: r.title,
        probability: prob,
        impact: impact,
        level: getRiskLevel(prob, impact),
        owner: r.assigneeName || '',
        status: r.status || 'open',
      };
    });
  }, [records]);

  const filtered = risks.filter(r => {
    if (filterLevel && r.level !== filterLevel) return false;
    return true;
  });

  const stats = useMemo(() => ({
    total: risks.length,
    high: risks.filter(r => r.level === 'high').length,
    medium: risks.filter(r => r.level === 'medium').length,
    low: risks.filter(r => r.level === 'low').length,
  }), [risks]);

  const probLabels = ['極低', '低', '中', '高', '極高'];
  const impactLabels = ['極低', '低', '中', '高', '極高'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50">
      <CommonHeroTitle
        icon={Shield}
        title="風險管理"
        description="識別、評估與追蹤專案風險"
        breadcrumb={['專案管理', '風險管理']}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select value={projectId} onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-red-500 outline-none shadow-sm">
              <option value="">選擇專案</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-red-500 outline-none">
              <option value="">全部等級</option>
              <option value="high">高風險</option>
              <option value="medium">中風險</option>
              <option value="low">低風險</option>
            </select>
          </div>

          {projectId && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors shadow-sm ml-auto">
              <Plus size={14} />
              新增風險
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-[11px] text-gray-400 mt-1">總風險</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-red-600">{stats.high}</p>
            <p className="text-[11px] text-gray-400 mt-1">高風險</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.medium}</p>
            <p className="text-[11px] text-gray-400 mt-1">中風險</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-green-600">{stats.low}</p>
            <p className="text-[11px] text-gray-400 mt-1">低風險</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-red-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Shield className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 5x5 Risk Matrix */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">風險矩陣（機率 × 影響）</h3>
              <div className="relative">
                {/* Y-axis label */}
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-gray-400 font-medium whitespace-nowrap">
                  機率 →
                </div>
                {/* Matrix Grid */}
                <div className="grid grid-cols-5 gap-1 ml-4">
                  {[5, 4, 3, 2, 1].map(prob => (
                    <React.Fragment key={prob}>
                      {[1, 2, 3, 4, 5].map(impact => {
                        const cellRisks = filtered.filter(r => r.probability === prob && r.impact === impact);
                        return (
                          <div
                            key={`${prob}-${impact}`}
                            className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-center relative ${getCellColor(prob, impact)}`}
                          >
                            {cellRisks.map(r => (
                              <div
                                key={r.id}
                                title={`${r.title} (${r.owner})`}
                                className={`w-4 h-4 rounded-full border-2 border-white shadow-sm cursor-pointer z-10 ${
                                  r.level === 'high' ? 'bg-red-500' :
                                  r.level === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                                }`}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
                {/* X-axis labels */}
                <div className="grid grid-cols-5 gap-1 ml-4 mt-1">
                  {impactLabels.map(l => (
                    <div key={l} className="text-center text-[9px] text-gray-400">{l}</div>
                  ))}
                </div>
                <div className="text-center text-[10px] text-gray-400 mt-1 font-medium">影響程度 →</div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-[10px] text-gray-500">高風險</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-gray-500">中風險</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-[10px] text-gray-500">低風險</span>
                </div>
              </div>
            </div>

            {/* Risk List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs font-medium text-gray-500">風險清單（{filtered.length}）</span>
              </div>
              <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-50">
                {filtered.length > 0 ? filtered.map(risk => {
                  const style = LEVEL_COLORS[risk.level] || LEVEL_COLORS.low;
                  return (
                    <div key={risk.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={14} className={risk.level === 'high' ? 'text-red-500' : risk.level === 'medium' ? 'text-amber-500' : 'text-green-500'} />
                          <h4 className="text-sm font-medium text-gray-800">{risk.title}</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-gray-400">
                        <span>機率：{risk.probability}/5</span>
                        <span>影響：{risk.impact}/5</span>
                        {risk.owner && <span className="flex items-center gap-1"><User size={9} />{risk.owner}</span>}
                        <span>狀態：{risk.status}</span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-12 text-center text-gray-400 text-sm">無符合條件的風險</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">新增風險</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">風險名稱 *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="風險名稱" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">描述</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                  placeholder="風險描述" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">機率（1-5）</label>
                  <input type="range" min={1} max={5} value={form.probability}
                    onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
                    className="w-full accent-red-500" />
                  <div className="text-center text-xs font-bold text-red-600">{form.probability} - {probLabels[form.probability - 1]}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">影響（1-5）</label>
                  <input type="range" min={1} max={5} value={form.impact}
                    onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })}
                    className="w-full accent-red-500" />
                  <div className="text-center text-xs font-bold text-red-600">{form.impact} - {impactLabels[form.impact - 1]}</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">緩解策略</label>
                <textarea value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                  placeholder="此風險的緩解策略" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">負責人</label>
                <input type="text" value={form.assigneeName} onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="負責人姓名" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入風險名稱'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    priority: getRiskLevel(form.probability, form.impact) === 'high' ? 'critical' :
                              getRiskLevel(form.probability, form.impact) === 'medium' ? 'high' : 'medium',
                    assigneeName: form.assigneeName || undefined,
                    status: 'open',
                    metadata: {
                      probability: form.probability,
                      impact: form.impact,
                      mitigation: form.mitigation || undefined,
                    },
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? '建立中...' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
