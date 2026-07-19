import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { graphApi } from '../services/api';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

const COMMUNITY_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f97316',
  '#84cc16', '#06b6d4', '#a855f7', '#e11d48',
];

export default function GraphCommunityPage() {
  const { t } = useTranslation();
  const [communities, setCommunities] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await graphApi.getData();
        const graphData = res.data;
        const adj = new Map<string, Set<string>>();
        for (const n of graphData.nodes) adj.set(n.id, new Set());
        for (const e of graphData.edges) {
          adj.get(e.source)?.add(e.target);
          adj.get(e.target)?.add(e.source);
        }
        const visited = new Set<string>();
        const comms: Record<number, string[]> = {};
        let commId = 0;
        for (const n of graphData.nodes) {
          if (visited.has(n.id)) continue;
          const queue = [n.id];
          const members: string[] = [];
          visited.add(n.id);
          while (queue.length > 0) {
            const current = queue.shift()!;
            members.push(current);
            for (const neighbor of adj.get(current) ?? []) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
              }
            }
          }
          if (members.length > 1) {
            const labels = members.map((id) => graphData.nodes.find((n: any) => n.id === id)?.label ?? id);
            comms[commId] = labels;
            commId++;
          }
        }
        setCommunities(comms);
      } catch (e) {
        console.error('Failed to load graph data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const communityEntries = Object.entries(communities);

  return (
    <div>
      <CommonHeroTitle icon={Users} title={t('nav.graph.community')} description="分析知識圖譜中的社群結構" />

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      ) : communityEntries.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">未偵測到社群結構</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {communityEntries.map(([id, members]) => {
            const color = COMMUNITY_COLORS[Number(id) % COMMUNITY_COLORS.length];
            return (
              <div key={id} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">社群 {Number(id) + 1}</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{members.length} 個節點</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((label) => (
                    <span key={label} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
