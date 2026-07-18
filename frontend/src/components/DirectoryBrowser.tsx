import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FileText, Folder, FolderOpen, Home, Plus, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { directoryApi, documentApi } from '../services/api';

const STORAGE_KEY = 'cortex-doc-directory';

function selectDirectory(path: string) {
  localStorage.setItem(STORAGE_KEY, path);
  window.dispatchEvent(new CustomEvent('cortex-directory-changed', { detail: path }));
}

export default function DirectoryBrowser() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(() => localStorage.getItem(STORAGE_KEY) || '/');
  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ['document-directories', current], queryFn: () => directoryApi.list(current) });
  const { data: documentData, isLoading: documentsLoading, isFetching: documentsFetching, refetch: refetchDocuments } = useQuery({
    queryKey: ['documents', { directory: current }],
    queryFn: () => documentApi.list({ directory: current }),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['document-directories'] });
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  };
  const create = useMutation({ mutationFn: (name: string) => directoryApi.create(current, name), onSuccess: refresh, onError: (e: any) => toast.error(e.response?.data?.error || '建立目錄失敗') });
  const copy = useMutation({ mutationFn: (path: string) => directoryApi.copy(path), onSuccess: refresh, onError: (e: any) => toast.error(e.response?.data?.error || '複製目錄失敗') });
  const remove = useMutation({ mutationFn: (path: string) => directoryApi.delete(path), onSuccess: refresh, onError: (e: any) => toast.error(e.response?.data?.error || '刪除目錄失敗') });
  const removeFile = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess: () => { refresh(); toast.success('文件已刪除'); },
    onError: (e: any) => toast.error(e.response?.data?.error || '刪除文件失敗'),
  });
  const dirs: Array<{ name: string; path: string }> = data?.data?.directories ?? [];
  const files: Array<{ id: string; filename: string; status: string }> = documentData?.data ?? [];

  const enter = (path: string) => { setCurrent(path); selectDirectory(path); };
  const add = () => { const name = window.prompt('請輸入目錄名'); if (name?.trim()) create.mutate(name.trim()); };
  const parent = current === '/' ? '/' : current.split('/').slice(0, -1).join('/') || '/';

  return <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
    <div className="flex items-center justify-between px-2 mb-2">
      <button onClick={() => enter('/')} className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200" title="設為操作目錄">
        {current === '/' ? <Home className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}<span className="truncate max-w-32">{current === '/' ? '根目錄' : current}</span>
      </button>
      <div className="flex items-center gap-1">
        <button onClick={() => { refetch(); refetchDocuments(); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded" title="重新整理"><RefreshCw className={`w-4 h-4 ${isFetching || documentsFetching ? 'animate-spin' : ''}`} /></button>
        <button onClick={add} className="p-1 text-primary-600 hover:bg-primary-50 rounded" title="新增目錄"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
    {current !== '/' && <button onClick={() => enter(parent)} className="w-full px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">.. 返回上層</button>}
    {isLoading ? <p className="px-2 py-3 text-xs text-gray-400">載入中…</p> : dirs.map((dir) =>
      <div key={dir.path} className="group flex items-center rounded hover:bg-gray-50 dark:hover:bg-gray-700">
        <button onClick={() => enter(dir.path)} className="min-w-0 flex-1 flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300" title={`進入 ${dir.path} 並設為操作目錄`}><Folder className="w-4 h-4 text-amber-500 shrink-0"/><span className="truncate">{dir.name}</span></button>
        <button onClick={() => copy.mutate(dir.path)} className="p-1 text-gray-400 hover:text-primary-600" title="複製目錄"><Copy className="w-3.5 h-3.5" /></button>
        <button onClick={() => window.confirm(`確定刪除目錄「${dir.name}」？\nYes / No`) && remove.mutate(dir.path)} className="p-1 mr-1 text-gray-400 hover:text-red-500" title="刪除目錄"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>)}
    {!documentsLoading && files.map((file) =>
      <div key={file.id} className="group flex items-center rounded hover:bg-gray-50 dark:hover:bg-gray-700">
        <button onClick={() => navigate(`/cortex/documents/${file.id}`)} className="min-w-0 flex-1 flex items-center gap-2 px-2 py-1.5 text-left text-xs text-gray-600 dark:text-gray-300" title={file.filename}>
          <FileText className="w-4 h-4 text-primary-500 shrink-0" />
          <span className="truncate flex-1">{file.filename}</span>
          <span className={`w-2 h-2 rounded-full shrink-0 ${file.status === 'indexed' ? 'bg-emerald-500' : file.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} title={file.status} />
        </button>
        <button
          onClick={() => window.confirm(`確定刪除文件「${file.filename}」？\nYes / No`) && removeFile.mutate(file.id)}
          disabled={removeFile.isPending}
          className="p-1 mr-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
          title="刪除文件"
          aria-label={`刪除 ${file.filename}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>)}
    {!isLoading && !documentsLoading && dirs.length === 0 && files.length === 0 && <p className="px-2 py-3 text-xs text-gray-400">此目錄為空</p>}
    {!isLoading && !documentsLoading && (dirs.length > 0 || files.length > 0) && <p className="px-2 pt-2 text-[11px] text-gray-400">{dirs.length} 個目錄 · {files.length} 個文件</p>}
  </div>;
}
