import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, ChevronDown, MapPin, Clock, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const typeStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  task: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400', label: '任務' },
  milestone: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-400', label: '里程碑' },
  meeting: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400', label: '會議' },
  budget: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-400', label: '預算' },
  audit: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400', label: '稽核' },
};

export default function ProjectCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];

  const eventsByDate = useMemo(() => {
    const map: Record<string, ProjectRecord[]> = {};
    records.forEach(r => {
      const date = r.endDate || r.startDate;
      if (date) {
        if (!map[date]) map[date] = [];
        map[date].push(r);
      }
    });
    return map;
  }, [records]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);

  const calendarDays = useMemo(() => {
    const days: Array<{ day: number; month: number; year: number; isCurrentMonth: boolean; dateKey: string }> = [];
    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = currentMonth === 0 ? 11 : currentMonth - 1;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      days.push({ day: d, month: m, year: y, isCurrentMonth: false, dateKey: formatDateKey(y, m, d) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, month: currentMonth, year: currentYear, isCurrentMonth: true, dateKey: formatDateKey(currentYear, currentMonth, d) });
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 11 ? 0 : currentMonth + 1;
      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
      days.push({ day: d, month: m, year: y, isCurrentMonth: false, dateKey: formatDateKey(y, m, d) });
    }
    return days;
  }, [currentYear, currentMonth, daysInMonth, firstDay, prevMonthDays]);

  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
    setSelectedDate(null);
  };

  const jumpToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(todayKey);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50">
      <CommonHeroTitle
        icon={CalIcon}
        title="工作日曆"
        description="月曆檢視專案事件與行程"
        breadcrumb={['專案管理', '工作日曆']}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
            >
              <option value="">選擇專案</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={jumpToToday} className="px-3 py-2 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 font-medium border border-amber-200">
              回到今天
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Month Navigation */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-100">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/80 text-gray-500 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <h2 className="text-lg font-bold text-gray-800">
                  {currentYear} 年 {MONTHS[currentMonth]}
                </h2>
                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/80 text-gray-500 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
                {WEEKDAYS.map((w, i) => (
                  <div key={w} className={`text-center py-2 text-xs font-semibold ${i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500'}`}>
                    {w}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-amber-200 border-t-amber-600" />
                </div>
              ) : (
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, idx) => {
                    const events = eventsByDate[day.dateKey] || [];
                    const isToday = day.dateKey === todayKey;
                    const isSelected = day.dateKey === selectedDate;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDate(day.dateKey)}
                        className={`min-h-[80px] border-r border-b border-gray-50 p-1.5 cursor-pointer transition-colors ${
                          day.isCurrentMonth ? 'bg-white hover:bg-amber-50/50' : 'bg-gray-50/50 hover:bg-gray-100/50'
                        } ${isSelected ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/80' : ''}`}
                      >
                        <div className={`text-xs font-medium mb-1 ${
                          isToday ? 'w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center' :
                          day.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                        }`}>
                          {day.day}
                        </div>
                        <div className="space-y-0.5">
                          {events.slice(0, 3).map((ev) => {
                            const style = typeStyles[ev.recordType] || typeStyles.task;
                            return (
                              <div key={ev.id} className={`text-[9px] px-1 py-0.5 rounded truncate ${style.bg} ${style.text}`}>
                                {ev.title}
                              </div>
                            );
                          })}
                          {events.length > 3 && (
                            <div className="text-[9px] text-gray-400 text-center">+{events.length - 3}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Legend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">圖例</h3>
              <div className="space-y-2">
                {Object.entries(typeStyles).map(([key, style]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${style.dot}`} />
                    <span className="text-xs text-gray-600">{style.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Day Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">
                  {selectedDate ? `${selectedDate}` : '選擇日期'}
                </h3>
                {selectedDate && (
                  <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {selectedDate ? (
                selectedEvents.length > 0 ? (
                  <div className="space-y-3">
                    {selectedEvents.map(ev => {
                      const style = typeStyles[ev.recordType] || typeStyles.task;
                      return (
                        <div key={ev.id} className={`rounded-lg p-3 border ${style.bg} border-transparent`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                            <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                          {ev.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ev.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                            {ev.assigneeName && <span className="flex items-center gap-1"><Clock size={10} />{ev.assigneeName}</span>}
                            <span>狀態：{ev.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs text-center py-4">此日無事件</p>
                )
              ) : (
                <p className="text-gray-400 text-xs text-center py-4">點擊日曆中的日期查看詳情</p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">本月統計</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">總事件</span>
                  <span className="font-medium text-gray-800">{records.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">任務</span>
                  <span className="font-medium text-blue-600">{records.filter(r => r.recordType === 'task').length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">里程碑</span>
                  <span className="font-medium text-purple-600">{records.filter(r => r.recordType === 'milestone').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
