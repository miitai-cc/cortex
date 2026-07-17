import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocument } from '../hooks/useDocuments';
import { ArrowLeft, FileText } from 'lucide-react';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useDocument(id!);

  if (isLoading) return <p>{t('common.loading')}</p>;

  const doc = data?.data;

  return (
    <div>
      <button
        onClick={() => navigate('/cortex/documents')}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('common.back')}
      </button>

      {doc ? (
        <div>
          <CommonHeroTitle icon={FileText} title={doc.filename} description={`${t(`documents.status.${doc.status}`)} · ${doc.file_type}`} />
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-8 h-8 text-primary-600" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t(`documents.status.${doc.status}`)} · {doc.file_type}
                </p>
              </div>
            </div>
            <div className="border-t pt-4">
              <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{doc.content}</pre>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">{t('common.error')}</p>
      )}
    </div>
  );
}
