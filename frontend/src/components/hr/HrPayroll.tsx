import { useTranslation } from 'react-i18next';
import { CircleDollarSign, Calculator, FileCheck, ArrowDownToLine, Banknote, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem, type DepartmentItemPayload } from '../../services/api';

export default function HrPayroll() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['department', 'hr'],
    queryFn: () => departmentApi.overview('hr'),
  });

  const createMutation = useMutation({
    mutationFn: (newItem: DepartmentItemPayload) => departmentApi.createItem('hr', newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'hr'] });
      toast.success(t('hr.payroll.generate') + ' - Success');
    },
    onError: () => toast.error('Failed to create'),
  });

  const payrolls = data?.data.items.filter(i => i.itemType === 'payroll') || [];

  const handleGenerate = () => {
    createMutation.mutate({
      itemType: 'payroll',
      title: new Date().toISOString().slice(0, 7),
      description: 'Payroll run',
      status: 'pending_review',
      priority: 'high',
      ownerName: 'HR Admin',
      metadata: {
        totalBase: '$1,250,000',
        totalBonus: '$120,000',
        totalDeductions: '$185,000',
        netPay: '-',
        processDate: new Date().toISOString().split('T')[0]
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={CircleDollarSign} title={t('nav.hr.payroll')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <Banknote className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-3xl font-bold font-mono">$1,145,500</p>
          <p className="text-sm font-medium text-emerald-100">{t('hr.payroll.lastMonthTotal')}</p>
        </div>
        <div className="card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-4 h-4 text-primary-500" />
            <p className="text-sm text-gray-500 font-medium">{t('hr.payroll.progressTitle')}</p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">{t('hr.payroll.progress')}</span>
              <span className="font-bold">45%</span>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>
        <div 
          onClick={createMutation.isPending ? undefined : handleGenerate}
          className={`card p-6 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 cursor-pointer group transition-colors ${createMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {createMutation.isPending ? (
            <Loader2 className="w-8 h-8 text-gray-400 mb-2 animate-spin" />
          ) : (
            <FileCheck className="w-8 h-8 text-gray-400 group-hover:text-primary-500 mb-2 transition-colors" />
          )}
          <p className="font-medium text-gray-600 group-hover:text-primary-600">{t('hr.payroll.generate')}</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">{t('hr.payroll.history')}</h3>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('hr.payroll.month')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('hr.payroll.base')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('hr.payroll.bonus')}</th>
                  <th className="px-6 py-4 font-medium text-right text-rose-500">{t('hr.payroll.deduction')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('hr.payroll.net')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.payroll.date')}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('hr.payroll.status')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('hr.payroll.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {payrolls.map(pr => {
                  const meta = pr.metadata as any || {};
                  const displayStatus = pr.status === 'completed' ? '已發放' : pr.status === 'pending_review' ? '結算中' : '計畫中';
                  return (
                    <tr key={pr.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{pr.title}</td>
                      <td className="px-6 py-4 font-mono text-right text-gray-600 dark:text-gray-300">{meta.totalBase || '-'}</td>
                      <td className="px-6 py-4 font-mono text-right text-emerald-600">{meta.totalBonus || '-'}</td>
                      <td className="px-6 py-4 font-mono text-right text-rose-600">{meta.totalDeductions ? `-${meta.totalDeductions}` : '-'}</td>
                      <td className="px-6 py-4 font-bold font-mono text-right text-gray-900 dark:text-white">{meta.netPay || '-'}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.processDate || pr.createdAt?.split('T')[0]}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          displayStatus === '已發放' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30'
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-gray-500 hover:text-gray-700"><ArrowDownToLine className="w-5 h-5 inline" /></button>
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
