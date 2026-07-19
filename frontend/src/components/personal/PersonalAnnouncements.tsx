import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { departmentApi } from '../../services/api';
import { Megaphone, BellRing } from 'lucide-react';

export default function PersonalAnnouncements() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['department', 'personal'],
    queryFn: () => departmentApi.overview('personal'),
  });

  const items = data?.data.items.filter((i: any) => i.itemType === 'announcement') || [];

  return (
    <div className="max-w-[1000px] mx-auto px-4 pb-12 animate-in slide-in-from-bottom-8 duration-700">
      <CommonHeroTitle
        icon={Megaphone}
        title={t('personal.announcements.title')}
        description={t('personal.announcements.desc')}
        theme={{ titleColor: '#db2777' }}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md rounded-3xl border border-white/50 dark:border-gray-700/50 shadow-xl">
          <BellRing className="h-16 w-16 text-gray-300 mb-6" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">{t('personal.announcements.empty.title')}</h2>
          <p className="text-gray-500">{t('personal.announcements.empty.desc')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item: any) => (
            <div 
              key={item.id} 
              className="group relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/50 dark:border-gray-700/50 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-rose-400 to-pink-500"></div>
              
              <div className="flex justify-between items-start mb-3 pl-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-rose-600 transition-colors">
                  {item.title}
                </h3>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 rounded-full uppercase tracking-wider">
                  {(item.metadata as any)?.tag || 'News'}
                </span>
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 pl-2 mb-4">
                {item.description}
              </p>
              
              <div className="pl-2 flex items-center text-xs text-gray-400 font-medium">
                {new Date(item.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
