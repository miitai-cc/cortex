import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DollarSign, ChevronDown, TrendingUp, TrendingDown, Wallet, AlertTriangle, PieChart, BarChart3 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

export default function ProjectBudgetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const budgetItems = records.filter(r => r.recordType === 'budget');
  const stats = overview?.stats;
  const selectedProject = overview?.selectedProject;

  const totalBudget = selectedProject?.budgetTotal || 0;
  const spent = stats?.budgetSpent || 0;
  const committed = stats?.budgetCommitted || 0;
  const remaining = totalBudget - spent - committed;
  const usagePercent = totalBudget > 0 ? Math.round(((spent + committed) / totalBudget) * 100) : 0;

  const budgetByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    budgetItems.forEach(item => {
      const cat = item.status || '未分類';
      map[cat] = (map[cat] || 0) + (item.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [budgetItems]);

  const monthlySpending = useMemo(() => {
    const map: Record<string, number> = {};
    budgetItems.forEach(item => {
      if (item.startDate) {
        const month = item.startDate.slice(0, 7);
        map[month] = (map[month] || 0) + (item.amount || 0);
      }
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([month, amount]) => ({ month, amount }));
  }, [budgetItems]);

  const maxMonthly = Math.max(...monthlySpending.map(m => m.amount), 1);

  const donutColors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  const circumference = 2 * Math.PI * 42;
  const donutSegments = useMemo(() => {
    if (budgetByCategory.length === 0) return [];
    const total = budgetByCategory.reduce((s, c) => s + c.value, 0);
    let offset = 0;
    return budgetByCategory.map((cat, i) => {
      const pct = total > 0 ? cat.value / total : 0;
      const dashArray = `${pct * circumference} ${circumference}`;
      const dashOffset = -offset * circumference;
      offset += pct;
      return { ...cat, dashArray, dashOffset, color: donutColors[i % donutColors.length] };
    });
  }, [budgetByCategory]);

  const usageColor = usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const usageWarning = usagePercent > 90;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <CommonHeroTitle
        icon={DollarSign}
        title="專案預算"
        description="預算分配與支出追蹤"
        breadcrumb={['專案管理', '專案預算']}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Selector */}
        <div className="mb-6">
          <div className="relative inline-block w-full max-w-md">
            <select
              value={projectId}
              onChange={(e) => setSearchParams({ project: e.target.value })}
              className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm"
            >
              <option value="">選擇專案</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <DollarSign className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <Wallet size={16} />
                  <span className="text-xs">總預算</span>
                </div>
                <p className="text-2xl font-bold">${totalBudget.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-red-400 to-red-500 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <TrendingDown size={16} />
                  <span className="text-xs">已支出</span>
                </div>
                <p className="text-2xl font-bold">${spent.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <TrendingUp size={16} />
                  <span className="text-xs">已承諾</span>
                </div>
                <p className="text-2xl font-bold">${committed.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <DollarSign size={16} />
                  <span className="text-xs">剩餘</span>
                </div>
                <p className="text-2xl font-bold">${remaining.toLocaleString()}</p>
              </div>
            </div>

            {/* Usage Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">預算使用率</span>
                <div className="flex items-center gap-2">
                  {usageWarning && <AlertTriangle size={14} className="text-red-500" />}
                  <span className={`text-sm font-bold ${usagePercent > 90 ? 'text-red-600' : usagePercent > 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {usagePercent}%
                  </span>
                </div>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${usageColor}`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              {usageWarning && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  預算即將用盡，請注意控制支出
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Donut Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <PieChart size={16} className="text-indigo-500" />
                  預算分配
                </h3>
                {budgetByCategory.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <svg width="120" height="120" viewBox="0 0 100 100">
                        {donutSegments.map((seg, i) => (
                          <circle
                            key={i}
                            cx="50" cy="50" r="42"
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="14"
                            strokeDasharray={seg.dashArray}
                            strokeDashoffset={seg.dashOffset}
                            transform="rotate(-90 50 50)"
                          />
                        ))}
                        <text x="50" y="48" textAnchor="middle" className="text-[10px] fill-gray-500 font-medium">總計</text>
                        <text x="50" y="60" textAnchor="middle" className="text-[12px] fill-gray-800 font-bold">
                          ${(spent + committed).toLocaleString()}
                        </text>
                      </svg>
                    </div>
                    <div className="flex-1 space-y-2">
                      {donutSegments.map((seg, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                          <span className="text-xs text-gray-600 flex-1 truncate">{seg.name}</span>
                          <span className="text-xs font-medium text-gray-800">${seg.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400 text-sm">暫無預算分配資料</div>
                )}
              </div>

              {/* Monthly Bar Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <BarChart3 size={16} className="text-emerald-500" />
                  月度支出趨勢
                </h3>
                {monthlySpending.length > 0 ? (
                  <div className="space-y-3">
                    {monthlySpending.map((m, i) => (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-500 w-16 text-right">{m.month}</span>
                        <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${(m.amount / maxMonthly) * 100}%` }}
                          >
                            <span className="text-[9px] text-white font-bold">${m.amount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400 text-sm">暫無月度支出資料</div>
                )}
              </div>
            </div>

            {/* Budget Items Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-700">預算項目明細</h3>
              </div>
              {budgetItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">項目名稱</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">分類</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">金額</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">狀態</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">供應商</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {budgetItems.map(item => {
                        const meta = (item.metadata || {}) as Record<string, any>;
                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50">
                            <td className="px-5 py-3 text-gray-800 font-medium">{item.title}</td>
                            <td className="px-5 py-3 text-gray-500">{item.status || '未分類'}</td>
                            <td className="px-5 py-3 text-right font-mono text-gray-800">${(item.amount || 0).toLocaleString()}</td>
                            <td className="px-5 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                item.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                item.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {item.status || '未分類'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs">{meta.vendor || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">
                  暫無預算項目
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
