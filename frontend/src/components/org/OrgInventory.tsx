import { useTranslation } from 'react-i18next';
import { Boxes, AlertTriangle, ArrowRightLeft, TrendingDown } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const inventory = [
  { sku: 'HW-RTR-001', name: 'Enterprise Router X1', category: 'Networking', stock: 45, minStock: 50, status: 'Low Stock' },
  { sku: 'HW-SWT-002', name: '48-Port Switch', category: 'Networking', stock: 120, minStock: 20, status: 'In Stock' },
  { sku: 'SP-CBL-010', name: 'Cat6 Cable (100m)', category: 'Supplies', stock: 12, minStock: 15, status: 'Low Stock' },
  { sku: 'SP-SRV-005', name: 'Server Rack 42U', category: 'Infrastructure', stock: 0, minStock: 5, status: 'Out of Stock' },
];

export default function OrgInventory() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Boxes} title={t('nav.orgManagement.inventory')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 border-t-4 border-t-primary-500">
          <p className="text-gray-500 font-medium mb-2">總庫存品項 (SKU)</p>
          <p className="text-3xl font-bold">1,204</p>
        </div>
        <div className="card p-6 border-t-4 border-t-amber-500">
          <p className="text-gray-500 font-medium mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> 低於安全庫存</p>
          <p className="text-3xl font-bold text-amber-600">45</p>
        </div>
        <div className="card p-6 border-t-4 border-t-rose-500">
          <p className="text-gray-500 font-medium mb-2 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /> 缺貨中</p>
          <p className="text-3xl font-bold text-rose-600">12</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">庫存水位警示與監控</h3>
          <button className="btn btn-secondary text-sm px-4 py-2 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> 庫存異動作業</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">SKU</th>
                <th className="px-6 py-4 font-medium">品名</th>
                <th className="px-6 py-4 font-medium">分類</th>
                <th className="px-6 py-4 font-medium text-right">目前庫存</th>
                <th className="px-6 py-4 font-medium text-right">安全庫存量</th>
                <th className="px-6 py-4 font-medium">狀態</th>
                <th className="px-6 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {inventory.map(item => (
                <tr key={item.sku} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.sku}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{item.name}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{item.category}</td>
                  <td className={`px-6 py-4 font-bold text-right font-mono ${item.stock === 0 ? 'text-rose-600' : item.stock < item.minStock ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
                    {item.stock}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-gray-500">{item.minStock}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.status === 'In Stock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 
                      item.status === 'Low Stock' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 
                      'bg-rose-100 text-rose-700 dark:bg-rose-900/30'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary-600 hover:text-primary-700 text-xs font-medium">建立採購單</button>
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
