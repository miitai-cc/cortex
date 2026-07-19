import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Folder, FileText, Upload, Download, Search, ChevronRight, FileDown, ShieldCheck, ClipboardList, FolderKanban } from 'lucide-react';
import CommonHeroTitle from '../common/CommonHeroTitle';

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: string;
  updatedAt: string;
  children?: FileNode[];
}

export default function DepartmentFileManager() {
  const location = useLocation();
  const path = location.pathname;
  
  let title = '部門共用檔案';
  let description = '以使用者部門為限制，上傳與下載該部門的溝通用文件，支援多階層分類。';
  let Icon = FolderKanban;
  
  if (path.includes('/forms')) {
    title = '表單下載';
    description = '以使用者部門為限制，上傳與下載該部門的 Word, Excel 等表單，支援多階層分類。';
    Icon = ClipboardList;
  } else if (path.includes('/iso')) {
    title = 'ISO 文件';
    description = '以使用者部門為限制，上傳與下載該部門的 ISO 標準文件，支援多階層分類。';
    Icon = ShieldCheck;
  }

  const [currentPath, setCurrentPath] = useState<FileNode[]>([{ id: 'root', name: '根目錄', type: 'folder', updatedAt: '' }]);
  const [search, setSearch] = useState('');

  // Mock data structure
  const mockFiles: FileNode[] = [
    { id: '1', name: 'HR部門', type: 'folder', updatedAt: '2026-07-19' },
    { id: '2', name: 'IT部門', type: 'folder', updatedAt: '2026-07-18' },
    { id: '3', name: '業務部', type: 'folder', updatedAt: '2026-07-17' },
    { id: '4', name: '2026年度計畫.pdf', type: 'file', size: '2.4 MB', updatedAt: '2026-07-15' },
    { id: '5', name: '請假單.docx', type: 'file', size: '1.1 MB', updatedAt: '2026-07-10' },
  ];

  return (
    <div className="max-w-11xl mx-auto px-4 pb-10">
      <CommonHeroTitle icon={Icon} title={title} description={description} />
      
      <div className="card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            {currentPath.map((node, index) => (
              <div key={node.id} className="flex items-center">
                {index > 0 && <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />}
                <button 
                  className={`hover:text-primary-600 ${index === currentPath.length - 1 ? 'font-semibold text-gray-900 dark:text-gray-100' : ''}`}
                >
                  {node.name}
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋文件..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              <Upload className="w-4 h-4" />
              <span>上傳檔案</span>
            </button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">名稱</th>
                <th className="px-4 py-3 font-medium w-32">大小</th>
                <th className="px-4 py-3 font-medium w-40">更新日期</th>
                <th className="px-4 py-3 font-medium w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {mockFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group cursor-pointer">
                  <td className="px-4 py-3 flex items-center gap-3">
                    {file.type === 'folder' ? (
                      <Folder className="w-5 h-5 text-blue-500" fill="currentColor" fillOpacity={0.2} />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600">
                      {file.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{file.size || '--'}</td>
                  <td className="px-4 py-3 text-gray-500">{file.updatedAt}</td>
                  <td className="px-4 py-3">
                    {file.type === 'file' && (
                      <button className="text-gray-400 hover:text-primary-600 p-1 rounded transition-colors">
                        <FileDown className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {mockFiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    此資料夾為空
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
