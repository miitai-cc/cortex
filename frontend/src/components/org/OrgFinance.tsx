import { useTranslation } from 'react-i18next';
import { CircleDollarSign, ArrowUpRight, ArrowDownRight, Download, Calendar, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem } from '../../services/api';

export default function OrgFinance() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery(
    ['department', 'org_management'],
    () => departmentApi.overview('org_management')
  );

  const transactions = data?.data.items.filter(i => i.itemType === 'finance') || [];

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={CircleDollarSign} title={t('nav.orgManagement.finance')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-xl">
          <p className="text-slate-400 font-medium mb-1">{t('org.finance.balance')}</p>
          <p className="text-4xl font-bold font-mono">$1,245,600</p>
          <div className="mt-4 flex gap-4 text-sm">
            <div>
              <p className="text-slate-400">{t('org.finance.assets')}</p>
              <p className="font-semibold">$4.2M</p>
            </div>
            <div>
              <p className="text-slate-400">{t('org.finance.liabilities')}</p>
              <p className="font-semibold">$1.1M</p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <p className="text-gray-500 font-medium mb-1">{t('org.finance.revenue')}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">$145,200</p>
          <div className="mt-4 flex items-center gap-1 text-emerald-600 font-medium text-sm">
            <ArrowUpRight className="w-4 h-4" /> +12.5% ({t('org.finance.revenueChange')})
          </div>
        </div>

        <div className="card p-6">
          <p className="text-gray-500 font-medium mb-1">{t('org.finance.expense')}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">$98,400</p>
          <div className="mt-4 flex items-center gap-1 text-amber-600 font-medium text-sm">
            <ArrowUpRight className="w-4 h-4" /> +4.2% ({t('org.finance.expenseChange')})
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-lg">{t('org.finance.transactions')}</h3>
          <div className="flex gap-2">
            <button className="btn btn-secondary px-3 py-2 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" /> {t('org.finance.filterDate')}
            </button>
            <button className="btn btn-secondary px-3 py-2 flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> {t('org.finance.export')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('org.finance.id')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.finance.date')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.finance.desc')}</th>
                  <th className="px-6 py-4 font-medium">{t('org.finance.type')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('org.finance.amount')}</th>
                  <th className="px-6 py-4 font-medium text-center">{t('org.finance.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((tItem) => {
                  const meta = tItem.metadata as any || {};
                  return (
                    <tr key={tItem.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">{meta.id || tItem.id.slice(0,6)}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.date || tItem.createdAt?.split('T')[0]}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{tItem.title}</td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1 w-fit ${meta.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {meta.type === 'Income' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          {meta.type === 'Income' ? '收入' : '支出'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 font-bold text-right font-mono ${meta.type === 'Income' ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}`}>
                        {meta.type === 'Income' ? '+' : '-'}{meta.amount || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${tItem.status === 'completed' || meta.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30'}`}>
                          {tItem.status === 'completed' || meta.status === 'Completed' ? '已完成' : '處理中'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {transactions.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-4 text-gray-500">No transactions.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
