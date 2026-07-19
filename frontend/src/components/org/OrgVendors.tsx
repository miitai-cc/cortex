import { useTranslation } from 'react-i18next';
import { Truck, Star, TrendingUp, AlertTriangle, Search, Filter } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const vendors = [
  { id: 'V001', name: 'Global Tech Supplies', category: 'IT Hardware', rating: 4.8, status: 'Active', spend: '$125K' },
  { id: 'V002', name: 'Apex Logistics', category: 'Shipping', rating: 4.2, status: 'Active', spend: '$85K' },
  { id: 'V003', name: 'Office Essentials Co.', category: 'Stationery', rating: 3.9, status: 'Warning', spend: '$12K' },
  { id: 'V004', name: 'CloudNet Services', category: 'Software', rating: 4.9, status: 'Active', spend: '$240K' },
  { id: 'V005', name: 'BuildRight Construction', category: 'Facilities', rating: 4.5, status: 'Active', spend: '$55K' },
];

export default function OrgVendors() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Truck} title={t('nav.orgManagement.vendors')} />
      
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">總合作供應商</p>
            <p className="text-3xl font-bold mt-2">142</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Truck className="w-6 h-6" />
          </div>
        </div>
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">平均評分</p>
            <p className="text-3xl font-bold mt-2">4.5 <span className="text-sm text-gray-400 font-normal">/ 5.0</span></p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-lg">
            <Star className="w-6 h-6" />
          </div>
        </div>
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">年度採購總額</p>
            <p className="text-3xl font-bold mt-2">$2.4M</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="搜尋供應商..." className="pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <button className="btn btn-secondary px-3 py-2 flex items-center gap-2">
              <Filter className="w-4 h-4" /> 篩選
            </button>
          </div>
          <button className="btn btn-primary">新增供應商</button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">編號</th>
                <th className="px-6 py-4 font-medium">供應商名稱</th>
                <th className="px-6 py-4 font-medium">分類</th>
                <th className="px-6 py-4 font-medium">評分</th>
                <th className="px-6 py-4 font-medium">狀態</th>
                <th className="px-6 py-4 font-medium">年度花費</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                  <td className="px-6 py-4 text-gray-500">{v.id}</td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{v.name}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{v.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{v.rating}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                      v.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {v.status === 'Warning' && <AlertTriangle className="w-3 h-3" />}
                      {v.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{v.spend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
