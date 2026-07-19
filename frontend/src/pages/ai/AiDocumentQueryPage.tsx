import { FormEvent, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { Calculator, ChevronDown, ChevronRight, FileSearch, FileText, Folder, Loader2, Search, Sparkles, X } from 'lucide-react';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { documentApi, searchApi } from '../../services/api';

type SearchChunk = { id?: string; document_id?: string; filename?: string; directory?: string; content_type?: string; chunk_index?: number; content?: string; score?: number };
type QueryResult = { query: string; answer?: string | null; chunks?: SearchChunk[] };
type Preview = { id: string; filename: string; contentType: string; previewType: string; content: string; chunkCount: number };
type HitDocument = { id: string; filename: string; directory: string; contentType: string; score: number };

const examples = [
  'aiQuery.examples',
  'aiQuery.example2',
  'aiQuery.example3',
];

export default function AiDocumentQueryPage() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const documents = useMemo(() => {
    const map = new Map<string, HitDocument>();
    for (const chunk of result?.chunks ?? []) {
      if (!chunk.document_id) continue;
      const current = map.get(chunk.document_id);
      map.set(chunk.document_id, {
        id: chunk.document_id,
        filename: chunk.filename || chunk.document_id,
        directory: chunk.directory || '/',
        contentType: chunk.content_type || 'application/octet-stream',
        score: Math.max(current?.score ?? 0, chunk.score ?? 0),
      });
    }
    return [...map.values()];
  }, [result]);

  const tree = useMemo(() => {
    const groups = new Map<string, HitDocument[]>();
    for (const document of documents) groups.set(document.directory, [...(groups.get(document.directory) ?? []), document]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [documents]);

  const runQuery = async (event?: FormEvent, documentIds?: string[]) => {
    event?.preventDefault();
    const query = prompt.trim();
    if (!query || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await searchApi.query({ query, top_k: 12, use_hybrid: true, document_ids: documentIds });
      const nextResult = response.data as QueryResult;
      setResult(nextResult);
      if (!documentIds) {
        setSelected(new Set((nextResult.chunks ?? []).map((chunk) => chunk.document_id).filter((id): id is string => Boolean(id))));
      }
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || t('aiQuery.queryFailed'));
    } finally { setLoading(false); }
  };

  const openPreview = async (document: HitDocument) => {
    setPreviewLoading(true);
    setError('');
    try { setPreview((await documentApi.preview(document.id)).data); }
    catch (requestError: any) { setError(requestError.response?.data?.error || t('aiQuery.previewFailed')); }
    finally { setPreviewLoading(false); }
  };

  const toggleDocument = (id: string) => setSelected((current) => {
    const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return <div className="max-w-11xl mx-auto px-4 pb-10">
    <CommonHeroTitle icon={FileSearch} title={t('aiQuery.title')} description={t('aiQuery.description')} />
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="card lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('aiQuery.searchDocuments')}</h2><span className="text-xs text-gray-500">{selected.size}/{documents.length}</span></div>
        {!documents.length ? <p className="py-8 text-center text-sm text-gray-400">{t('aiQuery.noDocuments')}</p> : <div className="space-y-2">{tree.map(([directory, files]) => {
          const closed = collapsed.has(directory);
          return <div key={directory}>
            <button onClick={() => setCollapsed((current) => { const next = new Set(current); next.has(directory) ? next.delete(directory) : next.add(directory); return next; })} className="flex w-full items-center gap-1.5 rounded px-1 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800">
              {closed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}<Folder className="h-4 w-4 text-amber-500" /><span className="truncate">{directory === '/' ? t('aiQuery.rootDirectory') : directory}</span>
            </button>
            {!closed && <div className="ml-3 border-l border-gray-200 pl-2 dark:border-gray-700">{files.map((file) => <div key={file.id} className="flex items-center gap-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <input type="checkbox" checked={selected.has(file.id)} onChange={() => toggleDocument(file.id)} className="rounded border-gray-300 text-primary-600" aria-label={t('aiQuery.selectDocument', { filename: file.filename })} />
              <button onClick={() => openPreview(file)} className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1.5 text-left text-xs text-gray-600 dark:text-gray-300" title={t('aiQuery.previewDocument')}><FileText className="h-3.5 w-3.5 shrink-0 text-primary-500" /><span className="truncate">{file.filename}</span></button>
            </div>)}</div>}
          </div>;
        })}</div>}
        <button onClick={() => runQuery(undefined, [...selected])} disabled={!selected.size || !prompt.trim() || loading} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-50"><Calculator className="h-4 w-4" />{t('aiQuery.integrateSelected', { count: selected.size })}</button>
      </aside>

      <main className="min-w-0">
        <form onSubmit={runQuery} className="card mb-6 border border-primary-100 dark:border-primary-900/50">
          <label htmlFor="ai-document-prompt" className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100"><Sparkles className="h-5 w-5 text-primary-600" />{t('aiQuery.inputLabel')}</label>
          <textarea id="ai-document-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.ctrlKey || event.metaKey) && runQuery()} rows={5} className="input-field resize-y leading-6" placeholder={t('aiQuery.inputPlaceholder')} />
          <div className="mt-3 flex flex-wrap gap-2">{examples.map((example) => <button key={example} type="button" onClick={() => setPrompt(t(example))} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-primary-400 hover:text-primary-600 dark:border-gray-700 dark:text-gray-300">{t(example)}</button>)}</div>
          <div className="mt-4 flex justify-end"><button type="submit" disabled={!prompt.trim() || loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}{loading ? t('aiQuery.searching') : t('aiQuery.searchAll')}</button></div>
        </form>
        {error && <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        {result && <div className="space-y-6" aria-live="polite">
          <section className="card"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary-600" />{t('aiQuery.resultTitle')}</h2>{result.answer ? <div className="prose max-w-none dark:prose-invert"><ReactMarkdown>{result.answer}</ReactMarkdown></div> : <p className="text-gray-500">{t('aiQuery.noAnswer')}</p>}</section>
          <section className="card"><div className="mb-4 flex justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-primary-600" />{t('aiQuery.relevantChunks')}</h2><span className="text-sm text-gray-500">{t('aiQuery.chunkCount', { count: result.chunks?.length ?? 0 })}</span></div><div className="space-y-3">{(result.chunks ?? []).map((chunk, index) => <article key={chunk.id || index} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div className="mb-2 flex gap-2 text-xs text-gray-500"><span className="rounded-full bg-primary-50 px-2 py-1 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{Math.round((chunk.score ?? 0) * 100)}%</span><span className="truncate">{chunk.filename} · 段落 #{(chunk.chunk_index ?? index) + 1}</span></div><p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">{chunk.content}</p></article>)}</div></section>
        </div>}
      </main>
    </div>

    {(preview || previewLoading) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setPreview(null)}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700"><div><h2 className="font-semibold text-gray-900 dark:text-gray-100">{preview?.filename || t('aiQuery.loadingPreview')}</h2>{preview && <p className="text-xs text-gray-500">{preview.contentType} · {preview.chunkCount}{t('aiQuery.chunkCount', { count: preview.chunkCount })}</p>}</div><button onClick={() => setPreview(null)} className="rounded p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('aiQuery.closePreview')}><X className="h-5 w-5" /></button></div>
        <div className="overflow-auto p-6">{previewLoading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary-600" /></div> : preview?.content ? <div className="prose max-w-none dark:prose-invert"><ReactMarkdown>{preview.content}</ReactMarkdown></div> : <p className="py-16 text-center text-gray-500">{t('aiQuery.noPreviewContent')}</p>}</div>
      </div>
    </div>}
  </div>;
}
