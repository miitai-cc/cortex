import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Clock3, Database, ExternalLink, FileCode2, FileSpreadsheet, FileText, Globe, History, Library, Loader2, Plus, Presentation, Save, Upload, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import { contentApi, documentApi, type ContentSaveRequest } from '../services/api';

type ContentItem = { id: string; title: string; contentKind: string; directory: string; sourceUrl?: string; currentVersion: number; documentId?: string; status?: string; updatedAt?: string };
type Version = { id: string; version: number; documentId: string; sourceKind: string; sourceUrl?: string; content?: string; changeNote?: string; ragEnabled: boolean; pageindexEnabled: boolean; status?: string; createdAt?: string };
const emptyForm: ContentSaveRequest = { title: '', content_kind: 'markdown', directory: '/', content: '', source_url: '', sql_query: '', change_note: '', rag_enabled: true, pageindex_enabled: true };

export default function ContentManagementPage() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<ContentItem | null | undefined>(undefined);
  const [form, setForm] = useState<ContentSaveRequest>(emptyForm);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [binaryTarget, setBinaryTarget] = useState<ContentItem | null | undefined>(undefined);
  const [binaryFile, setBinaryFile] = useState<File | null>(null);
  const [binaryLoading, setBinaryLoading] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['content-items'], queryFn: contentApi.list, refetchInterval: 3000 });
  const { data: historyData } = useQuery({ queryKey: ['content-versions', historyId], queryFn: () => contentApi.versions(historyId!), enabled: Boolean(historyId) });
  const items: ContentItem[] = data?.data ?? [];
  const versions: Version[] = historyData?.data ?? [];
  const save = useMutation({
    mutationFn: () => editing ? contentApi.update(editing.id, form) : contentApi.create(form),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['content-items'] }); setEditing(undefined); toast.success('內容版本已儲存並送交索引'); },
    onError: (error: any) => toast.error(error.response?.data?.error || '內容儲存失敗'),
  });
  const uploadBinaryVersion = async () => {
    if (!binaryFile) return;
    setBinaryLoading(true);
    const directory = binaryTarget?.directory || localStorage.getItem('cortex-doc-directory') || '/';
    try {
      const complete = await documentApi.upload(binaryFile, () => {}, directory);
      if (!complete.documentId) throw new Error('索引完成事件缺少 documentId');
      await contentApi.importVersion({ content_id: binaryTarget?.id, document_id: complete.documentId, title: binaryTarget?.title || binaryFile.name, directory, change_note: binaryTarget ? `上傳 ${binaryFile.name} 作為新版本` : '初始上傳版本' });
      await client.invalidateQueries({ queryKey: ['content-items'] });
      setBinaryTarget(undefined); setBinaryFile(null); toast.success('檔案版本已完成索引並保存');
    } catch (error: any) { toast.error(error.response?.data?.error || error.message || '檔案版本上傳失敗'); }
    finally { setBinaryLoading(false); }
  };

  useEffect(() => {
    if (editing === null) setForm({ ...emptyForm, directory: localStorage.getItem('cortex-doc-directory') || '/' });
    if (editing) contentApi.versions(editing.id).then((response) => {
      const latest = response.data?.[0];
      const kind = editing.contentKind === 'web' ? 'web' : editing.contentKind === 'database' ? 'database' : 'markdown';
      setForm({ title: editing.title, content_kind: kind, directory: editing.directory, content: latest?.content || '', source_url: kind === 'web' ? editing.sourceUrl || '' : '', sql_query: kind === 'database' ? editing.sourceUrl || '' : '', change_note: '', rag_enabled: true, pageindex_enabled: true });
    });
  }, [editing]);

  return <div className="max-w-7xl mx-auto px-4 pb-10">
    <CommonHeroTitle icon={Library} title="內容管理" description="維護工作目錄中的內容、不可變版本，以及每個版本的 RAG／PageIndex 索引" />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {[['Markdown', FileCode2], ['網頁', Globe], ['資料庫 SQL', Database], ['PDF / DOCX', FileText], ['Excel', FileSpreadsheet], ['PPTX', Presentation]].map(([label, Icon]: any) => <span key={label} className="flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 dark:border-gray-700"><Icon className="h-3.5 w-3.5"/>{label}</span>)}
      </div>
      <div className="flex gap-2"><button onClick={() => setBinaryTarget(null)} className="btn-secondary flex items-center gap-2"><Upload className="h-4 w-4"/>上傳 PDF／Office</button><button onClick={() => setEditing(null)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4"/>新增內容</button></div>
    </div>
    {isLoading ? <p className="text-gray-500">載入中…</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="card flex flex-col">
      <div className="mb-3 flex items-start gap-3">{item.contentKind === 'web' ? <Globe className="h-6 w-6 text-sky-500"/> : item.contentKind === 'database' ? <Database className="h-6 w-6 text-emerald-600"/> : <FileCode2 className="h-6 w-6 text-primary-600"/>}<div className="min-w-0 flex-1"><h2 className="truncate font-semibold text-gray-900 dark:text-gray-100">{item.title}</h2><p className="truncate text-xs text-gray-500">{item.directory} · v{item.currentVersion}</p></div><span className={`rounded-full px-2 py-1 text-[11px] ${item.status === 'indexed' ? 'bg-emerald-50 text-emerald-700' : item.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{item.status || 'pending'}</span></div>
      {item.contentKind === 'web' && item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mb-3 flex items-center gap-1 truncate text-xs text-sky-600"><ExternalLink className="h-3 w-3"/>{item.sourceUrl}</a>}
      {item.contentKind === 'database' && item.sourceUrl && <code className="mb-3 truncate rounded bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{item.sourceUrl}</code>}
      <div className="mt-auto flex gap-2">{['markdown', 'web', 'database'].includes(item.contentKind) ? <button onClick={() => setEditing(item)} className="btn-secondary flex-1">編輯並建立新版本</button> : <button onClick={() => setBinaryTarget(item)} className="btn-secondary flex-1">上傳新檔案版本</button>}<button onClick={() => setHistoryId(item.id)} className="rounded-lg border border-gray-200 p-2 text-gray-500 dark:border-gray-700" title="版本歷史"><History className="h-4 w-4"/></button></div>
    </article>)}{!items.length && <div className="card col-span-full py-14 text-center text-gray-500"><Library className="mx-auto mb-3 h-10 w-10 text-gray-300"/><p>尚無受版本管理的內容</p></div>}</div>}

    {editing !== undefined && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900"><header className="flex items-center justify-between border-b px-5 py-4 dark:border-gray-700"><div><h2 className="font-semibold">{editing ? `編輯 ${editing.title}` : '新增內容'}</h2><p className="text-xs text-gray-500">儲存時建立不可變新版本，舊版本不會被覆蓋</p></div><button onClick={() => setEditing(undefined)}><X className="h-5 w-5"/></button></header>
      <div className="grid flex-1 gap-5 overflow-auto p-5 lg:grid-cols-2"><div className="space-y-3"><input className="input-field" placeholder="內容標題" value={form.title} onChange={(event) => setForm({...form, title: event.target.value})}/><div className="grid grid-cols-2 gap-3"><select className="input-field" value={form.content_kind} onChange={(event) => setForm({...form, content_kind: event.target.value as 'markdown'|'web'|'database'})}><option value="markdown">Markdown</option><option value="web">公開網頁</option><option value="database">資料庫 SQL</option></select><input className="input-field" placeholder="工作目錄，例如 /規格" value={form.directory} onChange={(event) => setForm({...form, directory: event.target.value})}/></div>{form.content_kind === 'web' ? <input className="input-field" placeholder="https://example.com/page" value={form.source_url} onChange={(event) => setForm({...form, source_url: event.target.value})}/> : form.content_kind === 'database' ? <textarea className="input-field min-h-80 font-mono text-sm" placeholder="SELECT column FROM table WHERE ..." value={form.sql_query} onChange={(event) => setForm({...form, sql_query: event.target.value})}/> : <textarea className="input-field min-h-80 font-mono text-sm" placeholder="# Markdown 內容" value={form.content} onChange={(event) => setForm({...form, content: event.target.value})}/>}<input className="input-field" placeholder="版本變更說明" value={form.change_note} onChange={(event) => setForm({...form, change_note: event.target.value})}/><div className="flex gap-5 text-sm"><label className="flex gap-2"><input type="checkbox" checked={form.rag_enabled} onChange={(event) => setForm({...form, rag_enabled: event.target.checked})}/>RAG</label><label className="flex gap-2"><input type="checkbox" checked={form.pageindex_enabled} onChange={(event) => setForm({...form, pageindex_enabled: event.target.checked})}/>PageIndex</label></div></div><div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4"/>預覽</h3>{form.content_kind === 'markdown' ? <div className="prose max-w-none dark:prose-invert"><ReactMarkdown>{form.content || '*尚無內容*'}</ReactMarkdown></div> : <p className="text-sm text-gray-500">{form.content_kind === 'database' ? '儲存後執行唯讀 SQL，將欄位與最多 1,000 列結果轉為 Markdown 表格，再建立版本與索引。' : '儲存後由後端擷取公開網頁，轉為 Markdown 並建立版本與索引。'}</p>}</div></div>
      <footer className="flex justify-end gap-2 border-t px-5 py-4 dark:border-gray-700"><button onClick={() => setEditing(undefined)} className="btn-secondary">取消</button><button onClick={() => save.mutate()} disabled={!form.title.trim() || save.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}儲存新版本</button></footer></div></div>}

    {historyId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900"><div className="mb-4 flex justify-between"><h2 className="flex items-center gap-2 font-semibold"><History className="h-5 w-5"/>版本歷史</h2><button onClick={() => setHistoryId(null)}><X className="h-5 w-5"/></button></div><div className="space-y-3">{versions.map((version) => <div key={version.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div className="flex items-center gap-2"><strong>v{version.version}</strong><span className="text-xs text-gray-500">{version.sourceKind}</span><span className="ml-auto text-xs">{version.status}</span></div><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{version.changeNote || '未填寫變更說明'}</p><div className="mt-2 flex gap-3 text-xs text-gray-500"><span className="flex gap-1"><Clock3 className="h-3.5 w-3.5"/>{version.createdAt}</span><span>RAG {version.ragEnabled ? '✓' : '—'}</span><span>PageIndex {version.pageindexEnabled ? '✓' : '—'}</span></div></div>)}</div></div></div>}
    {binaryTarget !== undefined && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900"><div className="mb-4 flex justify-between"><div><h2 className="font-semibold">{binaryTarget ? `上傳「${binaryTarget.title}」的新版本` : '新增 PDF／Office 內容'}</h2><p className="text-xs text-gray-500">將轉為 Markdown，執行 PageIndex 與 RAG 後保存版本</p></div><button onClick={() => setBinaryTarget(undefined)}><X className="h-5 w-5"/></button></div><input type="file" accept=".pdf,.docx,.xlsx,.pptx" onChange={(event) => setBinaryFile(event.target.files?.[0] || null)} className="block w-full rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"/><div className="mt-5 flex justify-end gap-2"><button onClick={() => setBinaryTarget(undefined)} className="btn-secondary">取消</button><button onClick={uploadBinaryVersion} disabled={!binaryFile || binaryLoading} className="btn-primary flex items-center gap-2 disabled:opacity-50">{binaryLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>}{binaryLoading ? '轉換與索引中…' : '上傳並建立版本'}</button></div></div></div>}
  </div>;
}
