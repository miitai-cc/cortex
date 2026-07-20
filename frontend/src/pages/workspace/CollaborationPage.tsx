import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from 'eiva-fe-security';
import { ClipboardList, MessagesSquare } from 'lucide-react';
import { useParams } from 'react-router-dom';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import IssueTracker from '../../components/collaboration/IssueTracker';
import TeamChannels from '../../components/collaboration/TeamChannels';
import ProjectCollaborationPanel from '../../components/collaboration/ProjectCollaborationPanel';
import DiscussionBoard from '../../components/collaboration/DiscussionBoard';
import CircularMessages from '../../components/collaboration/CircularMessages';
import { Announcements, Workflows, CalendarView, Bookings } from '../../components/collaboration/CollaborationFeatures';
import { collaborationApi } from '../../services/api';
import type { CollaborationOverview } from '../../types/collaboration';

export default function CollaborationPage() {
  const { t } = useTranslation();
  const { section = 'channels' } = useParams();
  const token = useAuthStore((state) => state.token) ?? '';
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['collaboration-overview'],
    queryFn: collaborationApi.overview,
  });
  const model = overview.data?.data as CollaborationOverview | undefined;

  useEffect(() => {
    if (!token || (section !== 'issues' && section !== 'my-issues')) return;
    const socket = new WebSocket(collaborationApi.websocketUrl('__issues__', token));
    socket.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['collaboration-issues'] });
    };
    return () => socket.close();
  }, [queryClient, section, token]);

  const issueMode = section === 'issues' || section === 'my-issues';
  const projectMode = section === 'projects';
  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-8">
      <CommonHeroTitle
        icon={issueMode ? ClipboardList : MessagesSquare}
        title={issueMode ? t('collaboration.issueTracking') : projectMode ? t('collaboration.projectTitle') : t('collaboration.teamTitle')}
        description={
          issueMode
            ? t('collaboration.issueDesc')
            : projectMode
              ? t('collaboration.projectDesc')
            : t('collaboration.teamDesc')
        }
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] });
          queryClient.invalidateQueries({ queryKey: ['collaboration-issues'] });
        }}
      />
      {overview.isLoading && <div className="card py-14 text-center text-gray-500">{t('collaboration.loading')}</div>}
      {overview.isError && (
        <div className="card border-red-200 py-14 text-center text-red-600">
          {t('collaboration.loadError')}
        </div>
      )}
      {model && (
        section === 'announcements' ? (
          <Announcements />
        ) : section === 'workflows' ? (
          <Workflows />
        ) : section === 'calendar' ? (
          <CalendarView />
        ) : section === 'bookings' ? (
          <Bookings />
        ) : section === 'circulars' ? (
          <CircularMessages />
        ) : section === 'discussions' ? (
          <DiscussionBoard />
        ) : projectMode ? (
          <ProjectCollaborationPanel />
        ) : issueMode ? (
          <IssueTracker overview={model} onlyMine={section === 'my-issues'} />
        ) : (
          <TeamChannels overview={model} token={token} />
        )
      )}
    </div>
  );
}
