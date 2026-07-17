import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Layers, Search, Activity } from 'lucide-react';
import { healthApi } from '../services/api';

const stats = [
  { key: 'totalDocuments', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'totalChunks', icon: Layers, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'recentQueries', icon: Search, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'systemHealth', icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check(),
    refetchInterval: 30000,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('dashboard.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.key} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t(`dashboard.${stat.key}`)}</p>
                <p className="text-2xl font-bold mt-1">
                  {stat.key === 'systemHealth'
                    ? health?.data?.status ?? t('common.loading')
                    : '—'}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
