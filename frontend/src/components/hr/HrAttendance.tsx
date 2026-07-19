import { useTranslation } from 'react-i18next';
import { CalendarClock, CalendarCheck2, Clock, AlertCircle, CalendarRange, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { departmentApi, type DepartmentItem } from '../../services/api';

export default function HrAttendance() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    ['department', 'hr'],
    () => departmentApi.overview('hr')
  );

  const createMutation = useMutation(
    (newItem: any) => departmentApi.createItem('hr', newItem),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['department', 'hr']);
        toast.success(t('hr.attendance.add') + ' - Success');
      },
      onError: () => toast.error('Failed to create'),
    }
  );

  const approveMutation = useMutation(
    ({ id, updatedItem }: { id: string, updatedItem: any }) => departmentApi.updateItem('hr', id, updatedItem),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['department', 'hr']);
        toast.success(t('hr.attendance.approve') + ' - Success');
      },
      onError: () => toast.error('Failed to approve'),
    }
  );

  const attendanceRecords = data?.data.items.filter(i => i.itemType === 'attendance') || [];

  const handleAddDemo = () => {
    createMutation.mutate({
      itemType: 'attendance',
      title: '請假單',
      description: '事假',
      status: 'pending_review',
      priority: 'medium',
      ownerName: 'HR Admin',
      metadata: {
        empId: `E${Math.floor(Math.random() * 9000) + 1000}`,
        name: 'Demo Employee',
        date: new Date().toISOString().split('T')[0],
        type: '事假',
        duration: '8 小時'
      }
    });
  };

  const handleApprove = (record: DepartmentItem) => {
    approveMutation.mutate({
      id: record.id,
      updatedItem: {
        itemType: 'attendance',
        title: record.title,
        status: 'completed',
        priority: record.priority,
        ownerName: record.ownerName,
        metadata: {
          ...(record.metadata as any || {}),
          statusLabel: '已核准'
        }
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={CalendarClock} title={t('nav.hr.attendance')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 border-l-4 border-l-primary-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{t('hr.attendance.todayRate')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">96.5%</p>
          </div>
          <CalendarCheck2 className="w-8 h-8 text-primary-200" />
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{t('hr.attendance.todayLeave')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">12 <span className="text-sm font-normal text-gray-400">{t('hr.attendance.person')}</span></p>
          </div>
          <CalendarRange className="w-8 h-8 text-emerald-200" />
        </div>
        <div className="card p-5 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{t('hr.attendance.pending')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{attendanceRecords.filter(r => r.status === 'pending_review').length} <span className="text-sm font-normal text-gray-400">{t('hr.attendance.record')}</span></p>
          </div>
          <Clock className="w-8 h-8 text-amber-200" />
        </div>
        <div className="card p-5 border-l-4 border-l-rose-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{t('hr.attendance.abnormal')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">8 <span className="text-sm font-normal text-gray-400">{t('hr.attendance.record')}</span></p>
          </div>
          <AlertCircle className="w-8 h-8 text-rose-200" />
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">{t('hr.attendance.recent')}</h3>
          <div className="flex gap-2">
            <button className="btn btn-secondary px-4 py-2 text-sm">{t('hr.attendance.export')}</button>
            <button 
              className="btn btn-primary px-4 py-2 text-sm disabled:opacity-50"
              onClick={handleAddDemo}
              disabled={createMutation.isLoading}
            >
              {createMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('hr.attendance.add')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">{t('hr.attendance.emp')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.attendance.date')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.attendance.type')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.attendance.duration')}</th>
                  <th className="px-6 py-4 font-medium">{t('hr.attendance.status')}</th>
                  <th className="px-6 py-4 font-medium text-right">{t('hr.attendance.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {attendanceRecords.map(record => {
                  const meta = record.metadata as any || {};
                  const displayStatus = meta.statusLabel || (record.status === 'pending_review' ? '待簽核' : record.status === 'completed' ? '已核准' : '異常');
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900 dark:text-gray-100">{meta.name || record.ownerName}</p>
                        <p className="text-xs text-gray-500 font-mono">{meta.empId || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{meta.date || record.createdAt?.split('T')[0]}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{meta.type || record.title}</span>
                      </td>
                      <td className="px-6 py-4 font-medium">{meta.duration || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          displayStatus === '已核准' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          displayStatus === '異常' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {record.status === 'pending_review' && (
                          <button 
                            className="text-emerald-600 hover:text-emerald-700 font-medium text-xs bg-emerald-50 px-2 py-1 rounded disabled:opacity-50"
                            onClick={() => handleApprove(record)}
                            disabled={approveMutation.isLoading}
                          >
                            {t('hr.attendance.approve')}
                          </button>
                        )}
                        <button className="text-primary-600 hover:text-primary-700 font-medium text-xs">{t('hr.attendance.details')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
