import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocument } from '../../hooks/useDocuments';
import { ArrowLeft, FileText, BookOpen, AlignLeft, Hash } from 'lucide-react';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';

function parseMetadata(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useDocument(id!);

  if (isLoading) return <p>{t('common.loading')}</p>;

  const doc = data?.data;
  const meta = parseMetadata(doc?.metadata);
  const isPageindex = meta.index_method === 'pageindex';

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
        <div className="space-y-4">
          <CommonHeroTitle
            icon={FileText}
            title={doc.filename}
            description={`${t(`documents.status.${doc.status}`)} · ${doc.content_type || doc.file_type}`}
          />

          {/* Index metadata card */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              索引資訊
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">索引方式</span>
                <span className={`text-sm font-semibold flex items-center gap-1 ${
                  isPageindex
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {isPageindex
                    ? <><BookOpen className="w-3.5 h-3.5" /> PageIndex</>
                    : <><AlignLeft className="w-3.5 h-3.5" /> Chunker</>}
                </span>
              </div>
              {meta.page_count != null && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">頁數</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-violet-500" />
                    {meta.page_count} 頁
                  </span>
                </div>
              )}
              {meta.chunk_count != null && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Chunks</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-blue-500" />
                    {meta.chunk_count} chunks
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">狀態</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t(`documents.status.${doc.status}`)}
                </span>
              </div>
            </div>

            {isPageindex && (
              <p className="mt-3 text-xs text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 rounded-lg px-3 py-2">
                此文件使用 <strong>pageindex-core</strong> 進行逐頁索引（page-by-page），
                每頁作為一個獨立的 embedding chunk，並記錄頁碼 metadata。
              </p>
            )}
          </div>

          {/* File info card */}
          <div className="card">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{doc.filename}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t(`documents.status.${doc.status}`)} · {doc.content_type || doc.file_type}
                </p>
              </div>
            </div>
            {doc.content && (
              <div className="border-t pt-4 mt-4">
                <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{doc.content}</pre>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">{t('common.error')}</p>
      )}
    </div>
  );
}
