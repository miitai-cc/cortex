import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GanttChart, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Edit3, Flag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

type TimeScale = 'day' | 'week' | 'month';

function getDaysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function ProjectGanttPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const [timeScale, setTimeScale] = useState<TimeScale>('week');
  const [viewStart, setViewStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  });
  const [selectedTask, setSelectedTask] = useState<ProjectRecord | null>(null);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const tasks = records.filter(r => r.recordType === 'task' && r.startDate && r.endDate);

  const viewDays = timeScale === 'day' ? 30 : timeScale === 'week' ? 84 : 180;
  const viewEnd = formatDate(addDays(new Date(viewStart), viewDays));

  const columns = useMemo(() => {
    const cols: string[] = [];
    for (let i = 0; i < viewDays; i++) {
      cols.push(formatDate(addDays(new Date(viewStart), i)));
    }
    return cols;
  }, [viewStart, viewDays]);

  const today = formatDate(new Date());

  const getBarStyle = (task: ProjectRecord) => {
    const start = new Date(task.startDate!);
    const end = new Date(task.endDate!);
    const vStart = new Date(viewStart);
    const startOffset = Math.max(0, Math.ceil((start.getTime() - vStart.getTime()) / (1000 * 60 * 60 * 24)));
    const duration = Math.max(1, getDaysBetween(task.startDate!, task.endDate!));
    const left = (startOffset / viewDays) * 100;
    const width = (duration / viewDays) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 1)}%` };
  };

  const priorityBarColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-400',
    medium: 'bg-blue-400',
    low: 'bg-gray-400',
  };

  const todayOffset = useMemo(() => {
    const vStart = new Date(viewStart);
    const t = new Date(today);
    return ((t.getTime() - vStart.getTime()) / (1000 * 60 * 60 * 24) / viewDays) * 100;
  }, [viewStart, viewDays, today]);

  const jumpToToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setViewStart(formatDate(d));
  };

  const scaleLabels: Record<TimeScale, string> = { day: '日', week: '週', month: '月' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <CommonHeroTitle
        icon={GanttChart}
        title="Gantt Chart"
        description="互動式甘特圖時間軸"
        breadcrumb={['專案管理', 'Gantt Chart']}
      />

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <select
                value={projectId}
                onChange={(e) => setSearchParams({ project: e.target.value })}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
              >
                <option value="">選擇專案</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>

            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['day', 'week', 'month'] as TimeScale[]).map(s => (
                <button
                  key={s}
                  onClick={() => setTimeScale(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    timeScale === s ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
                  }`}
                >
                  {scaleLabels[s]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => { const d = addDays(new Date(viewStart), -viewDays / 2); setViewStart(formatDate(d)); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronLeft size={16} />
              </button>
              <button onClick={jumpToToday} className="px-3 py-1 text-xs bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 font-medium">
                今天
              </button>
              <button onClick={() => { const d = addDays(new Date(viewStart), viewDays / 2); setViewStart(formatDate(d)); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => { const d = addDays(new Date(viewStart), -7); setViewStart(formatDate(d)); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-gray-400">缩放</span>
              <button onClick={() => { const d = addDays(new Date(viewStart), 7); setViewStart(formatDate(d)); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ZoomIn size={16} />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-200 border-t-cyan-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <GanttChart className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header row - dates */}
            <div className="flex border-b border-gray-200">
              <div className="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-200 px-4 py-2">
                <span className="text-xs font-semibold text-gray-500">任務名稱</span>
              </div>
              <div className="flex-1 relative overflow-x-auto">
                <div className="flex" style={{ minWidth: `${viewDays * 24}px` }}>
                  {columns.map((date, i) => {
                    const d = new Date(date);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isMonthStart = d.getDate() === 1;
                    return (
                      <div
                        key={date}
                        className={`flex-shrink-0 border-r border-gray-100 text-center py-2 ${
                          isWeekend ? 'bg-gray-50' : ''
                        } ${isMonthStart ? 'border-l-2 border-l-gray-300' : ''}`}
                        style={{ width: '24px', minWidth: '24px' }}
                      >
                        {(i === 0 || isMonthStart) && (
                          <div className="text-[9px] text-gray-400 font-medium">
                            {d.getMonth() + 1}/{d.getDate()}
                          </div>
                        )}
                        <div className="text-[8px] text-gray-300">
                          {d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Today marker */}
                {todayOffset >= 0 && todayOffset <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${todayOffset}%` }}
                  >
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded-b">今天</div>
                  </div>
                )}
              </div>
            </div>

            {/* Task rows */}
            {tasks.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                此專案尚無已排程的任務
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {tasks.map((task) => {
                  const barStyle = getBarStyle(task);
                  const barColor = priorityBarColors[task.priority] || 'bg-gray-400';
                  const progress = task.progress || 0;
                  return (
                    <div key={task.id} className="flex hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setSelectedTask(task)}>
                      <div className="w-56 flex-shrink-0 border-r border-gray-100 px-4 py-3">
                        <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            task.priority === 'critical' ? 'bg-red-100 text-red-700' :
                            task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            task.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {task.priority === 'critical' ? '緊急' : task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                          </span>
                          {task.assigneeName && (
                            <span className="text-[10px] text-gray-400">{task.assigneeName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 relative py-3" style={{ minWidth: `${viewDays * 24}px` }}>
                        <div
                          className={`absolute h-6 rounded-md ${barColor} shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
                          style={barStyle}
                        >
                          <div
                            className="h-full rounded-md bg-white/30"
                            style={{ width: `${progress}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-sm">
                            {progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Task detail popup */}
        {selectedTask && (
          <div className="fixed bottom-6 right-6 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-5 z-50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-gray-800 text-sm">{selectedTask.title}</h4>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600">
                <span className="text-lg">&times;</span>
              </button>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>負責人</span>
                <span className="font-medium">{selectedTask.assigneeName || '未指派'}</span>
              </div>
              <div className="flex justify-between">
                <span>起迄日</span>
                <span className="font-medium">{selectedTask.startDate} ~ {selectedTask.endDate}</span>
              </div>
              <div className="flex justify-between">
                <span>進度</span>
                <span className="font-medium">{selectedTask.progress || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span>狀態</span>
                <span className="font-medium">{selectedTask.status}</span>
              </div>
            </div>
            <button
              onClick={() => { toast.success('功能開發中'); }}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-50 text-cyan-700 rounded-lg text-xs font-medium hover:bg-cyan-100 transition-colors"
            >
              <Edit3 size={12} />
              編輯任務
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
