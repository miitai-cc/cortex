import { useNavigate } from 'react-router-dom';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { projectApi } from '../../services/api';
import { FolderKanban, ArrowRight, LayoutDashboard, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PersonalProjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["personal-projects"],
    queryFn: projectApi.personal,
  });

  const projects = data?.data.projects || [];

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <CommonHeroTitle
        icon={LayoutDashboard}
        title={t('personal.projects.title')}
        description={t('personal.projects.desc')}
        theme={{ titleColor: '#2563eb' }}
        extraButtons={[{ label: t('personal.projects.viewAll'), icon: ArrowRight, onClick: () => navigate('/cortex/projects/information') }]}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
          {t('personal.projects.error')}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md rounded-3xl border border-white/50 dark:border-gray-700/50 shadow-xl">
          <FolderKanban className="h-20 w-20 text-gray-300 mb-6" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">{t('personal.projects.empty.title')}</h2>
          <p className="text-gray-500">{t('personal.projects.empty.desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link 
              key={project.id} 
              to={`/cortex/projects/information?project=${encodeURIComponent(project.id)}`}
              className="group block relative p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-sm">
                    <Target className="h-4 w-4" /> {project.code}
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase tracking-wider">
                    {project.status}
                  </span>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                  {project.name}
                </h3>
                
                <p className="text-gray-500 flex items-center gap-2 mt-4 font-medium">
                  <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                    {(project.managerName || 'U').charAt(0)}
                  </span>
                  {t('personal.projects.manager')} {project.managerName || 'Unknown'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
