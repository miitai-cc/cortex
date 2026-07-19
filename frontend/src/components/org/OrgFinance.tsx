import { useTranslation } from 'react-i18next';
import { CircleDollarSign, ArrowUpRight, ArrowDownRight, Download, Calendar } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const transactions = [
  { id: 'TRX-101', date: '2023-07-15', description: 'Office Rent - July', type: 'Expense', amount: '$15,000', status: 'Completed' },
  { id: 'TRX-102', date: '2023-07-14', description: 'TechSolutions Q2 Invoice', type: 'Income', amount: '$45,000', status: 'Completed' },
  { id: 'TRX-103', date: '2023-07-12', description: 'AWS Cloud Services', type: 'Expense', amount: '$3,240', status: 'Pending' },
  { id: 'TRX-104', date: '2023-07-10', description: 'Global Logistics Retainer', type: 'Income', amount: '$12,000', status: 'Completed' },
  { id: 'TRX-105', date: '2023-07-08', description: 'Employee Payroll - June', type: 'Expense', amount: '$125,000', status: 'Completed' },
];

export default function OrgFinance() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={CircleDollarSign} title={t('nav.orgManagement.finance')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-xl">
          <p className="text-slate-400 font-medium mb-1">總現金結餘</p>
          <p className="text-4xl font-bold font-mono">$1,245,600</p>
          <div className="mt-4 flex gap-4 text-sm">
            <div>
              <p className="text-slate-400">總資產</p>
              <p className="font-semibold">$4.2M</p>
            </div>
            <div>
              <p className="text-slate-400">總負債</p>
              <p className="font-semibold">$1.1M</p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <p className="text-gray-500 font-medium mb-1">本月營收</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">$145,200</p>
          <div className="mt-4 flex items-center gap-1 text-emerald-600 font-medium text-sm">
            <ArrowUpRight className="w-4 h-4" /> +12.5% (較上月)
          </div>
        </div>

        <div className="card p-6">
          <p className="text-gray-500 font-medium mb-1">本月支出</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">$98,400</p>
          <div className="mt-4 flex items-center gap-1 text-amber-600 font-medium text-sm">
            <ArrowUpRight className="w-4 h-4" /> +4.2% (較上月)
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-lg">近期交易紀錄</h3>
          <div className="flex gap-2">
            <button className="btn btn-secondary px-3 py-2 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" /> 篩選日期
            </button>
            <button className="btn btn-secondary px-3 py-2 flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> 匯出報表
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">交易編號</th>
                <th className="px-6 py-4 font-medium">日期</th>
                <th className="px-6 py-4 font-medium">描述</th>
                <th className="px-6 py-4 font-medium">類型</th>
                <th className="px-6 py-4 font-medium text-right">金額</th>
                <th className="px-6 py-4 font-medium text-center">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">{t.id}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{t.date}</td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{t.description}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1 w-fit ${t.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'Income' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      {t.type === 'Income' ? '收入' : '支出'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-bold text-right font-mono ${t.type === 'Income' ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}`}>
                    {t.type === 'Income' ? '+' : '-'}{t.amount}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30'}`}>
                      {t.status === 'Completed' ? '已完成' : '處理中'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
