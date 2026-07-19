import { useTranslation } from 'react-i18next';
import { CircleDollarSign, Calculator, FileCheck, ArrowDownToLine, Banknote } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const payrolls = [
  { month: '2023-07', status: '結算中', totalBase: '$1,250,000', totalBonus: '$120,000', totalDeductions: '$185,000', netPay: '-', processDate: '2023-08-05' },
  { month: '2023-06', status: '已發放', totalBase: '$1,245,000', totalBonus: '$85,000', totalDeductions: '$184,500', netPay: '$1,145,500', processDate: '2023-07-05' },
  { month: '2023-05', status: '已發放', totalBase: '$1,240,000', totalBonus: '$90,000', totalDeductions: '$183,000', netPay: '$1,147,000', processDate: '2023-06-05' },
  { month: '2023-04', status: '已發放', totalBase: '$1,235,000', totalBonus: '$92,000', totalDeductions: '$182,500', netPay: '$1,144,500', processDate: '2023-05-05' },
];

export default function HrPayroll() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={CircleDollarSign} title={t('nav.hr.payroll')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <Banknote className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-3xl font-bold font-mono">$1,145,500</p>
          <p className="text-sm font-medium text-emerald-100">上月實發總額</p>
        </div>
        <div className="card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-4 h-4 text-primary-500" />
            <p className="text-sm text-gray-500 font-medium">當前薪資結算進度 (7月份)</p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">結算進度</span>
              <span className="font-bold">45%</span>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 cursor-pointer group transition-colors">
          <FileCheck className="w-8 h-8 text-gray-400 group-hover:text-primary-500 mb-2 transition-colors" />
          <p className="font-medium text-gray-600 group-hover:text-primary-600">產生薪資條</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">歷史薪資結算紀錄</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-medium">計薪月份</th>
                <th className="px-6 py-4 font-medium text-right">本薪總額</th>
                <th className="px-6 py-4 font-medium text-right">獎金/津貼</th>
                <th className="px-6 py-4 font-medium text-right text-rose-500">代扣/勞健保</th>
                <th className="px-6 py-4 font-medium text-right">實發總額</th>
                <th className="px-6 py-4 font-medium">發放日</th>
                <th className="px-6 py-4 font-medium text-center">狀態</th>
                <th className="px-6 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {payrolls.map(pr => (
                <tr key={pr.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{pr.month}</td>
                  <td className="px-6 py-4 font-mono text-right text-gray-600 dark:text-gray-300">{pr.totalBase}</td>
                  <td className="px-6 py-4 font-mono text-right text-emerald-600">{pr.totalBonus}</td>
                  <td className="px-6 py-4 font-mono text-right text-rose-600">-{pr.totalDeductions}</td>
                  <td className="px-6 py-4 font-bold font-mono text-right text-gray-900 dark:text-white">{pr.netPay}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{pr.processDate}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      pr.status === '已發放' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30'
                    }`}>
                      {pr.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-500 hover:text-gray-700"><ArrowDownToLine className="w-5 h-5 inline" /></button>
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
