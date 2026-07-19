import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { departmentApi } from '../../services/api';
import { User, Clock, Calendar, Briefcase, Activity } from 'lucide-react';

export default function PersonalStatus() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['department', 'personal'],
    queryFn: () => departmentApi.overview('personal'),
  });

  const items = data?.data.items.filter((i: any) => i.itemType === 'status') || [];
  const statusRecord = items[0] || { metadata: {} };
  const meta = statusRecord.metadata as any;

  return (
    <div className="max-w-[1200px] mx-auto px-4 pb-12 animate-in fade-in zoom-in-95 duration-700">
      <CommonHeroTitle
        icon={User}
        title={t('personal.status.title')}
        description={t('personal.status.desc')}
        theme={{ titleColor: '#059669' }}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Punch Records */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-8 border border-white/50 dark:border-gray-700/50 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-8 text-gray-800 dark:text-gray-100">
              <Clock className="text-teal-500 h-6 w-6" /> {t('personal.status.punch')}
            </h2>

            <div className="space-y-6 relative z-10">
              <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-4 mb-2 sm:mb-0">
                  <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center">
                    <Activity className="h-5 w-5" />
                  </div>
                  <span className="text-gray-600 dark:text-gray-300 font-medium text-lg">{t('personal.status.punchIn')}</span>
                </div>
                <span className="font-mono font-black text-2xl text-teal-600 dark:text-teal-400">
                  {meta.punchIn || '08:53:12'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-4 mb-2 sm:mb-0">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-full flex items-center justify-center">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <span className="text-gray-600 dark:text-gray-300 font-medium text-lg">{t('personal.status.punchOut')}</span>
                </div>
                <span className="font-mono font-bold text-2xl text-gray-400">
                  {meta.punchOut || '--:--:--'}
                </span>
              </div>
            </div>
          </div>

          {/* {t('personal.status.overview')} */}
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mb-32"></div>
            
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-8 text-white">
              <Calendar className="text-teal-200 h-6 w-6" /> {t('personal.status.overview')}
            </h2>

            <div className="grid grid-cols-2 gap-6 relative z-10">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center">
                <p className="text-teal-100 font-medium mb-1">{t('personal.status.late')}</p>
                <p className="text-4xl font-black">{meta.lateCount || 0}</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center">
                <p className="text-teal-100 font-medium mb-1">{t('personal.status.leave')}</p>
                <p className="text-4xl font-black">{meta.leaveHours || 8}</p>
              </div>

              <div className="col-span-2 bg-white/20 backdrop-blur-md rounded-2xl p-6 border border-white/30 flex justify-between items-center">
                <span className="text-lg font-medium text-teal-50">{t('personal.status.pto')}</span>
                <span className="text-3xl font-black text-white">{meta.ptoBalance || '14.5'} {t('personal.status.days')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
