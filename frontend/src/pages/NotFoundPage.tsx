import { FileQuestion, House } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_AUTHENTICATED_PATH } from '../utils/authNavigation';

export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = `${location.pathname}${location.search}`;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="card max-w-xl text-center">
        <FileQuestion className="mx-auto mb-4 h-12 w-12 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">找不到此功能</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          目前沒有與此 Hash URL 對應的頁面，系統已保留網址，並未將您導向登入頁。
        </p>
        <code className="mt-4 block break-all rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          #{currentPath}
        </code>
        <button
          type="button"
          onClick={() => navigate(DEFAULT_AUTHENTICATED_PATH)}
          className="btn btn-primary mx-auto mt-6 flex items-center gap-2"
        >
          <House className="h-4 w-4" />
          回到 AI 文件查詢
        </button>
      </div>
    </div>
  );
}
