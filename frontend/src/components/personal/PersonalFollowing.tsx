import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { knowledgeApi } from '../../services/api';
import { Bookmark, FileText, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PersonalFollowing() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['knowledge-overview'],
    queryFn: knowledgeApi.overview,
  });

  const model = data?.data ?? {
    currentUser: {},
    records: [],
    interactions: [],
  };

  const followed = new Set(
    model.interactions
      .filter((item: any) => item.type === "follow")
      .map((item: any) => item.targetId),
  );

  const records = model.records.filter((item: any) => followed.has(item.id));

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12 animate-in fade-in duration-700">
      <CommonHeroTitle
        icon={Bookmark}
        title={t('personal.following.title')}
        description={t('personal.following.desc')}
        theme={{ titleColor: '#4f46e5' }}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md rounded-3xl border border-white/50 dark:border-gray-700/50 shadow-xl">
          <Bookmark className="h-20 w-20 text-gray-300 mb-6" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">{t('personal.following.empty.title')}</h2>
          <p className="text-gray-500">{t('personal.following.empty.desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {records.map((item: any) => (
            <Link 
              key={item.id}
              to={`/cortex/documents/detail?id=${item.documentId || item.id}`}
              className="group relative overflow-hidden rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg border border-white/40 dark:border-gray-700/40 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-indigo-100 dark:from-primary-900/40 dark:to-indigo-900/40 flex items-center justify-center mb-4 text-primary-600 dark:text-primary-400">
                  <FileText className="h-6 w-6" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                  {item.title}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-medium text-gray-500">
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700">{item.category}</span>
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700">{item.recordType}</span>
                </div>
              </div>
              
              <div className="absolute bottom-6 right-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
