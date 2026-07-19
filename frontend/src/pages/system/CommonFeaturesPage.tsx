import { useLocation } from 'react-router-dom';
import { Users, ClipboardList, Clock, Plane, MapPin, Search, Phone, Mail, FileCheck } from 'lucide-react';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';

function Directory() {
  const mockUsers = [
    { name: '王小明', dept: '資訊部', title: '系統工程師', ext: '1011', proxy: '李大華', email: 'ming@company.com' },
    { name: '李大華', dept: '資訊部', title: '全端工程師', ext: '1012', proxy: '王小明', email: 'hua@company.com' },
    { name: '張心儀', dept: '人資部', title: 'HR 專員', ext: '2055', proxy: '陳美麗', email: 'cindy@company.com' },
    { name: '陳美麗', dept: '業務部', title: '業務經理', ext: '3100', proxy: '林建宏', email: 'mary@company.com' },
  ];

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-500" />
          全公司分機與職務代理人
        </h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋姓名、部門、分機..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 font-medium">姓名</th>
              <th className="px-4 py-3 font-medium">部門 / 職稱</th>
              <th className="px-4 py-3 font-medium">聯絡方式</th>
              <th className="px-4 py-3 font-medium">職務代理人</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {mockUsers.map((u, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{u.name}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-900 dark:text-gray-100">{u.dept}</p>
                  <p className="text-gray-500 text-xs">{u.title}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 space-y-1">
                  <div className="flex items-center gap-2"><Phone className="w-3 h-3"/> {u.ext}</div>
                  <div className="flex items-center gap-2"><Mail className="w-3 h-3"/> {u.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.proxy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockForm({ title, icon: Icon, type }: { title: string, icon: any, type: string }) {
  return (
    <div className="card max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b">
        <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-gray-500">電子簽核系統自動派發至直屬主管</p>
        </div>
      </div>
      
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">申請人</label>
            <input type="text" disabled value="王小明 (資訊部)" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-lg text-gray-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">申請日期</label>
            <input type="text" disabled value={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border rounded-lg text-gray-500" />
          </div>
        </div>

        {type === 'leave' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">請假類別</label>
            <select className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900">
              <option>特休</option>
              <option>事假</option>
              <option>病假</option>
              <option>公假</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">起始時間</label>
            <input type="datetime-local" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">結束時間</label>
            <input type="datetime-local" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">事由說明</label>
          <textarea rows={3} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900" placeholder="請詳述申請原因..."></textarea>
        </div>

        {type !== 'leave' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">附件上傳 (選填)</label>
            <input type="file" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
          </div>
        )}

        <div className="pt-4 border-t flex justify-end gap-3">
          <button type="button" className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">取消</button>
          <button type="button" className="px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-2">
            <FileCheck className="w-4 h-4"/>
            送出申請
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CommonFeaturesPage() {
  const path = useLocation().pathname;

  let content;
  let title = "常用功能";
  let icon = Users;

  if (path.includes('/directory')) {
    title = "員工通訊錄";
    icon = Users;
    content = <Directory />;
  } else if (path.includes('/leave')) {
    title = "[人事] 請假表單";
    icon = ClipboardList;
    content = <MockForm title="請假單申請" icon={ClipboardList} type="leave" />;
  } else if (path.includes('/overtime')) {
    title = "[人事] 加班表單";
    icon = Clock;
    content = <MockForm title="加班單申請" icon={Clock} type="overtime" />;
  } else if (path.includes('/trip')) {
    title = "[人事] 出差表單";
    icon = Plane;
    content = <MockForm title="出差申請單" icon={Plane} type="trip" />;
  } else if (path.includes('/outing')) {
    title = "[人事] 公出申請表單";
    icon = MapPin;
    content = <MockForm title="公出申請單" icon={MapPin} type="outing" />;
  } else {
    content = <div className="p-8 text-center text-gray-500">請從左側選單選擇功能</div>;
  }

  return (
    <div className="max-w-11xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={icon} title={title} />
      {content}
    </div>
  );
}
