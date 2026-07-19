import { useTranslation } from 'react-i18next';
import { Package, Grid3X3, ArrowRight, Tag, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem, type DepartmentItemPayload } from '../../services/api';

export default function OrgProducts() {
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
      toast.success(t('org.products.add') + ' - Success');
    },
    onError: () => toast.error('Failed to create'),
  });

  const products = data?.data.items.filter(i => i.itemType === 'product') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'product',
      title: 'Demo Product X',
      description: 'Software',
      status: 'active',
      priority: 'high',
      ownerName: 'Alice Chen',
      metadata: {
        id: `PRD-0${Math.floor(Math.random() * 9) + 1}`,
        category: 'Software',
        phase: 'Launch',
        stock: 'N/A'
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Package} title={t('nav.orgManagement.products')} />

      {/* Lifecycle Pipeline */}
      <div className="mb-8 overflow-x-auto pb-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Grid3X3 className="w-5 h-5 text-primary-500" /> {t('org.products.lifecycle')}</h3>
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
                  {products.filter(p => (p.metadata as any)?.phase === phase || p.status === phase.toLowerCase()).map(p => (
                    <div key={p.id} className="p-2 bg-white dark:bg-gray-900 rounded border dark:border-gray-700 shadow-sm text-sm">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{p.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{p.ownerName}</p>
                    </div>
                  ))}
                  {products.filter(p => (p.metadata as any)?.phase === phase || p.status === phase.toLowerCase()).length === 0 && (
                    <p className="text-xs text-gray-400 italic">{t('org.products.none')}</p>
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
            <Tag className="w-5 h-5 text-gray-500" /> {t('org.products.list')}
          </h3>
          <button 
            className="btn btn-primary px-4 py-2 disabled:opacity-50"
            onClick={handleAddDemo}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('org.products.add')}
          </button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">{t('org.products.id')}</th>
                <th className="px-6 py-4 font-medium">{t('org.products.name')}</th>
                <th className="px-6 py-4 font-medium">{t('org.products.category')}</th>
                <th className="px-6 py-4 font-medium">{t('org.products.manager')}</th>
                <th className="px-6 py-4 font-medium">{t('org.products.phase')}</th>
                <th className="px-6 py-4 font-medium text-right">{t('org.products.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {products.map((p) => {
                const meta = p.metadata as any || {};
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                    <td className="px-6 py-4 text-gray-500">{meta.id || p.id.slice(0,6)}</td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{p.title}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.category || p.description}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{p.ownerName}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{meta.phase || p.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-primary-600 hover:text-primary-700 font-medium">{t('org.products.edit')}</button>
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
