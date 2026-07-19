import { useTranslation } from 'react-i18next';
import { CalendarClock, CalendarCheck2, Clock, AlertCircle, CalendarRange } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const attendanceRecords = [
  { id: 1, empId: 'E1045', name: 'Alice Chen', date: '2023-07-19', type: '特休', status: '已核准', duration: '8 小時' },
  { id: 2, empId: 'E1052', name: 'David Wu', date: '2023-07-20', type: '病假', status: '待簽核', duration: '4 小時' },
  { id: 3, empId: 'E1048', name: 'Charlie Wang', date: '2023-07-18', type: '加班', status: '已核准', duration: '3 小時' },
  { id: 4, empId: 'E1046', name: 'Bob Lin', date: '2023-07-18', type: '遲到', status: '異常', duration: '45 分鐘' },
];

export default function HrAttendance() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={CalendarClock} title={t('nav.hr.attendance')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 border-l-4 border-l-primary-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">今日出勤率</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">96.5%</p>
          </div>
          <CalendarCheck2 className="w-8 h-8 text-primary-200" />
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">今日請假人數</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">12 <span className="text-sm font-normal text-gray-400">人</span></p>
          </div>
          <CalendarRange className="w-8 h-8 text-emerald-200" />
        </div>
        <div className="card p-5 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">待簽核單據</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">45 <span className="text-sm font-normal text-gray-400">筆</span></p>
          </div>
          <Clock className="w-8 h-8 text-amber-200" />
        </div>
        <div className="card p-5 border-l-4 border-l-rose-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">出勤異常</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">8 <span className="text-sm font-normal text-gray-400">筆</span></p>
          </div>
          <AlertCircle className="w-8 h-8 text-rose-200" />
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">近期假單與出勤紀錄</h3>
          <div className="flex gap-2">
            <button className="btn btn-secondary px-4 py-2 text-sm">匯出報表</button>
            <button className="btn btn-primary px-4 py-2 text-sm">新增假單</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">員工</th>
                <th className="px-6 py-4 font-medium">日期</th>
                <th className="px-6 py-4 font-medium">單據類型</th>
                <th className="px-6 py-4 font-medium">時數</th>
                <th className="px-6 py-4 font-medium">狀態</th>
                <th className="px-6 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {attendanceRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{record.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{record.empId}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{record.date}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{record.type}</span>
                  </td>
                  <td className="px-6 py-4 font-medium">{record.duration}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      record.status === '已核准' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      record.status === '異常' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {record.status === '待簽核' && (
                      <button className="text-emerald-600 hover:text-emerald-700 font-medium text-xs bg-emerald-50 px-2 py-1 rounded">核准</button>
                    )}
                    <button className="text-primary-600 hover:text-primary-700 font-medium text-xs">詳細</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
