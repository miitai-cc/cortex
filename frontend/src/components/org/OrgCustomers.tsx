import { useTranslation } from 'react-i18next';
import { Building2, Users, Target, Activity, Search, Plus } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const customers = [
  { id: 'C1001', name: 'TechSolutions Inc.', type: 'Enterprise', status: 'Active', mrr: '$12,500', health: 'Good' },
  { id: 'C1002', name: 'Global Logistics Corp.', type: 'Enterprise', status: 'Onboarding', mrr: '$25,000', health: 'Good' },
  { id: 'C1003', name: 'Creative Media Ltd.', type: 'SMB', status: 'At Risk', mrr: '$1,200', health: 'Poor' },
  { id: 'C1004', name: 'EduSmart Systems', type: 'Education', status: 'Active', mrr: '$4,500', health: 'Excellent' },
];

export default function OrgCustomers() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Building2} title={t('nav.orgManagement.customers')} />

      {/* Segments */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <Users className="w-8 h-8 mb-4 opacity-80" />
          <p className="text-indigo-100 text-sm font-medium">總客戶數</p>
          <p className="text-3xl font-bold mt-1">1,248</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <Activity className="w-8 h-8 mb-4 opacity-80" />
          <p className="text-emerald-100 text-sm font-medium">活躍訂閱戶</p>
          <p className="text-3xl font-bold mt-1">982</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <Target className="w-8 h-8 mb-4 opacity-80" />
          <p className="text-amber-100 text-sm font-medium">商機洽談中</p>
          <p className="text-3xl font-bold mt-1">145</p>
        </div>
        <div className="card p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-500 hover:text-primary-500 hover:border-primary-500 cursor-pointer transition-colors">
          <Plus className="w-8 h-8 mb-2" />
          <p className="font-medium">新增客戶群組</p>
        </div>
      </div>

      {/* Main List */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">重要客戶清單</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="搜尋客戶名稱..." className="pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
        </div>
        
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
            <tr>
              <th className="px-6 py-4 font-medium">客戶 ID</th>
              <th className="px-6 py-4 font-medium">客戶名稱</th>
              <th className="px-6 py-4 font-medium">規模屬性</th>
              <th className="px-6 py-4 font-medium">狀態</th>
              <th className="px-6 py-4 font-medium">月經常性營收 (MRR)</th>
              <th className="px-6 py-4 font-medium">健康度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                <td className="px-6 py-4 text-gray-500">{c.id}</td>
                <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{c.name}</td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.type}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">{c.status}</span>
                </td>
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{c.mrr}</td>
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-1 text-xs font-medium ${
                    c.health === 'Excellent' || c.health === 'Good' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${c.health === 'Excellent' || c.health === 'Good' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    {c.health}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
