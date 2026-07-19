import { useTranslation } from 'react-i18next';
import { MonitorCog, MapPin, Laptop, Server, Smartphone, BatteryMedium } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const assets = [
  { id: 'AST-1001', name: 'MacBook Pro 16"', category: 'Laptop', user: 'Alice Chen', location: 'Taipei HQ - 3F', status: 'In Use', condition: 'Good' },
  { id: 'AST-1002', name: 'Dell PowerEdge R740', category: 'Server', user: 'IT Dept', location: 'Datacenter A', status: 'In Use', condition: 'Excellent' },
  { id: 'AST-1003', name: 'iPhone 13 Pro', category: 'Mobile', user: 'Bob Lin', location: 'Remote', status: 'In Use', condition: 'Fair' },
  { id: 'AST-1004', name: 'ThinkPad X1 Carbon', category: 'Laptop', user: 'N/A', location: 'IT Storage', status: 'Available', condition: 'Good' },
];

export default function OrgAssets() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={MonitorCog} title={t('nav.orgManagement.assets')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <Laptop className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">1,245</p>
          <p className="text-sm text-gray-500">辦公設備</p>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <Server className="w-8 h-8 text-indigo-500 mb-2" />
          <p className="text-2xl font-bold">128</p>
          <p className="text-sm text-gray-500">伺服器與網路</p>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <Smartphone className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-2xl font-bold">450</p>
          <p className="text-sm text-gray-500">行動裝置</p>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <BatteryMedium className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-2xl font-bold">32</p>
          <p className="text-sm text-gray-500">待維修 / 報廢</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-gray-500" /> 資產分佈與狀態</h3>
          <button className="btn btn-primary text-sm px-4 py-2">盤點資產</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">資產編號</th>
                <th className="px-6 py-4 font-medium">資產名稱</th>
                <th className="px-6 py-4 font-medium">類別</th>
                <th className="px-6 py-4 font-medium">目前使用者</th>
                <th className="px-6 py-4 font-medium">位置</th>
                <th className="px-6 py-4 font-medium">使用狀態</th>
                <th className="px-6 py-4 font-medium">設備狀況</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {assets.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">{a.id}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{a.name}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{a.category}</td>
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-300">{a.user}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.location}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${a.status === 'Available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{a.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
