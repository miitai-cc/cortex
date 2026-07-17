import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from 'eiva-fe-security';
import { useResearchStore } from '../stores/researchStore';
import {
  LayoutDashboard,
  FileText,
  Search,
  Settings,
  LogOut,
  Brain,
  MessageSquare,
  Share2,
  FlaskConical,
  PanelRightOpen,
  PanelRightClose,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/chat', icon: MessageSquare, labelKey: 'nav.chat' },
  { to: '/documents', icon: FileText, labelKey: 'nav.documents' },
  { to: '/search', icon: Search, labelKey: 'nav.search' },
  { to: '/graph', icon: Share2, labelKey: 'nav.graph' },
  { to: '/research', icon: FlaskConical, labelKey: 'nav.research' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { togglePanel, panelOpen: researchPanelOpen } = useResearchStore();
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Icon Sidebar */}
      <aside className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0">
        <div className="mb-4 p-2">
          <Brain className="w-7 h-7 text-primary-600" />
        </div>
        <nav className="flex-1 flex flex-col items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={`p-2.5 rounded-lg transition-colors ${
                isActive(item.to)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title={item.labelKey}
            >
              <item.icon className="w-5 h-5" />
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-1">
          <div
            className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-medium cursor-pointer"
            title={user?.username}
          >
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="登出"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Left Panel (toggleable) */}
      <div
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-200 overflow-hidden ${
          leftPanelOpen ? 'w-60' : 'w-0'
        }`}
      >
        <div className={`p-4 border-b border-gray-200 flex items-center justify-between ${leftPanelOpen ? '' : 'hidden'}`}>
          <span className="text-sm font-semibold text-gray-700">導覽</span>
          <button onClick={() => setLeftPanelOpen(false)} className="text-gray-400 hover:text-gray-600">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        <div className={`flex-1 p-3 overflow-auto ${leftPanelOpen ? '' : 'hidden'}`}>
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider">快速操作</p>
            <button
              onClick={() => navigate('/chat')}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              💬 新增對話
            </button>
            <button
              onClick={() => navigate('/research')}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              🔬 深層研究
            </button>
            <button
              onClick={() => navigate('/graph')}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              🕸️ 知識圖譜
            </button>
          </div>
        </div>
      </div>

      {/* Left toggle button */}
      {!leftPanelOpen && (
        <button
          onClick={() => setLeftPanelOpen(true)}
          className="absolute left-14 top-3 z-10 p-1 bg-white border border-gray-200 rounded-r-md text-gray-400 hover:text-gray-600 shadow-sm"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="topToolArea shrink-0 flex items-center gap-3 text-sm text-gray-500">
          {/* topToolArea — 各頁面可透過 Outlet 上方注入工具列 */}
        </div>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Right Panel (Research toggle) */}
      <button
        onClick={togglePanel}
        className={`fixed right-4 bottom-4 z-20 p-2.5 rounded-full shadow-lg transition-colors ${
          researchPanelOpen
            ? 'bg-primary-600 text-white'
            : 'bg-white text-gray-600 border border-gray-200'
        }`}
        title="深層研究"
      >
        {researchPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
      </button>
    </div>
  );
}
