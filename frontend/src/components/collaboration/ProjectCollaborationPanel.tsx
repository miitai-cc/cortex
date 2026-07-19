import { useQuery } from '@tanstack/react-query';
import { FolderKanban, MessageSquare, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { projectApi } from '../../services/api';

export default function ProjectCollaborationPanel() {
  const projects = useQuery({
    queryKey: ['project-overview'],
    queryFn: () => projectApi.overview(),
  });
  if (projects.isLoading) return <div className="card py-14 text-center text-gray-500">載入專案協作資料…</div>;
  if (projects.isError) return <div className="card border-red-200 py-14 text-center text-red-600">無法載入專案協作資料</div>;
  const items = projects.data?.data.projects ?? [];
  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-4">
        <span className="rounded-xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-900/30"><MessageSquare className="h-6 w-6" /></span>
        <div><h2 className="font-semibold">專案與團隊通訊已同步</h2><p className="text-sm text-gray-500">建立專案時自動建立頻道；專案、任務、預算、人員、需求與稽核異動均會留下頻道訊息。</p></div>
        <Link className="btn-primary ml-auto" to="/cortex/projects/information">管理專案</Link>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((project) => (
          <article className="card" key={project.id}>
            <div className="flex items-start gap-3"><FolderKanban className="mt-0.5 h-6 w-6 text-primary-600" /><div className="min-w-0"><span className="text-xs font-bold text-primary-600">{project.code}</span><h3 className="truncate font-semibold">{project.name}</h3></div></div>
            <p className="mt-3 line-clamp-2 min-h-10 text-sm text-gray-500">{project.description || '尚未填寫專案說明'}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-gray-500"><Users className="h-3.5 w-3.5" />專案經理：{project.managerName}</p>
            <div className="mt-4 flex gap-2">
              <Link className="btn-secondary flex-1 text-center text-sm" to={`/cortex/projects/information?project=${encodeURIComponent(project.id)}`}>專案資訊</Link>
              {project.collaborationChannelId && <Link className="btn-primary flex-1 text-center text-sm" to={`/cortex/collaboration/channels?channel=${encodeURIComponent(project.collaborationChannelId)}`}>進入頻道</Link>}
            </div>
          </article>
        ))}
        {!items.length && <div className="card col-span-full py-14 text-center text-gray-500">尚無專案。請先至專案管理建立專案與協作頻道。</div>}
      </div>
    </div>
  );
}
