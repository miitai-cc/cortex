import { useTranslation } from 'react-i18next';
import { FileText, Clock, ShieldCheck, AlertCircle, Search, FileSignature, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem, type DepartmentItemPayload } from '../../services/api';

export default function OrgContracts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['department', 'org_management'],
    queryFn: () => departmentApi.overview('org_management'),
  });

  const createMutation = useMutation({
    mutationFn: (newItem: DepartmentItemPayload) => departmentApi.createItem('org_management', newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'org_management'] });
      toast.success(t('org.contracts.add') + ' - Success');
    },
    onError: () => toast.error('Failed to create'),
  });

  const contracts = data?.data.items.filter(i => i.itemType === 'contract') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'contract',
      title: 'Demo Contract',
      description: 'SaaS',
      status: 'active',
      priority: 'medium',
      ownerName: 'Admin',
      metadata: {
        id: `CTR-2023-00${Math.floor(Math.random() * 9) + 1}`,
        party: 'Amazon Web Services',
        type: 'SaaS',
        endDate: '2024-12-31',
        statusLabel: 'Active'
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={FileText} title={t('nav.orgManagement.contracts')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{contracts.length}</p>
            <p className="text-sm text-gray-500">{t('org.contracts.total')}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">104</p>
            <p className="text-sm text-gray-500">{t('org.contracts.active')}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4 border-2 border-amber-100 dark:border-amber-900/50">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">12</p>
            <p className="text-sm text-gray-500">{t('org.contracts.expiring')}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-gray-100 text-gray-500 rounded-full dark:bg-gray-800">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">12</p>
            <p className="text-sm text-gray-500">{t('org.contracts.expired')}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={t('org.contracts.search')} className="pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg w-full bg-gray-50 dark:bg-gray-800 focus:outline-none text-sm" />
          </div>
          <button 
            className="btn btn-primary text-sm px-4 py-2 disabled:opacity-50"
            onClick={handleAddDemo}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('org.contracts.add')}
          </button>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('org.contracts.id')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.contracts.title')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.contracts.party')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.contracts.type')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.contracts.endDate')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.contracts.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {contracts.map(c => {
                  const meta = c.metadata as any || {};
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{meta.id || c.id.slice(0,6)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{c.title}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.party || c.ownerName}</td>
                      <td className="px-6 py-4 text-gray-500">{meta.type || c.description}</td>
                      <td className="px-6 py-4 font-medium">{meta.endDate || c.createdAt?.split('T')[0]}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          meta.statusLabel === 'Active' || c.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          meta.statusLabel === 'Expiring Soon' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {meta.statusLabel || c.status}
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
    </div>
  );
}
