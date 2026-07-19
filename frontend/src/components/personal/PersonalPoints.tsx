import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { knowledgeApi } from '../../services/api';
import { Award, Zap, TrendingUp, Trophy } from 'lucide-react';

export default function PersonalPoints() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['knowledge-overview'],
    queryFn: knowledgeApi.overview,
  });

  const model = data?.data ?? { pointEvents: [] };
  const total = model.pointEvents.reduce((sum: number, item: any) => sum + item.points, 0);

  return (
    <div className="max-w-[1200px] mx-auto px-4 pb-12 animate-in zoom-in-95 duration-700">
      <CommonHeroTitle
        icon={Trophy}
        title={`${total} ${t('personal.points.title')}`}
        description={t('personal.points.desc')}
        theme={{ titleColor: '#f59e0b' }}
      />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
        </div>
      ) : (
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-8 border border-white/40 dark:border-gray-700/40 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-rose-500/10 blur-3xl rounded-full"></div>
          
          <div className="relative z-10">
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-8 text-gray-800 dark:text-gray-100">
              <TrendingUp className="text-amber-500" /> {t('personal.points.recent')}
            </h2>

            {!model.pointEvents.length ? (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">{t('personal.points.empty')}</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-amber-100 dark:border-amber-900/30 ml-4 space-y-8 pb-4">
                {model.pointEvents.map((item: any, index: number) => (
                  <div key={`${item.createdAt}-${index}`} className="relative pl-8 group">
                    <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-white dark:bg-gray-800 border-4 border-amber-400 group-hover:scale-125 transition-transform duration-300 shadow-sm"></div>
                    
                    <div className="bg-white/80 dark:bg-gray-800/80 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm group-hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">{item.reason}</h3>
                        <span className={`font-black text-xl px-3 py-1 rounded-lg ${item.points > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                          {item.points > 0 ? "+" : ""}{item.points}
                        </span>
                      </div>
                      <time className="text-sm text-gray-500 font-medium">{new Date(item.createdAt).toLocaleString()}</time>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
