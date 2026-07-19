import { useTranslation } from 'react-i18next';
import { Warehouse, Grid2X2, Map, Thermometer, Settings2, Loader2, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem } from '../../services/api';

export default function OrgWarehouse() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    ['department', 'org_management'],
    () => departmentApi.overview('org_management')
  );

  const createMutation = useMutation(
    (newItem: any) => departmentApi.createItem('org_management', newItem),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['department', 'org_management']);
        toast.success('Added Warehouse - Success');
      },
      onError: () => toast.error('Failed to create'),
    }
  );

  const warehouses = data?.data.items.filter(i => i.itemType === 'warehouse') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'warehouse',
      title: 'Demo Warehouse',
      description: 'Secondary Site',
      status: 'active',
      priority: 'high',
      ownerName: 'Admin',
      metadata: {
        id: `WH-DEMO-${Math.floor(Math.random() * 99)}`,
        name: 'Demo Warehouse',
        location: 'Demo City',
        capacity: '75%',
        temp: '22°C',
        statusLabel: '正常'
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <div className="flex justify-between items-center mb-6">
        <CommonHeroTitle icon={Warehouse} title={t('nav.orgManagement.warehouse')} />
        <button 
          className="btn btn-primary disabled:opacity-50 flex items-center gap-2"
          onClick={handleAddDemo}
          disabled={createMutation.isLoading}
        >
          {createMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Demo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Map className="w-5 h-5 text-primary-500" /> 台北主倉 (WH-TPE-01) {t('org.warehouse.layout')}</h3>
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
            <h3 className="font-bold text-lg flex items-center gap-2"><Grid2X2 className="w-5 h-5 text-gray-500" /> {t('org.warehouse.overview')}</h3>
            <button className="text-gray-400 hover:text-gray-600"><Settings2 className="w-5 h-5" /></button>
          </div>
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
            ) : (
              <>
                {warehouses.map(wh => {
                  const meta = wh.metadata as any || {};
                  const capacity = meta.capacity || '0%';
                  return (
                    <div key={wh.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border dark:border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-gray-100">{meta.name || wh.title}</h4>
                          <p className="text-xs text-gray-500">{meta.id || wh.id.slice(0,6)} • {meta.location || 'Unknown'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.statusLabel === '正常' || wh.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {meta.statusLabel || wh.status}
                        </span>
                      </div>
                      <div className="mt-4 flex gap-4 text-sm">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">{t('org.warehouse.capacity')}</span>
                            <span className="font-bold">{capacity}</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full ${parseInt(capacity) > 90 ? 'bg-rose-500' : 'bg-primary-500'}`} style={{ width: capacity }}></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 px-2 py-1 rounded border dark:border-gray-600">
                          <Thermometer className="w-3 h-3" /> {meta.temp || 'N/A'}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {warehouses.length === 0 && (
                  <div className="text-center text-gray-500 py-4">No warehouses</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
