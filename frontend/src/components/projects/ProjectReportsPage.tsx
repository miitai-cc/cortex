import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileBarChart, ChevronDown, FileText, Calendar, TrendingUp, Download, Printer, Eye, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';

type TemplateType = 'weekly' | 'monthly' | 'closing';

const templates: { id: TemplateType; title: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: 'weekly', title: '週報', desc: '每週進度與風險彙報', icon: <Calendar size={20} />, color: 'from-blue-500 to-blue-600' },
  { id: 'monthly', title: '月報', desc: '月度績效與預算分析', icon: <TrendingUp size={20} />, color: 'from-purple-500 to-purple-600' },
  { id: 'closing', title: '結案報告', desc: '專案成果與經驗總結', icon: <FileText size={20} />, color: 'from-emerald-500 to-emerald-600' },
];

export default function ProjectReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const projects = overview?.projects || [];
  const stats = overview?.stats;
  const records = overview?.records || [];
  const selectedProject = overview?.selectedProject;

  const tasks = records.filter(r => r.recordType === 'task');
  const milestones = records.filter(r => r.recordType === 'milestone');
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'done');
  const overdueTasks = tasks.filter(t => t.endDate && new Date(t.endDate) < new Date() && t.status !== 'completed');
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const historyReports = records.filter(r => r.recordType === 'audit' && (r.metadata as Record<string, any>)?.reportType);

  const generateReport = () => {
    setPreviewMode(true);
    toast.success('報告已生成');
  };

  const exportPDF = () => toast.success('已匯出 PDF（模擬）');
  const exportExcel = () => toast.success('已匯出 Excel（模擬）');
  const printReport = () => toast.success('列印功能開發中');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <CommonHeroTitle
        icon={FileBarChart}
        title="報告"
        description="專案報告生成與管理"
        breadcrumb={['專案管理', '報告']}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Selector */}
        <div className="mb-6">
          <div className="relative inline-block w-full max-w-md">
            <select value={projectId} onChange={(e) => setSearchParams({ project: e.target.value })}
              className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm">
              <option value="">選擇專案</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <FileBarChart className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : !previewMode ? (
          <>
            {/* Template Cards */}
            <h3 className="text-sm font-bold text-gray-700 mb-4">選擇報告範本</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`bg-white rounded-2xl p-5 border-2 cursor-pointer transition-all hover:shadow-lg ${
                    selectedTemplate === t.id ? 'border-indigo-400 shadow-md' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center text-white mb-4 shadow-sm`}>
                    {t.icon}
                  </div>
                  <h4 className="text-base font-bold text-gray-800 mb-1">{t.title}</h4>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                </div>
              ))}
            </div>

            {/* Quick Stats Preview */}
            {selectedTemplate && selectedProject && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4">報告摘要預覽</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-600">{tasks.length}</p>
                    <p className="text-[10px] text-blue-400">任務總數</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-emerald-600">{completionRate}%</p>
                    <p className="text-[10px] text-emerald-400">完成率</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-purple-600">{milestones.length}</p>
                    <p className="text-[10px] text-purple-400">里程碑</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-red-600">{overdueTasks.length}</p>
                    <p className="text-[10px] text-red-400">逾期任務</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <button onClick={generateReport}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                    生成 {templates.find(t => t.id === selectedTemplate)?.title}
                  </button>
                </div>
              </div>
            )}

            {/* History */}
            {historyReports.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Clock size={14} className="text-gray-400" />
                  歷史報告
                </h3>
                <div className="space-y-2">
                  {historyReports.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      <FileBarChart size={14} className="text-indigo-400" />
                      <span className="text-sm text-gray-700 flex-1">{r.title}</span>
                      <span className="text-[10px] text-gray-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('zh-TW') : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Report Preview */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => setPreviewMode(false)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                ← 返回範本選擇
              </button>
              <div className="flex items-center gap-2">
                <button onClick={exportPDF}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
                  <Download size={12} /> PDF
                </button>
                <button onClick={exportExcel}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors">
                  <Download size={12} /> Excel
                </button>
                <button onClick={printReport}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors">
                  <Printer size={12} /> 列印
                </button>
              </div>
            </div>

            {/* Report Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 text-white">
                <h1 className="text-xl font-bold">{selectedProject?.name} - {templates.find(t => t.id === selectedTemplate)?.title}</h1>
                <p className="text-indigo-200 text-sm mt-1">報告日期：{new Date().toLocaleDateString('zh-TW')}</p>
              </div>

              <div className="p-8 space-y-8">
                {/* Summary Section */}
                <div>
                  <h2 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">一、專案摘要</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-lg font-bold text-gray-800">{tasks.length}</p>
                      <p className="text-[10px] text-gray-400">任務總數</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-lg font-bold text-emerald-600">{completedTasks.length}</p>
                      <p className="text-[10px] text-gray-400">已完成</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-lg font-bold text-amber-600">{milestones.length}</p>
                      <p className="text-[10px] text-gray-400">里程碑</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-lg font-bold text-red-600">{overdueTasks.length}</p>
                      <p className="text-[10px] text-gray-400">逾期任務</p>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <h2 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">二、進度概況</h2>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>整體完成率</span>
                      <span className="font-bold text-indigo-600">{completionRate}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full" style={{ width: `${completionRate}%` }} />
                    </div>
                  </div>
                </div>

                {/* Milestones */}
                <div>
                  <h2 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">三、里程碑進度</h2>
                  {milestones.length > 0 ? (
                    <div className="space-y-2">
                      {milestones.map(m => (
                        <div key={m.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className={`w-2 h-2 rounded-full ${m.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="text-xs text-gray-700 flex-1">{m.title}</span>
                          <span className="text-[10px] text-gray-400">{m.endDate || '-'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">暫無里程碑</p>
                  )}
                </div>

                {/* Risk Summary */}
                <div>
                  <h2 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">四、風險摘要</h2>
                  <p className="text-xs text-gray-500">此報告由系統自動生成，僅供參考。</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
