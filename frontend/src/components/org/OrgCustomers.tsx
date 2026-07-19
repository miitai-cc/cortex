import { useTranslation } from 'react-i18next';
import { Building2, Users, Target, Activity, Search, Plus, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem } from '../../services/api';

export default function OrgCustomers() {
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
        toast.success(t('org.customers.addGroup') + ' - Success');
      },
      onError: () => toast.error('Failed to create'),
    }
  );

  const customers = data?.data.items.filter(i => i.itemType === 'customer') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'customer',
      title: 'TechSolutions Inc.',
      description: 'Enterprise',
      status: 'active',
      priority: 'high',
      ownerName: 'Admin',
      metadata: {
        id: `C100${Math.floor(Math.random() * 9) + 1}`,
        type: 'Enterprise',
        mrr: '$12,500',
        health: 'Good',
        statusLabel: 'Active'
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Building2} title={t('nav.orgManagement.customers')} />

      {/* Segments */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <Users className="w-8 h-8 mb-4 opacity-80" />
          <p className="text-indigo-100 text-sm font-medium">{t('org.customers.total')}</p>
          <p className="text-3xl font-bold mt-1">{customers.length}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <Activity className="w-8 h-8 mb-4 opacity-80" />
          <p className="text-emerald-100 text-sm font-medium">{t('org.customers.active')}</p>
          <p className="text-3xl font-bold mt-1">{customers.filter(c => (c.metadata as any)?.statusLabel === 'Active' || c.status === 'active').length}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <Target className="w-8 h-8 mb-4 opacity-80" />
          <p className="text-amber-100 text-sm font-medium">{t('org.customers.opportunities')}</p>
          <p className="text-3xl font-bold mt-1">145</p>
        </div>
        <div 
          onClick={createMutation.isLoading ? undefined : handleAddDemo}
          className={`card p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-500 hover:text-primary-500 hover:border-primary-500 cursor-pointer transition-colors ${createMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {createMutation.isLoading ? (
            <Loader2 className="w-8 h-8 mb-2 animate-spin" />
          ) : (
            <Plus className="w-8 h-8 mb-2" />
          )}
          <p className="font-medium">{t('org.customers.addGroup')}</p>
        </div>
      </div>

      {/* Main List */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">{t('org.customers.important')}</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={t('org.customers.search')} className="pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">{t('org.customers.id')}</th>
                <th className="px-6 py-4 font-medium">{t('org.customers.name')}</th>
                <th className="px-6 py-4 font-medium">{t('org.customers.scale')}</th>
                <th className="px-6 py-4 font-medium">{t('org.customers.status')}</th>
                <th className="px-6 py-4 font-medium">{t('org.customers.mrr')}</th>
                <th className="px-6 py-4 font-medium">{t('org.customers.health')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.map((c) => {
                const meta = c.metadata as any || {};
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                    <td className="px-6 py-4 text-gray-500">{meta.id || c.id.slice(0,6)}</td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{c.title}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.type || c.description}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">{meta.statusLabel || c.status}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{meta.mrr || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        meta.health === 'Excellent' || meta.health === 'Good' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${meta.health === 'Excellent' || meta.health === 'Good' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        {meta.health || '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
