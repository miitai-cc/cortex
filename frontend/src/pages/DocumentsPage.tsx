import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import {
  Upload, Search as SearchIcon, Trash2, FileText,
  BookOpen, AlignLeft, CheckCircle2, Loader2, Clock,
} from 'lucide-react';
import { useDocuments, useUploadDocument, useDeleteDocument } from '../hooks/useDocuments';
import { Link } from 'react-router-dom';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import type { DocumentIndexEvent } from '../grpc/documentWsClient';

type DisplayEvent = DocumentIndexEvent & { id: number; filename: string };

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function parseMetadata(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function IndexMethodBadge({ method }: { method?: string }) {
  if (!method) return null;
  const isPageindex = method === 'pageindex';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isPageindex
          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
      }`}
    >
      {isPageindex ? <BookOpen className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
      {isPageindex ? 'PageIndex' : 'Chunker'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: any; cls: string; label: string }> = {
    pending:    { icon: Clock,        cls: 'text-amber-500',             label: 'Pending' },
    processing: { icon: Loader2,      cls: 'text-blue-500 animate-spin', label: 'Processing' },
    indexed:    { icon: CheckCircle2, cls: 'text-emerald-500',           label: 'Indexed' },
    failed:     { icon: FileText,     cls: 'text-red-500',               label: 'Failed' },
  };
  const entry = map[status] ?? map['pending'];
  const Icon = entry.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${entry.cls}`}>
      <Icon className={`w-3.5 h-3.5`} />
      {entry.label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [indexEvents, setIndexEvents] = useState<DisplayEvent[]>([]);
  const [directory, setDirectory] = useState(() => localStorage.getItem('cortex-doc-directory') || '/');
  useEffect(() => {
    const update = (event: Event) => setDirectory((event as CustomEvent<string>).detail || '/');
    window.addEventListener('cortex-directory-changed', update);
    return () => window.removeEventListener('cortex-directory-changed', update);
  }, []);
  const { data, isLoading } = useDocuments({ search, directory });
  const uploadMutation = useUploadDocument((file, event) => {
    setIndexEvents((current) => [
      ...current,
      { ...event, id: Date.now() + Math.random(), filename: file.name },
    ]);
  }, directory);
  const deleteMutation = useDeleteDocument();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files.forEach((f) => uploadMutation.mutate(f)),
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
  });

  const docs: any[] = data?.data ?? [];

  return (
    <div>
      <CommonHeroTitle icon={FileText} title={t('documents.title')} />
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">操作目錄：<span className="font-medium text-primary-600">{directory}</span></p>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`mb-6 p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
        <p className="text-gray-600 dark:text-gray-300">
          {isDragActive ? t('documents.dropzone.active') : t('documents.upload')}
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">PDF, DOCX, XLSX, PPTX, TXT, MD</p>
        <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">
          PDF / Office → Markdown → PageIndex → Chunker
        </p>
      </div>

      {indexEvents.length > 0 && (
        <section className="card mb-6" aria-live="polite">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">後端索引過程</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">gRPC-over-WebSocket 即時事件</p>
            </div>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              onClick={() => setIndexEvents([])}
            >
              清除
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {indexEvents.map((event) => (
              <div
                key={event.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  event.type === 'ERROR'
                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                    : event.type === 'COMPLETE'
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium truncate">{event.filename}</span>
                  <span className="text-xs tabular-nums">{event.progress}%</span>
                </div>
                <div className="h-1.5 my-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full transition-all ${event.type === 'ERROR' ? 'bg-red-500' : 'bg-primary-500'}`}
                    style={{ width: `${Math.max(0, Math.min(100, event.progress))}%` }}
                  />
                </div>
                <p className="text-gray-600 dark:text-gray-300">[{event.stage}] {event.message}</p>
                {event.documentId && (
                  <p className="mt-1 text-xs text-gray-400 break-all">doc_id={event.documentId}</p>
                )}
                {event.result && (
                  <pre className="mt-2 overflow-x-auto text-xs text-gray-500 dark:text-gray-400">
                    {JSON.stringify(event.result, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search */}
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

      {/* List */}
      {isLoading ? (
        <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      ) : (
        <div className="grid gap-3">
          {docs.map((doc: any) => {
            const meta = parseMetadata(doc.metadata);
            return (
              <div key={doc.id} className="card flex items-center justify-between gap-4">
                <Link to={`/cortex/documents/${doc.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{doc.filename}</p>
                    <IndexMethodBadge method={meta.index_method} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                    <StatusBadge status={doc.status} />
                    <span>·</span>
                    <span>{doc.content_type || doc.file_type}</span>
                    {meta.page_count != null && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {meta.page_count} 頁
                        </span>
                      </>
                    )}
                    {meta.chunk_count != null && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <AlignLeft className="w-3 h-3" />
                          {meta.chunk_count} chunks
                        </span>
                      </>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="shrink-0 p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            );
          })}
          {docs.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 text-center py-8">尚無文件</p>
          )}
        </div>
      )}
    </div>
  );
}
