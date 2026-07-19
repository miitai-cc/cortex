import { useState } from 'react';
import { Calendar, CalendarDays, FileClock, Megaphone, Car, MonitorSmartphone, Users } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { departmentApi } from '../../services/api';

export function Announcements() {
  const { data, isLoading } = useQuery({
    queryKey: ['department', 'collaboration'],
    queryFn: () => departmentApi.overview('collaboration'),
  });

  const items = data?.data.items.filter((i: any) => i.itemType === 'announcement') || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="h-5 w-5 text-indigo-500"/> 團隊公告</h2>
      </div>
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-gray-500 text-center py-4">Loading announcements...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No announcements</p>
        ) : (
          items.map((item: any) => {
            const meta = (item.metadata as any) || {};
            return (
              <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                  <p className="text-sm text-gray-500">發布單位: {meta.department || 'General'}</p>
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                </div>
                <span className="text-sm text-gray-400 whitespace-nowrap ml-4">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function Workflows() {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><FileClock className="h-5 w-5 text-indigo-500"/> 流程簽核追蹤</h2>
      </div>
      <div className="space-y-3">
        {[
          { title: "請購單: 開發伺服器擴充", status: "簽核中", step: "經理簽核" },
          { title: "差旅申請: 東京技術交流會", status: "已完成", step: "-" },
          { title: "硬體借用: 測試用平板", status: "簽核中", step: "IT部門" }
        ].map((item, idx) => (
          <div key={idx} className="flex justify-between items-center p-3 border rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
              <p className="text-sm text-gray-500">當前關卡: {item.step}</p>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${item.status === '已完成' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarView() {
  const { data, isLoading } = useQuery({
    queryKey: ['department', 'collaboration'],
    queryFn: () => departmentApi.overview('collaboration'),
  });

  const items = data?.data.items.filter((i: any) => i.itemType === 'calendar_event') || [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-indigo-500"/> 行事曆整合</h2>
      </div>
      
      {isLoading ? (
        <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="text-center">
            <Calendar className="h-10 w-10 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500 font-medium">個人行程與部門會議行事曆</p>
            <p className="text-sm text-gray-400 mt-1">目前沒有排程事件</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => {
            const meta = (item.metadata as any) || {};
            const type = meta.type || 'company';
            return (
              <div key={item.id} className="flex flex-col p-4 border rounded-lg border-l-4" style={{ borderLeftColor: type === 'company' ? '#8b5cf6' : type === 'department' ? '#3b82f6' : '#10b981' }}>
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${type === 'company' ? 'bg-purple-100 text-purple-700' : type === 'department' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {type === 'company' ? '全公司' : type === 'department' ? '部門' : '個人'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.description}</p>
                <div className="mt-2 text-xs text-gray-500 font-medium">
                  {meta.date ? new Date(meta.date).toLocaleDateString() : '未定日期'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Bookings() {
  const [tab, setTab] = useState<'rooms' | 'cars' | 'equipment'>('rooms');

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarDays className="h-5 w-5 text-indigo-500"/> 資源預約</h2>
      </div>
      
      <div className="flex space-x-2 border-b">
        <button 
          onClick={() => setTab('rooms')} 
          className={`px-4 py-2 flex items-center gap-2 ${tab === 'rooms' ? 'border-b-2 border-primary-500 text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users className="h-4 w-4"/> 會議室
        </button>
        <button 
          onClick={() => setTab('cars')} 
          className={`px-4 py-2 flex items-center gap-2 ${tab === 'cars' ? 'border-b-2 border-primary-500 text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Car className="h-4 w-4"/> 公務車
        </button>
        <button 
          onClick={() => setTab('equipment')} 
          className={`px-4 py-2 flex items-center gap-2 ${tab === 'equipment' ? 'border-b-2 border-primary-500 text-primary-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <MonitorSmartphone className="h-4 w-4"/> 共享設備
        </button>
      </div>

      <div className="py-4">
        {tab === 'rooms' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 border rounded-lg p-3">A棟 301 大會議室 - 今日 14:00~16:00 已預約</p>
            <p className="text-sm text-gray-500 border rounded-lg p-3">B棟 205 研討室 - 全天開放</p>
          </div>
        )}
        {tab === 'cars' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 border rounded-lg p-3">車牌 ABC-1234 (休旅) - 可預借</p>
            <p className="text-sm text-gray-500 border rounded-lg p-3">車牌 XYZ-9876 (公務車) - 今日維修中</p>
          </div>
        )}
        {tab === 'equipment' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 border rounded-lg p-3">測試用 iPhone 15 Pro - 已被王小明借出</p>
            <p className="text-sm text-gray-500 border rounded-lg p-3">攝影器材套組 - 可預借</p>
          </div>
        )}
      </div>
    </div>
  );
}
