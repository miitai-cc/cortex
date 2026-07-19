import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { List, Search as SearchIcon, Trash2, FileText } from 'lucide-react';
import { useDocuments, useDeleteDocument } from '../../hooks/useDocuments';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';

export default function DocumentListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useDocuments({ search });
  const deleteMutation = useDeleteDocument();

  return (
    <div className="max-w-11xl mx-auto px-4 ">
      <CommonHeroTitle icon={List} title={t('nav.documents.list')} description="瀏覽所有已上傳的文件" />

      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          className="input-field pl-10"
          placeholder={t('documents.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      ) : (
        <div className="grid gap-3">
          {data?.data?.map((doc: any) => (
            <div key={doc.id} className="card flex items-center justify-between hover:border-primary-300 transition-colors">
              <div
                className="flex items-center gap-3 flex-1 cursor-pointer"
                onClick={() => navigate(`/cortex/documents/${doc.id}`)}
              >
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg shrink-0">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{doc.filename}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t(`documents.status.${doc.status}`)} · {doc.file_type}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(doc.id)}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          {data?.data?.length === 0 && (
            <div className="card text-center py-8">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">尚無文件</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
