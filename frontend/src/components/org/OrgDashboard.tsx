import { useTranslation } from 'react-i18next';
import { Building2, TrendingUp, Users, DollarSign, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const kpiData = [
  {
    title: '本月營收 (M)',
    value: '$12.4M',
    change: '+8.2%',
    trend: 'up',
    icon: DollarSign,
  },
  {
    title: '活躍專案數',
    value: '45',
    change: '+12%',
    trend: 'up',
    icon: Activity,
  },
  {
    title: '員工總數',
    value: '1,284',
    change: '+3.1%',
    trend: 'up',
    icon: Users,
  },
  {
    title: '營運支出 (M)',
    value: '$4.2M',
    change: '-2.4%',
    trend: 'down',
    icon: TrendingUp,
  },
];

const revenueData = [
  { month: '1月', revenue: 8.5, target: 8.0 },
  { month: '2月', revenue: 9.1, target: 8.2 },
  { month: '3月', revenue: 10.4, target: 8.5 },
  { month: '4月', revenue: 11.2, target: 9.0 },
  { month: '5月', revenue: 11.8, target: 9.5 },
  { month: '6月', revenue: 12.4, target: 10.0 },
];

const expensesData = [
  { category: '人事成本', value: 2.1 },
  { category: '研發支出', value: 1.2 },
  { category: '行銷費用', value: 0.6 },
  { category: '行政營運', value: 0.3 },
];

const recentActivities = [
  { id: 1, title: 'Q2 財報會議', department: '財務部', status: '已完成', date: '2023-07-15' },
  { id: 2, title: '新辦公室租約簽署', department: '總務部', status: '進行中', date: '2023-07-18' },
  { id: 3, title: '核心系統升級計畫', department: '資訊部', status: '規劃中', date: '2023-07-20' },
  { id: 4, title: '年度員工滿意度調查', department: '人資部', status: '已完成', date: '2023-07-10' },
];

export default function OrgDashboard() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Building2} title={t('nav.orgManagement.dashboard')} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiData.map((kpi, idx) => (
          <div key={idx} className="card p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                <kpi.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                kpi.trend === 'up' 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {kpi.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {kpi.change}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{kpi.title}</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Chart */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-6">營收與目標達成趨勢 (百萬)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="實際營收" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="target" name="目標營收" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-6">營運支出結構</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expensesData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#f3f4f6'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" name="支出 (M)" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="card">
        <div className="p-6 border-b dark:border-gray-700">
          <h3 className="text-lg font-bold">近期重大營運活動</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">活動名稱</th>
                <th className="px-6 py-4 font-medium">主辦部門</th>
                <th className="px-6 py-4 font-medium">日期</th>
                <th className="px-6 py-4 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentActivities.map((activity) => (
                <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{activity.title}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{activity.department}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{activity.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      activity.status === '已完成' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      activity.status === '進行中' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {activity.status}
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
