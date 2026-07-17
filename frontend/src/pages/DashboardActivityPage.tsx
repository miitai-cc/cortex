import { useTranslation } from 'react-i18next';
import { Activity, FileText, Search, MessageSquare, FlaskConical } from 'lucide-react';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

const mockActivities = [
  { id: '1', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', action: '上傳文件', target: 'research_paper.pdf', time: '5 分鐘前' },
  { id: '2', icon: Search, color: 'text-purple-600', bg: 'bg-purple-50', action: '執行檢索', target: '機器學習模型比較', time: '12 分鐘前' },
  { id: '3', icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50', action: '建立對話', target: '文件摘要分析', time: '30 分鐘前' },
  { id: '4', icon: FlaskConical, color: 'text-orange-600', bg: 'bg-orange-50', action: '深層研究', target: 'Transformer 架構演進', time: '1 小時前' },
  { id: '5', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', action: '上傳文件', target: 'dataset_v2.xlsx', time: '2 小時前' },
  { id: '6', icon: Search, color: 'text-purple-600', bg: 'bg-purple-50', action: '執行檢索', target: 'RAG 架構最佳實踐', time: '3 小時前' },
];

export default function DashboardActivityPage() {
  const { t } = useTranslation();

  return (
    <div>
      <CommonHeroTitle icon={Activity} title={t('nav.dashboard.activity')} description="查看系統最近的操作紀錄" />

      <div className="card">
        <div className="space-y-1">
          {mockActivities.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-lg ${item.bg}`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{item.action}</span>
                    <span className="mx-1.5 text-gray-400">·</span>
                    <span className="text-gray-500 truncate">{item.target}</span>
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{item.time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
