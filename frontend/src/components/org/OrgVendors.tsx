import { useTranslation } from 'react-i18next';
import { Truck, Star, TrendingUp, AlertTriangle, Search, Filter, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem, type DepartmentItemPayload } from '../../services/api';

export default function OrgVendors() {
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
      toast.success(t('org.vendors.add') + ' - Success');
    },
    onError: () => toast.error('Failed to create'),
  });

  const vendors = data?.data.items.filter(i => i.itemType === 'vendor') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'vendor',
      title: 'Demo Vendor Inc.',
      description: 'Global Tech Supplies',
      status: 'active',
      priority: 'high',
      ownerName: 'Admin',
      metadata: {
        id: `V00${Math.floor(Math.random() * 9) + 1}`,
        category: 'IT Hardware',
        rating: 4.8,
        spend: '$125K',
        statusLabel: 'Active'
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Truck} title={t('nav.orgManagement.vendors')} />
      
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{t('org.vendors.total')}</p>
            <p className="text-3xl font-bold mt-2">{vendors.length}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Truck className="w-6 h-6" />
          </div>
        </div>
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{t('org.vendors.avgRating')}</p>
            <p className="text-3xl font-bold mt-2">4.5 <span className="text-sm text-gray-400 font-normal">/ 5.0</span></p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-lg">
            <Star className="w-6 h-6" />
          </div>
        </div>
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{t('org.vendors.annualSpend')}</p>
            <p className="text-3xl font-bold mt-2">$2.4M</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder={t('org.vendors.search')} className="pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <button className="btn btn-secondary px-3 py-2 flex items-center gap-2">
              <Filter className="w-4 h-4" /> {t('org.vendors.filter')}
            </button>
          </div>
          <button 
            className="btn btn-primary disabled:opacity-50"
            onClick={handleAddDemo}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('org.vendors.add')}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('org.vendors.id')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.vendors.name')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.vendors.category')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.vendors.rating')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.vendors.status')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.vendors.spend')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {vendors.map((v) => {
                  const meta = v.metadata as any || {};
                  return (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                      <td className="px-6 py-4 text-gray-500">{meta.id || v.id.slice(0,6)}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{v.title}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{meta.category || v.description}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{meta.rating || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                          meta.statusLabel === 'Active' || v.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {meta.statusLabel === 'Warning' && <AlertTriangle className="w-3 h-3" />}
                          {meta.statusLabel || v.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.spend || '-'}</td>
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
