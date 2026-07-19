import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Calendar as CalendarIcon, Link2, Check, Clock, Video, Users } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const mockEvents = [
  { id: 1, title: 'Q3 Operations Sync', time: '10:00 AM - 11:30 AM', type: 'Google Meet', attendees: 12 },
  { id: 2, title: 'Vendor Negotiation: Apex', time: '01:00 PM - 02:00 PM', type: 'Zoom', attendees: 4 },
  { id: 3, title: '1-on-1 with HR Director', time: '03:30 PM - 04:00 PM', type: 'In Person', attendees: 2 },
];

export default function OrgMeetings() {
  const { t } = useTranslation();
  const [isLinked, setIsLinked] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={CalendarDays} title={t('nav.orgManagement.meetings')} />

      {/* Settings / Auth area */}
      <div className="card p-6 mb-8 border-l-4 border-l-primary-500 bg-primary-50/50 dark:bg-primary-900/10">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <CalendarIcon className="w-5 h-5 text-primary-600" /> Google Calendar 整合設定
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              將您的會議管理與 Google Calendar 雙向同步。同步後，您可以在此建立會議，行事曆也會即時更新。
            </p>
          </div>
          <div>
            {isLinked ? (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-emerald-600 font-medium text-sm bg-emerald-50 px-3 py-1.5 rounded-full">
                  <Check className="w-4 h-4" /> 已成功綁定 (user@example.com)
                </span>
                <button onClick={() => setIsLinked(false)} className="text-sm text-gray-500 hover:text-gray-700 underline">解除綁定</button>
              </div>
            ) : (
              <button 
                onClick={() => setIsLinked(true)} 
                className="btn bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border shadow-sm flex items-center gap-2 px-4 py-2 hover:bg-gray-50"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-4 h-4" />
                連結 Google 帳號
              </button>
            )}
          </div>
        </div>
        
        {isLinked && (
          <div className="mt-6 pt-6 border-t dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">同步模式</label>
              <select className="w-full border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 p-2 text-sm">
                <option>雙向同步 (推薦)</option>
                <option>僅讀取 Google Calendar</option>
                <option>僅寫入 Google Calendar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">同步頻率</label>
              <select className="w-full border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 p-2 text-sm">
                <option>即時 (Webhook)</option>
                <option>每 15 分鐘</option>
                <option>每小時</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary w-full">儲存設定</button>
            </div>
          </div>
        )}
      </div>

      {/* Meeting Agenda (only show if linked for demo purposes, or show placeholder) */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">今日會議排程 (Today's Agenda)</h3>
          <button className="btn btn-secondary px-4 py-2 text-sm" disabled={!isLinked}>+ 新增會議</button>
        </div>
        <div className="p-6">
          {!isLinked ? (
            <div className="text-center py-10">
              <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">尚未連結行事曆</h4>
              <p className="text-gray-500">請先在上方綁定 Google 帳號，即可查看與管理您的會議。</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mockEvents.map(event => (
                <div key={event.id} className="flex gap-4 p-4 border dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow">
                  <div className="w-2 bg-primary-500 rounded-full"></div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg mb-1">{event.title}</h4>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {event.time}</span>
                      <span className="flex items-center gap-1"><Video className="w-4 h-4" /> {event.type}</span>
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {event.attendees} 人參與</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button className="btn btn-secondary text-sm">加入會議</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
