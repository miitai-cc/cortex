import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck, Users, Search, Filter, Mail, Phone, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem } from '../../services/api';

export default function HrPersonnel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery(
    ['department', 'hr'],
    () => departmentApi.overview('hr')
  );

  const createMutation = useMutation(
    (newItem: any) => departmentApi.createItem('hr', newItem),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['department', 'hr']);
        toast.success(t('hr.personnel.addEmployee') + ' - Success');
      },
      onError: () => toast.error('Failed to create'),
    }
  );

  const personnelItems = data?.data.items.filter(i => i.itemType === 'personnel') || [];
  const filteredItems = personnelItems.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.metadata?.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddDemo = () => {
    const name = window.prompt("Enter Employee Name:");
    if (!name) return;
    createMutation.mutate({
      itemType: 'personnel',
      title: name,
      description: 'Software Engineer',
      status: 'active',
      priority: 'medium',
      ownerName: 'HR Admin',
      metadata: {
        id: `E${Math.floor(Math.random() * 9000) + 1000}`,
        dept: 'Engineering',
        email: `${name.replace(' ', '.').toLowerCase()}@cortex.ai`,
        phone: '0900-000-000',
        location: 'Taipei'
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={UserCheck} title={t('nav.hr.personnel')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6 flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/10">
          <Users className="w-8 h-8 text-blue-600 mb-2" />
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{personnelItems.length}</p>
          <p className="text-sm font-medium text-blue-600/70 dark:text-blue-400/70">{t('hr.personnel.total')}</p>
        </div>
        <div className="card p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-500 mb-1">{t('hr.personnel.newThisMonth')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">12 <span className="text-sm font-normal text-emerald-500">+3.2%</span></p>
        </div>
        <div className="card p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-500 mb-1">{t('hr.personnel.turnoverRate')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">4.5% <span className="text-sm font-normal text-rose-500">-0.5%</span></p>
        </div>
        <div className="card p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-500 mb-1">{t('hr.personnel.avgTenure')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">3.2 <span className="text-sm font-normal text-gray-400">{t('hr.personnel.year')}</span></p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('hr.personnel.searchPlaceholder')} 
                className="pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg w-64 bg-gray-50 dark:bg-gray-800 focus:outline-none text-sm" 
              />
            </div>
            <button className="btn btn-secondary px-3 py-2 flex items-center gap-2 text-sm"><Filter className="w-4 h-4" /> {t('hr.personnel.filter')}</button>
          </div>
          <button 
            className="btn btn-primary px-4 py-2 text-sm disabled:opacity-50"
            onClick={handleAddDemo}
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('hr.personnel.addEmployee')}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('hr.personnel.id')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.personnel.name')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.personnel.deptRole')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.personnel.contact')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.personnel.location')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('hr.personnel.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((emp: DepartmentItem) => {
                  const meta = emp.metadata as any || {};
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 font-mono text-gray-500 text-xs">{meta.id || emp.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                            {emp.title.charAt(0).toUpperCase()}
                          </div>
                          {emp.title}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{meta.dept || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{emp.description}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        <p className="flex items-center gap-1 mb-1"><Mail className="w-3 h-3" /> {meta.email || '-'}</p>
                        <p className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" /> {meta.phone || '-'}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {meta.location || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-primary-600 hover:text-primary-700 font-medium text-sm">{t('hr.personnel.viewFile')}</button>
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
