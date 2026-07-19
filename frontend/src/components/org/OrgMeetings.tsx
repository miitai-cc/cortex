import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Calendar as CalendarIcon, Link2, Check, Clock, Video, Users, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem, type DepartmentItemPayload } from '../../services/api';

export default function OrgMeetings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isLinked, setIsLinked] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['department', 'org_management'],
    queryFn: () => departmentApi.overview('org_management'),
  });

  const createMutation = useMutation({
    mutationFn: (newItem: DepartmentItemPayload) => departmentApi.createItem('org_management', newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'org_management'] });
      toast.success(t('org.meetings.add') + ' - Success');
    },
    onError: () => toast.error('Failed to create'),
  });

  const meetings = data?.data.items.filter(i => i.itemType === 'meeting') || [];

  // For demonstration, let's link automatically if there are meetings, or we can just leave it manual
  useEffect(() => {
    if (meetings.length > 0) {
      setIsLinked(true);
    }
  }, [meetings.length]);

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'meeting',
      title: 'Demo Meeting',
      description: 'Project Sync',
      status: 'active',
      priority: 'medium',
      ownerName: 'Admin',
      metadata: {
        time: '10:00 AM - 11:30 AM',
        type: 'Google Meet',
        attendees: 12
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={CalendarDays} title={t('nav.orgManagement.meetings')} />

      {/* Settings / Auth area */}
      <div className="card p-6 mb-8 border-l-4 border-l-primary-500 bg-primary-50/50 dark:bg-primary-900/10">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <CalendarIcon className="w-5 h-5 text-primary-600" /> {t('org.meetings.googleSetting')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('org.meetings.googleDesc')}
            </p>
          </div>
          <div>
            {isLinked ? (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-emerald-600 font-medium text-sm bg-emerald-50 px-3 py-1.5 rounded-full">
                  <Check className="w-4 h-4" /> {t('org.meetings.linked')} (user@example.com)
                </span>
                <button onClick={() => setIsLinked(false)} className="text-sm text-gray-500 hover:text-gray-700 underline">{t('org.meetings.unlink')}</button>
              </div>
            ) : (
              <button 
                onClick={() => setIsLinked(true)} 
                className="btn bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border shadow-sm flex items-center gap-2 px-4 py-2 hover:bg-gray-50"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-4 h-4" />
                {t('org.meetings.linkAccount')}
              </button>
            )}
          </div>
        </div>
        
        {isLinked && (
          <div className="mt-6 pt-6 border-t dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('org.meetings.syncMode')}</label>
              <select className="w-full border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 p-2 text-sm">
                <option>雙向同步 (推薦)</option>
                <option>僅讀取 Google Calendar</option>
                <option>僅寫入 Google Calendar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('org.meetings.syncFreq')}</label>
              <select className="w-full border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 p-2 text-sm">
                <option>即時 (Webhook)</option>
                <option>每 15 分鐘</option>
                <option>每小時</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary w-full">{t('org.meetings.saveSettings')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Meeting Agenda */}
      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">{t('org.meetings.agenda')}</h3>
          <button 
            className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50" 
            disabled={!isLinked || createMutation.isPending}
            onClick={handleAddDemo}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('org.meetings.add')}
          </button>
        </div>
        <div className="p-6">
          {!isLinked ? (
            <div className="text-center py-10">
              <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('org.meetings.notLinked')}</h4>
              <p className="text-gray-500">{t('org.meetings.notLinkedDesc')}</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-10 text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <div className="space-y-4">
              {meetings.map(event => {
                const meta = event.metadata as any || {};
                return (
                  <div key={event.id} className="flex gap-4 p-4 border dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow">
                    <div className="w-2 bg-primary-500 rounded-full"></div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg mb-1">{event.title}</h4>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {meta.time || 'TBD'}</span>
                        <span className="flex items-center gap-1"><Video className="w-4 h-4" /> {meta.type || 'Virtual'}</span>
                        <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {meta.attendees || 1} 人參與</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <button className="btn btn-secondary text-sm">{t('org.meetings.join')}</button>
                    </div>
                  </div>
                );
              })}
              {meetings.length === 0 && (
                <div className="text-center text-gray-500 py-4">No meetings scheduled.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
