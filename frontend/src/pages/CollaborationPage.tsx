import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from 'eiva-fe-security';
import { ClipboardList, MessagesSquare } from 'lucide-react';
import { useParams } from 'react-router-dom';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import IssueTracker from '../components/collaboration/IssueTracker';
import TeamChannels from '../components/collaboration/TeamChannels';
import { collaborationApi } from '../services/api';
import type { CollaborationOverview } from '../types/collaboration';

export default function CollaborationPage() {
  const { section = 'channels' } = useParams();
  const token = useAuthStore((state) => state.token) ?? '';
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['collaboration-overview'],
    queryFn: collaborationApi.overview,
  });
  const model = overview.data?.data as CollaborationOverview | undefined;

  useEffect(() => {
    if (!token || section === 'channels') return;
    const socket = new WebSocket(collaborationApi.websocketUrl('__issues__', token));
    socket.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['collaboration-issues'] });
    };
    return () => socket.close();
  }, [queryClient, section, token]);

  const issueMode = section === 'issues' || section === 'my-issues';
  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-8">
      <CommonHeroTitle
        icon={issueMode ? ClipboardList : MessagesSquare}
        title={issueMode ? 'Issue 工作追蹤' : '團隊協作'}
        description={
          issueMode
            ? '規劃、指派與追蹤工作，並保留留言及完整狀態歷程'
            : 'Cortex 內建的多人頻道、討論串、提及、表情、搜尋與即時訊息'
        }
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] });
          queryClient.invalidateQueries({ queryKey: ['collaboration-issues'] });
        }}
      />
      {overview.isLoading && <div className="card py-14 text-center text-gray-500">載入協作空間…</div>}
      {overview.isError && (
        <div className="card border-red-200 py-14 text-center text-red-600">
          無法載入協作資料，請確認後端服務與登入狀態。
        </div>
      )}
      {model &&
        (issueMode ? (
          <IssueTracker overview={model} onlyMine={section === 'my-issues'} />
        ) : (
          <TeamChannels overview={model} token={token} />
        ))}
    </div>
  );
}
