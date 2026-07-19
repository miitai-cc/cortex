import { useTranslation } from 'react-i18next';
import { Warehouse, Grid2X2, Map, Thermometer, Settings2 } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const warehouses = [
  { id: 'WH-TPE-01', name: '台北主倉', location: '新北市五股區', capacity: '85%', temp: '22°C', status: '正常' },
  { id: 'WH-TY-02', name: '桃園轉運中心', location: '桃園市大園區', capacity: '92%', temp: '24°C', status: '高負載' },
  { id: 'WH-KS-01', name: '高雄二倉', location: '高雄市前鎮區', capacity: '45%', temp: '20°C', status: '正常' },
];

export default function OrgWarehouse() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Warehouse} title={t('nav.orgManagement.warehouse')} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Map className="w-5 h-5 text-primary-500" /> 台北主倉 (WH-TPE-01) 平面配置與儲位狀況</h3>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 aspect-video relative overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-700">
            {/* Mock Warehouse Grid */}
            <div className="absolute inset-0 p-4 grid grid-cols-4 grid-rows-3 gap-4">
              <div className="bg-emerald-500/20 border border-emerald-500 rounded flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-400">A 區 (收發)</div>
              <div className="bg-blue-500/20 border border-blue-500 rounded flex items-center justify-center font-bold text-blue-700 dark:text-blue-400">B1 區 (電子零件)</div>
              <div className="bg-blue-500/20 border border-blue-500 rounded flex items-center justify-center font-bold text-blue-700 dark:text-blue-400">B2 區 (電子零件)</div>
              <div className="bg-amber-500/20 border border-amber-500 rounded flex items-center justify-center font-bold text-amber-700 dark:text-amber-400">C1 區 (滿載)</div>
              
              <div className="bg-emerald-500/20 border border-emerald-500 rounded flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-400">A2 區 (暫存)</div>
              <div className="bg-gray-300/50 border border-gray-400 rounded flex items-center justify-center font-bold text-gray-600">通道</div>
              <div className="bg-gray-300/50 border border-gray-400 rounded flex items-center justify-center font-bold text-gray-600">通道</div>
              <div className="bg-rose-500/20 border border-rose-500 rounded flex items-center justify-center font-bold text-rose-700 dark:text-rose-400 relative overflow-hidden">
                <span className="relative z-10">D1 區 (維護中)</span>
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)' }}></div>
              </div>

              <div className="bg-blue-500/20 border border-blue-500 rounded flex items-center justify-center font-bold text-blue-700 dark:text-blue-400">E1 區 (大型機具)</div>
              <div className="bg-blue-500/20 border border-blue-500 rounded flex items-center justify-center font-bold text-blue-700 dark:text-blue-400">E2 區 (大型機具)</div>
              <div className="bg-amber-500/20 border border-amber-500 rounded flex items-center justify-center font-bold text-amber-700 dark:text-amber-400">F1 區 (即將滿載)</div>
              <div className="bg-blue-500/20 border border-blue-500 rounded flex items-center justify-center font-bold text-blue-700 dark:text-blue-400">F2 區 (空置儲位)</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2"><Grid2X2 className="w-5 h-5 text-gray-500" /> 倉儲網點概況</h3>
            <button className="text-gray-400 hover:text-gray-600"><Settings2 className="w-5 h-5" /></button>
          </div>
          <div className="p-4 space-y-4">
            {warehouses.map(wh => (
              <div key={wh.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border dark:border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{wh.name}</h4>
                    <p className="text-xs text-gray-500">{wh.id} • {wh.location}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${wh.status === '正常' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {wh.status}
                  </span>
                </div>
                <div className="mt-4 flex gap-4 text-sm">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">容量使用率</span>
                      <span className="font-bold">{wh.capacity}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${parseInt(wh.capacity) > 90 ? 'bg-rose-500' : 'bg-primary-500'}`} style={{ width: wh.capacity }}></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 px-2 py-1 rounded border dark:border-gray-600">
                    <Thermometer className="w-3 h-3" /> {wh.temp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
