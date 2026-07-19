import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentApi } from '../../services/api';
import { ClipboardList, CheckCircle2, Clock, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PersonalTasks() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['department', 'personal'],
    queryFn: () => departmentApi.overview('personal'),
  });

  const createMutation = useMutation({
    mutationFn: (newItem: any) => departmentApi.createItem('personal', newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'personal'] });
      toast.success('Task created');
    },
    onError: () => toast.error('Failed to create task'),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, updatedItem }: { id: string, updatedItem: any }) => 
      departmentApi.updateItem('personal', id, updatedItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'personal'] });
    },
  });

  const items = data?.data.items.filter((i: any) => i.itemType === 'task') || [];
  
  const pendingTasks = items.filter(i => i.status !== 'completed');
  const completedTasks = items.filter(i => i.status === 'completed');

  const handleAdd = () => {
    const title = window.prompt("Task Title:");
    if (!title) return;
    createMutation.mutate({
      itemType: 'task',
      title: title,
      description: '',
      status: 'pending',
      priority: 'medium',
      metadata: { dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0] },
    });
  };

  const handleComplete = (item: any) => {
    completeMutation.mutate({
      id: item.id,
      updatedItem: { ...item, status: 'completed' }
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 pb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <CommonHeroTitle
        icon={ClipboardList}
        title={t('personal.tasks.title')}
        description={t('personal.tasks.desc')}
        theme={{ titleColor: '#4f46e5' }}
        extraButtons={[{ label: t('personal.tasks.new'), icon: Plus, onClick: handleAdd }]}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* {t('personal.tasks.pending')} Tasks */}
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl p-8 border border-white/40 dark:border-gray-700/40 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center text-sm">{pendingTasks.length}</span>
              {t('personal.tasks.pending')}
            </h2>
            
            {pendingTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                {t('personal.tasks.empty')}
              </div>
            ) : (
              <div className="space-y-4 relative z-10">
                {pendingTasks.map((item: any) => (
                  <div key={item.id} className="group flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                    <button onClick={() => handleComplete(item)} className="mt-1 text-gray-300 hover:text-green-500 transition-colors">
                      <CheckCircle2 className="h-6 w-6" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg mb-1">{item.title}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded">
                          <Clock className="h-3.5 w-3.5" /> {t('personal.tasks.due')} {(item.metadata as any)?.dueDate || 'N/A'}
                        </span>
                        <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* {t('personal.tasks.completed')} Tasks */}
          <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl rounded-3xl p-8 border border-white/20 dark:border-gray-700/20 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-500 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center text-sm">{completedTasks.length}</span>
              {t('personal.tasks.completed')}
            </h2>
            
            <div className="space-y-4 opacity-70">
              {completedTasks.slice(0, 5).map((item: any) => (
                <div key={item.id} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <CheckCircle2 className="mt-1 h-6 w-6 text-green-500" />
                  <div className="flex-1 min-w-0 line-through text-gray-500">
                    <p className="font-semibold text-lg mb-1">{item.title}</p>
                  </div>
                </div>
              ))}
              {completedTasks.length > 5 && (
                <p className="text-center text-sm text-gray-400 pt-4">+{completedTasks.length - 5} more completed tasks</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
