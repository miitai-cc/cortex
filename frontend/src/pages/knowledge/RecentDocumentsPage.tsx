import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText } from 'lucide-react';
import { useDocuments } from '../../hooks/useDocuments';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';

export default function RecentDocumentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useDocuments({ sort: 'recent', limit: 10 });

  return (
    <div>
      <CommonHeroTitle icon={Clock} title={t('nav.documents.recent')} description="最近上傳或處理的文件" />

      {isLoading ? (
        <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      ) : (
        <div className="grid gap-3">
          {data?.data?.map((doc: any) => (
            <div
              key={doc.id}
              className="card flex items-center gap-3 cursor-pointer hover:border-primary-300 transition-colors"
              onClick={() => navigate(`/cortex/documents/${doc.id}`)}
            >
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg shrink-0">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{doc.filename}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t(`documents.status.${doc.status}`)} · {doc.file_type}
                </p>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          ))}
          {data?.data?.length === 0 && (
            <div className="card text-center py-8">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">尚無最近處理的文件</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
