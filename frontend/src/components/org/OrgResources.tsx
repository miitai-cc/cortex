import { useTranslation } from 'react-i18next';
import { Users, Calendar, Briefcase, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem, type DepartmentItemPayload } from '../../services/api';

export default function OrgResources() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['department', 'org_management'],
    queryFn: () => departmentApi.overview('org_management'),
  });

  const createMutation = useMutation({
    mutationFn: (newItem: DepartmentItemPayload) => departmentApi.createItem('org_management', newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'org_management'] });
      toast.success('Added Resource - Success');
    },
    onError: () => toast.error('Failed to create'),
  });

  const resources = data?.data.items.filter(i => i.itemType === 'resource') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'resource',
      title: 'Demo Resource',
      description: 'DevOps',
      status: 'active',
      priority: 'high',
      ownerName: 'Admin',
      metadata: {
        role: 'Senior Developer',
        allocation: 85,
        projects: ['Cortex Core', 'Mobile App']
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <div className="flex justify-between items-center mb-6">
        <CommonHeroTitle icon={Users} title={t('nav.orgManagement.resources')} />
        <button 
          className="btn btn-primary disabled:opacity-50"
          onClick={handleAddDemo}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '+ Demo'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 border-l-4 border-l-primary-500">
          <h3 className="text-gray-500 font-medium mb-1 flex items-center gap-2"><Briefcase className="w-4 h-4" /> {t('org.resources.pool')}</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">128 <span className="text-sm font-normal text-gray-500">{t('org.resources.people')}</span></p>
        </div>
        <div className="card p-6 border-l-4 border-l-emerald-500">
          <h3 className="text-gray-500 font-medium mb-1 flex items-center gap-2"><Calendar className="w-4 h-4" /> {t('org.resources.available')}</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">42 <span className="text-sm font-normal text-gray-500">{t('org.resources.people')}</span></p>
        </div>
        <div className="card p-6 border-l-4 border-l-rose-500">
          <h3 className="text-gray-500 font-medium mb-1 flex items-center gap-2"><Users className="w-4 h-4" /> {t('org.resources.overload')}</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">15 <span className="text-sm font-normal text-gray-500">{t('org.resources.people')}</span></p>
        </div>
      </div>

      <div className="card p-6 mb-8">
        <h3 className="text-lg font-bold mb-6">{t('org.resources.heatmap')}</h3>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
        ) : (
          <div className="space-y-6">
            {resources.map((r, idx) => {
              const meta = r.metadata as any || {};
              const projects = meta.projects || [];
              const allocation = meta.allocation || 0;
              return (
                <div key={r.id} className="flex items-center gap-4">
                  <div className="w-48 flex-shrink-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
                    <p className="text-xs text-gray-500">{meta.role || r.description}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500 truncate">{Array.isArray(projects) ? projects.join(', ') : ''}</span>
                      <span className={`font-bold ${allocation > 100 ? 'text-rose-500' : 'text-emerald-600'}`}>{allocation}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${allocation > 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(allocation, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
            {resources.length === 0 && (
              <div className="text-center text-gray-500 py-4">No resources</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
