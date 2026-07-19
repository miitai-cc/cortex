import { useTranslation } from 'react-i18next';
import { Boxes, AlertTriangle, ArrowRightLeft, TrendingDown, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem, type DepartmentItemPayload } from '../../services/api';

export default function OrgInventory() {
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
      toast.success(t('org.inventory.transfer') + ' - Success');
    },
    onError: () => toast.error('Failed to create'),
  });

  const inventory = data?.data.items.filter(i => i.itemType === 'inventory') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'inventory',
      title: 'Demo Inventory',
      description: 'Enterprise Router X1',
      status: 'active',
      priority: 'high',
      ownerName: 'Admin',
      metadata: {
        sku: `HW-RTR-00${Math.floor(Math.random() * 9) + 1}`,
        category: 'Networking',
        stock: 45,
        minStock: 50,
        statusLabel: 'Low Stock'
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Boxes} title={t('nav.orgManagement.inventory')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 border-t-4 border-t-primary-500">
          <p className="text-gray-500 font-medium mb-2">{t('org.inventory.sku')}</p>
          <p className="text-3xl font-bold">1,204</p>
        </div>
        <div className="card p-6 border-t-4 border-t-amber-500">
          <p className="text-gray-500 font-medium mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> {t('org.inventory.lowStock')}</p>
          <p className="text-3xl font-bold text-amber-600">45</p>
        </div>
        <div className="card p-6 border-t-4 border-t-rose-500">
          <p className="text-gray-500 font-medium mb-2 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /> {t('org.inventory.outOfStock')}</p>
          <p className="text-3xl font-bold text-rose-600">12</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">{t('org.inventory.alertLabel')}</h3>
          <button 
            className="btn btn-secondary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50"
            onClick={handleAddDemo}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRightLeft className="w-4 h-4" /> {t('org.inventory.transfer')}</>}
          </button>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('org.inventory.colSku')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.inventory.colName')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.inventory.colCategory')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('org.inventory.colStock')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('org.inventory.colMinStock')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.inventory.colStatus')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('org.inventory.colAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {inventory.map(item => {
                  const meta = item.metadata as any || {};
                  const stock = meta.stock || 0;
                  const minStock = meta.minStock || 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{meta.sku || item.id.slice(0,6)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{meta.name || item.description}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.category || item.title}</td>
                      <td className={`px-6 py-4 font-bold text-right font-mono ${stock === 0 ? 'text-rose-600' : stock < minStock ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
                        {stock}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-500">{minStock}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          meta.statusLabel === 'In Stock' || stock >= minStock ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 
                          meta.statusLabel === 'Low Stock' || (stock > 0 && stock < minStock) ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 
                          'bg-rose-100 text-rose-700 dark:bg-rose-900/30'
                        }`}>
                          {meta.statusLabel || (stock >= minStock ? 'In Stock' : stock === 0 ? 'Out of Stock' : 'Low Stock')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-primary-600 hover:text-primary-700 text-xs font-medium">{t('org.inventory.actionCreate')}</button>
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
