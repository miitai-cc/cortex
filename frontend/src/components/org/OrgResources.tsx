import { useTranslation } from 'react-i18next';
import { Users, Calendar, Briefcase, ChevronRight } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

const resources = [
  { name: 'Alice Chen', role: 'Senior Developer', allocation: 85, projects: ['Cortex Core', 'Mobile App'] },
  { name: 'Bob Lin', role: 'UI/UX Designer', allocation: 100, projects: ['Mobile App'] },
  { name: 'Charlie Wang', role: 'DevOps Engineer', allocation: 45, projects: ['Infra Upgrade'] },
  { name: 'David Wu', role: 'Product Manager', allocation: 120, projects: ['Cortex Core', 'IoT Gateway', 'API Gateway'] },
];

export default function OrgResources() {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Users} title={t('nav.orgManagement.resources')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 border-l-4 border-l-primary-500">
          <h3 className="text-gray-500 font-medium mb-1 flex items-center gap-2"><Briefcase className="w-4 h-4" /> 總資源池</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">128 <span className="text-sm font-normal text-gray-500">人</span></p>
        </div>
        <div className="card p-6 border-l-4 border-l-emerald-500">
          <h3 className="text-gray-500 font-medium mb-1 flex items-center gap-2"><Calendar className="w-4 h-4" /> 可分配資源</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">42 <span className="text-sm font-normal text-gray-500">人</span></p>
        </div>
        <div className="card p-6 border-l-4 border-l-rose-500">
          <h3 className="text-gray-500 font-medium mb-1 flex items-center gap-2"><Users className="w-4 h-4" /> 超載資源 (大於100%)</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">15 <span className="text-sm font-normal text-gray-500">人</span></p>
        </div>
      </div>

      <div className="card p-6 mb-8">
        <h3 className="text-lg font-bold mb-6">資源分配熱區圖 (本週)</h3>
        <div className="space-y-6">
          {resources.map((r, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className="w-48 flex-shrink-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">{r.name}</p>
                <p className="text-xs text-gray-500">{r.role}</p>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 truncate">{r.projects.join(', ')}</span>
                  <span className={`font-bold ${r.allocation > 100 ? 'text-rose-500' : 'text-emerald-600'}`}>{r.allocation}%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${r.allocation > 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${Math.min(r.allocation, 100)}%` }}
                  ></div>
                </div>
              </div>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
