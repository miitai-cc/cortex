import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronLeft,
  Home,
  RefreshCw,
} from 'lucide-react';
import { documentApi } from '../services/api';

const STORAGE_KEY = 'cortex-doc-directory';

function getCurrentDir(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '/';
  } catch {
    return '/';
  }
}

function setCurrentDir(dir: string) {
  try {
    localStorage.setItem(STORAGE_KEY, dir);
  } catch { /* ignore */ }
}

export default function DirectoryBrowser() {
  const navigate = useNavigate();
  const [currentDir, setCurrentDirState] = useState(getCurrentDir);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', currentDir],
    queryFn: () => documentApi.list({ directory: currentDir }),
  });

  useEffect(() => {
    setCurrentDir(currentDir);
  }, [currentDir]);

  const documents = data?.data?.data ?? data?.data ?? [];
  const allDocs = Array.isArray(documents) ? documents : [];

  const dirs = allDocs.filter((d: any) => d.is_directory || d.type === 'directory');
  const files = allDocs.filter((d: any) => !d.is_directory && d.type !== 'directory');

  const pathParts = currentDir === '/' ? [] : currentDir.split('/').filter(Boolean);

  const navigateToDir = (dir: string) => {
    setCurrentDirState(dir);
  };

  const navigateUp = () => {
    if (pathParts.length === 0) return;
    const parent = '/' + pathParts.slice(0, -1).join('/');
    setCurrentDirState(parent === '//' ? '/' : parent);
  };

  const navigateToRoot = () => {
    setCurrentDirState('/');
  };

  const navigateIntoDir = (dirName: string) => {
    const newDir = currentDir === '/' ? `/${dirName}` : `${currentDir}/${dirName}`;
    setCurrentDirState(newDir);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Separator */}
      <div className="mx-3 my-2 border-t border-gray-200" />

      {/* Directory path */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <button
            onClick={navigateToRoot}
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
            title="根目錄"
          >
            <Home className="w-3 h-3" />
          </button>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              <button
                onClick={() => navigateToDir('/' + pathParts.slice(0, i + 1).join('/'))}
                className="hover:text-primary-600 transition-colors truncate max-w-[80px]"
                title={'/' + pathParts.slice(0, i + 1).join('/')}
              >
                {part}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <FolderOpen className="w-3.5 h-3.5 text-primary-500" />
            <span className="truncate" title={currentDir}>
              {currentDir === '/' ? '根目錄' : pathParts[pathParts.length - 1]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {pathParts.length > 0 && (
              <button
                onClick={navigateUp}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="返回上層"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="重新整理"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Directories first */}
            {dirs.map((dir: any) => (
              <button
                key={dir.id || dir.name}
                onClick={() => navigateIntoDir(dir.name || dir.filename)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
              >
                <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{dir.name || dir.filename}</span>
              </button>
            ))}

            {/* Files */}
            {files.map((doc: any) => {
              const ext = doc.file_type?.split('/').pop()?.split('.').pop()?.toLowerCase() ?? 'file';
              const typeColors: Record<string, string> = {
                pdf: 'text-red-500',
                docx: 'text-blue-500',
                xlsx: 'text-green-500',
                txt: 'text-gray-500',
                md: 'text-amber-500',
              };
              return (
                <button
                  key={doc.id}
                  onClick={() => navigate(`/cortex/documents/${doc.id}`)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
                  title={doc.filename}
                >
                  <FileText className={`w-3.5 h-3.5 shrink-0 ${typeColors[ext] || 'text-gray-400'}`} />
                  <span className="truncate">{doc.filename}</span>
                </button>
              );
            })}

            {/* Empty state */}
            {dirs.length === 0 && files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <Folder className="w-6 h-6 mb-1" />
                <p className="text-xs">此目錄為空</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-400">
        {files.length} 個文件 · {dirs.length} 個目錄
      </div>
    </div>
  );
}
