import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocument } from '../hooks/useDocuments';
import { ArrowLeft, FileText } from 'lucide-react';

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
        onClick={() => navigate('/documents')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('common.back')}
      </button>

      {doc ? (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{doc.filename}</h1>
              <p className="text-sm text-gray-500">
                {t(`documents.status.${doc.status}`)} · {doc.file_type}
              </p>
            </div>
          </div>
          <div className="border-t pt-4">
            <pre className="text-sm text-gray-600 whitespace-pre-wrap">{doc.content}</pre>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">{t('common.error')}</p>
      )}
    </div>
  );
}
