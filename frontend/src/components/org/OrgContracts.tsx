import { useTranslation } from 'react-i18next';
import { FileText, Clock, ShieldCheck, AlertCircle, Search, FileSignature } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const contracts = [
  { id: 'CTR-2023-001', title: 'AWS Enterprise Support', party: 'Amazon Web Services', type: 'SaaS', endDate: '2024-12-31', status: 'Active' },
  { id: 'CTR-2023-002', title: 'Taipei HQ Lease', party: 'Taipei 101 Corp.', type: 'Real Estate', endDate: '2023-08-31', status: 'Expiring Soon' },
  { id: 'CTR-2023-003', title: 'Consulting Retainer', party: 'McKinsey', type: 'Service', endDate: '2023-11-30', status: 'Active' },
  { id: 'CTR-2022-105', title: 'Hardware Supply', party: 'Global Tech', type: 'Procurement', endDate: '2022-12-31', status: 'Expired' },
];

export default function OrgContracts() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={FileText} title={t('nav.orgManagement.contracts')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">128</p>
            <p className="text-sm text-gray-500">總合約數</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">104</p>
            <p className="text-sm text-gray-500">生效中</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4 border-2 border-amber-100 dark:border-amber-900/50">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">12</p>
            <p className="text-sm text-gray-500">30天內到期</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-gray-100 text-gray-500 rounded-full dark:bg-gray-800">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">12</p>
            <p className="text-sm text-gray-500">已過期/終止</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="搜尋合約編號或對象..." className="pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg w-full bg-gray-50 dark:bg-gray-800 focus:outline-none text-sm" />
          </div>
          <button className="btn btn-primary text-sm px-4 py-2">新增合約</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">合約編號</th>
                <th className="px-6 py-4 font-medium">合約名稱</th>
                <th className="px-6 py-4 font-medium">簽約對象</th>
                <th className="px-6 py-4 font-medium">類型</th>
                <th className="px-6 py-4 font-medium">到期日</th>
                <th className="px-6 py-4 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {contracts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">{c.id}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{c.title}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.party}</td>
                  <td className="px-6 py-4 text-gray-500">{c.type}</td>
                  <td className="px-6 py-4 font-medium">{c.endDate}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      c.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      c.status === 'Expiring Soon' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {c.status}
                    </span>
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
