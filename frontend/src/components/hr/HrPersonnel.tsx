import { useTranslation } from 'react-i18next';
import { UserCheck, Users, Search, Filter, Mail, Phone, MapPin } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const employees = [
  { id: 'E1045', name: 'Alice Chen', dept: '工程部', role: '資深後端工程師', email: 'alice.c@cortex.ai', phone: '0912-345-678', location: '台北總部' },
  { id: 'E1046', name: 'Bob Lin', dept: '設計部', role: 'UI/UX 設計師', email: 'bob.l@cortex.ai', phone: '0922-333-444', location: '台北總部' },
  { id: 'E1048', name: 'Charlie Wang', dept: '行銷部', role: '行銷總監', email: 'charlie.w@cortex.ai', phone: '0988-777-666', location: '遠端' },
  { id: 'E1052', name: 'David Wu', dept: '工程部', role: '產品經理', email: 'david.w@cortex.ai', phone: '0955-123-456', location: '台北總部' },
];

export default function HrPersonnel() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={UserCheck} title={t('nav.hr.personnel')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6 flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/10">
          <Users className="w-8 h-8 text-blue-600 mb-2" />
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">1,284</p>
          <p className="text-sm font-medium text-blue-600/70 dark:text-blue-400/70">總員工人數</p>
        </div>
        <div className="card p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-500 mb-1">本月新進人員</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">12 <span className="text-sm font-normal text-emerald-500">+3.2%</span></p>
        </div>
        <div className="card p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-500 mb-1">離職率 (YTD)</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">4.5% <span className="text-sm font-normal text-rose-500">-0.5%</span></p>
        </div>
        <div className="card p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-500 mb-1">平均年資</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">3.2 <span className="text-sm font-normal text-gray-400">年</span></p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="搜尋員工姓名或工號..." className="pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg w-64 bg-gray-50 dark:bg-gray-800 focus:outline-none text-sm" />
            </div>
            <button className="btn btn-secondary px-3 py-2 flex items-center gap-2 text-sm"><Filter className="w-4 h-4" /> 篩選</button>
          </div>
          <button className="btn btn-primary px-4 py-2 text-sm">新增員工資料</button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">工號</th>
                <th className="px-6 py-4 font-medium">姓名</th>
                <th className="px-6 py-4 font-medium">部門/職稱</th>
                <th className="px-6 py-4 font-medium">聯絡方式</th>
                <th className="px-6 py-4 font-medium">工作地點</th>
                <th className="px-6 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 font-mono text-gray-500 text-xs">{emp.id}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                        {emp.name.charAt(0)}
                      </div>
                      {emp.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{emp.dept}</p>
                    <p className="text-xs text-gray-500">{emp.role}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    <p className="flex items-center gap-1 mb-1"><Mail className="w-3 h-3" /> {emp.email}</p>
                    <p className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" /> {emp.phone}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 flex items-center gap-1"><MapPin className="w-3 h-3" /> {emp.location}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary-600 hover:text-primary-700 font-medium text-sm">檢視檔案</button>
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
