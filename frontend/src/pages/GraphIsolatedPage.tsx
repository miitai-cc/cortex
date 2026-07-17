import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { graphApi } from '../services/api';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

export default function GraphIsolatedPage() {
  const { t } = useTranslation();
  const [isolated, setIsolated] = useState<{ id: string; label: string; type: string; link_count: number }[]>([]);
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
        const isolatedNodes = graphData.nodes.filter(
          (n: any) => (adj.get(n.id)?.size ?? 0) <= 1
        );
        setIsolated(isolatedNodes);
      } catch (e) {
        console.error('Failed to load graph data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <CommonHeroTitle icon={AlertTriangle} title={t('nav.graph.isolated')} description="找出知識圖譜中孤立或連結稀少的節點" />

      {loading ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : isolated.length === 0 ? (
        <div className="card text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">所有節點均有良好連結</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 mb-2">
            共找到 <span className="font-medium text-amber-600">{isolated.length}</span> 個孤立節點
          </p>
          {isolated.map((node) => (
            <div key={node.id} className="card flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{node.label}</p>
                <p className="text-xs text-gray-400">
                  類型: {node.type} · 連結數: {node.link_count}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
