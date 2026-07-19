import { useTranslation } from 'react-i18next';
import { MonitorCog, MapPin, Laptop, Server, Smartphone, BatteryMedium, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem } from '../../services/api';

export default function OrgAssets() {
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
        toast.success(t('org.assets.audit') + ' - Success');
      },
      onError: () => toast.error('Failed to create'),
    }
  );

  const assets = data?.data.items.filter(i => i.itemType === 'asset') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'asset',
      title: 'Demo Asset',
      description: 'MacBook Pro 16"',
      status: 'active',
      priority: 'high',
      ownerName: 'Admin',
      metadata: {
        id: `AST-100${Math.floor(Math.random() * 9) + 1}`,
        category: 'Laptop',
        user: 'Alice Chen',
        location: 'Taipei HQ - 3F',
        statusLabel: 'In Use',
        condition: 'Good'
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={MonitorCog} title={t('nav.orgManagement.assets')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <Laptop className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">1,245</p>
          <p className="text-sm text-gray-500">{t('org.assets.office')}</p>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <Server className="w-8 h-8 text-indigo-500 mb-2" />
          <p className="text-2xl font-bold">128</p>
          <p className="text-sm text-gray-500">{t('org.assets.server')}</p>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <Smartphone className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-2xl font-bold">450</p>
          <p className="text-sm text-gray-500">{t('org.assets.mobile')}</p>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <BatteryMedium className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-2xl font-bold">32</p>
          <p className="text-sm text-gray-500">{t('org.assets.repair')}</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-gray-500" /> {t('org.assets.statusLabel')}</h3>
          <button 
            className="btn btn-primary text-sm px-4 py-2 disabled:opacity-50"
            onClick={handleAddDemo}
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('org.assets.audit')}
          </button>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('org.assets.id')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.assets.name')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.assets.category')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.assets.user')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.assets.location')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.assets.status')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.assets.condition')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assets.map(a => {
                  const meta = a.metadata as any || {};
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{meta.id || a.id.slice(0,6)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{meta.name || a.description}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.category || a.title}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-300">{meta.user || a.ownerName}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 flex items-center gap-1"><MapPin className="w-3 h-3" /> {meta.location || 'HQ'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${meta.statusLabel === 'Available' || a.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {meta.statusLabel || a.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.condition || 'Good'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
