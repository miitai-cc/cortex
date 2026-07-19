import { useTranslation } from 'react-i18next';
import { Package, Grid3X3, ArrowRight, Tag } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const products = [
  { id: 'PRD-01', name: 'Cortex AI Core', category: 'Software', phase: 'Launch', stock: 'N/A', manager: 'Alice Chen' },
  { id: 'PRD-02', name: 'Smart IoT Gateway v2', category: 'Hardware', phase: 'Development', stock: 'Pre-production', manager: 'Bob Lin' },
  { id: 'PRD-03', name: 'Cloud Storage Plus', category: 'Service', phase: 'Mature', stock: 'N/A', manager: 'Charlie Wang' },
  { id: 'PRD-04', name: 'Legacy Router TX', category: 'Hardware', phase: 'End of Life', stock: '124 units', manager: 'David Wu' },
  { id: 'PRD-05', name: 'Data Insights API', category: 'Software', phase: 'Growth', stock: 'N/A', manager: 'Eva Lee' },
];

export default function OrgProducts() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Package} title={t('nav.orgManagement.products')} />

      {/* Lifecycle Pipeline */}
      <div className="mb-8 overflow-x-auto pb-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Grid3X3 className="w-5 h-5 text-primary-500" /> 產品生命週期概覽</h3>
        <div className="flex gap-4 min-w-[800px]">
          {['Development', 'Launch', 'Growth', 'Mature', 'End of Life'].map((phase, idx, arr) => (
            <div key={phase} className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-1 flex-1 rounded-full ${idx < 3 ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                {idx < arr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-400" />}
              </div>
              <div className="card p-4 bg-gray-50 dark:bg-gray-800/50">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">{phase}</h4>
                <div className="flex flex-col gap-2">
                  {products.filter(p => p.phase === phase).map(p => (
                    <div key={p.id} className="p-2 bg-white dark:bg-gray-900 rounded border dark:border-gray-700 shadow-sm text-sm">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{p.manager}</p>
                    </div>
                  ))}
                  {products.filter(p => p.phase === phase).length === 0 && (
                    <p className="text-xs text-gray-400 italic">無產品</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product List */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Tag className="w-5 h-5 text-gray-500" /> 產品型錄清單
          </h3>
          <button className="btn btn-primary px-4 py-2">新增產品</button>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
            <tr>
              <th className="px-6 py-4 font-medium">產品編號</th>
              <th className="px-6 py-4 font-medium">名稱</th>
              <th className="px-6 py-4 font-medium">分類</th>
              <th className="px-6 py-4 font-medium">負責人</th>
              <th className="px-6 py-4 font-medium">階段</th>
              <th className="px-6 py-4 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                <td className="px-6 py-4 text-gray-500">{p.id}</td>
                <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{p.name}</td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{p.category}</td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{p.manager}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{p.phase}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-primary-600 hover:text-primary-700 font-medium">編輯</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
