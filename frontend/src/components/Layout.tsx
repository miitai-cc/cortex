import { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from 'eiva-fe-security';
import { useResearchStore } from '../stores/researchStore';
import { useThemeStore } from '../stores/themeStore';
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
  Globe,
  BarChart3,
  Activity,
  Heart,
  Plus,
  Clock,
  Upload,
  List,
  Layers,
  Network,
  Users,
  AlertTriangle,
  Sliders,
  Sun,
  Moon,
  Cpu,
  ArrowUpDown,
  FolderSearch,
  Sparkles,
  Library,
  Award,
  Bookmark,
  CircleHelp,
  ClipboardCheck,
  UserRoundSearch,
  FolderCog,
  MessagesSquare,
  Hash,
  ClipboardList,
  UserCheck,
  Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import DirectoryBrowser from './DirectoryBrowser';
import BottomToolArea from './BottomToolArea';
import TopQuickActions from './TopQuickActions';
import SystemJobsTabs, { type SystemJobDefinition } from './SystemJobsTabs';
import { DEFAULT_AUTHENTICATED_PATH } from '../utils/authNavigation';
import { departmentConfigs } from '../config/departments';

interface SubMenuItem {
  labelKey: string;
  icon: LucideIcon;
  to: string;
}

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  children: SubMenuItem[];
}

const navItems: NavItem[] = [
  {
    to: '/cortex',
    icon: LayoutDashboard,
    labelKey: 'nav.workspace',
    children: [
      { labelKey: 'nav.workspace.aiDocumentQuery', icon: Sparkles, to: DEFAULT_AUTHENTICATED_PATH },
      { labelKey: 'nav.dashboard.overview', icon: BarChart3, to: '/cortex/dashboard' },
      { labelKey: 'nav.dashboard.health', icon: Heart, to: '/cortex/dashboard/health' },
      { labelKey: 'nav.dashboard.activity', icon: Activity, to: '/cortex/dashboard/activity' },
    ],
  },
  {
    to: '/cortex/departments',
    icon: Building2,
    labelKey: 'nav.departments',
    children: departmentConfigs.map((department) => ({
      labelKey: department.navKey,
      icon: department.icon,
      to: `/cortex/departments/${department.slug}`,
    })),
  },
  {
    to: '/cortex/workspace',
    icon: UserRoundSearch,
    labelKey: 'nav.personalWorkspace',
    children: [
      { labelKey: 'nav.personalWorkspace.following', icon: Bookmark, to: '/cortex/workspace/following' },
      { labelKey: 'nav.personalWorkspace.review', icon: ClipboardCheck, to: '/cortex/workspace/review' },
      { labelKey: 'nav.personalWorkspace.points', icon: Award, to: '/cortex/workspace/points' },
    ],
  },
  {
    to: '/cortex/chat',
    icon: MessageSquare,
    labelKey: 'nav.chat',
    children: [
      { labelKey: 'nav.chat.new', icon: Plus, to: '/cortex/chat' },
      { labelKey: 'nav.chat.history', icon: Clock, to: '/cortex/chat/history' },
    ],
  },
  {
    to: '/cortex/collaboration',
    icon: MessagesSquare,
    labelKey: 'nav.collaboration',
    children: [
      { labelKey: 'nav.collaboration.channels', icon: Hash, to: '/cortex/collaboration/channels' },
      { labelKey: 'nav.collaboration.issues', icon: ClipboardList, to: '/cortex/collaboration/issues' },
      { labelKey: 'nav.collaboration.myIssues', icon: UserCheck, to: '/cortex/collaboration/my-issues' },
    ],
  },
  {
    to: '/cortex/documents',
    icon: FileText,
    labelKey: 'nav.documents',
    children: [
      { labelKey: 'nav.documents.upload', icon: Upload, to: '/cortex/documents' },
      { labelKey: 'nav.documents.content', icon: Library, to: '/cortex/documents/content' },
      { labelKey: 'nav.documents.list', icon: List, to: '/cortex/documents/list' },
      { labelKey: 'nav.documents.recent', icon: Clock, to: '/cortex/documents/recent' },
      { labelKey: 'nav.documents.indexing', icon: FolderSearch, to: '/cortex/documents/indexing' },
    ],
  },
  {
    to: '/cortex/search',
    icon: Search,
    labelKey: 'nav.search',
    children: [
      { labelKey: 'nav.search.fulltext', icon: Search, to: '/cortex/search' },
      { labelKey: 'nav.search.hybrid', icon: Layers, to: '/cortex/search/hybrid' },
    ],
  },
  {
    to: '/cortex/knowledge',
    icon: Library,
    labelKey: 'nav.knowledgeCenter',
    children: [
      { labelKey: 'nav.knowledgeCenter.documents', icon: FileText, to: '/cortex/knowledge/documents' },
      { labelKey: 'nav.knowledgeCenter.categories', icon: FolderCog, to: '/cortex/knowledge-categories' },
      { labelKey: 'nav.knowledgeCenter.review', icon: ClipboardCheck, to: '/cortex/knowledge/review' },
      { labelKey: 'nav.knowledgeCenter.faq', icon: CircleHelp, to: '/cortex/knowledge/faq' },
      { labelKey: 'nav.knowledgeCenter.experts', icon: UserRoundSearch, to: '/cortex/knowledge/experts' },
      { labelKey: 'nav.knowledgeCenter.community', icon: Users, to: '/cortex/knowledge/community' },
    ],
  },
  {
    to: '/cortex/graph',
    icon: Share2,
    labelKey: 'nav.graph',
    children: [
      { labelKey: 'nav.graph.overview', icon: Network, to: '/cortex/graph' },
      { labelKey: 'nav.graph.community', icon: Users, to: '/cortex/graph/community' },
      { labelKey: 'nav.graph.isolated', icon: AlertTriangle, to: '/cortex/graph/isolated' },
    ],
  },
  {
    to: '/cortex/research',
    icon: FlaskConical,
    labelKey: 'nav.research',
    children: [
      { labelKey: 'nav.research.new', icon: Plus, to: '/cortex/research' },
      { labelKey: 'nav.research.history', icon: Clock, to: '/cortex/research/history' },
    ],
  },
  {
    to: '/cortex/ai-models',
    icon: Cpu,
    labelKey: 'nav.aiModels',
    children: [
      { labelKey: 'nav.aiModels.embedding', icon: Layers, to: '/cortex/ai-models/embedding' },
      { labelKey: 'nav.aiModels.reranking', icon: ArrowUpDown, to: '/cortex/ai-models/reranking' },
    ],
  },
  {
    to: '/cortex/settings',
    icon: Settings,
    labelKey: 'nav.settings',
    children: [
      { labelKey: 'nav.settings.language', icon: Globe, to: '/cortex/settings' },
      { labelKey: 'nav.settings.system', icon: Sliders, to: '/cortex/settings/system' },
    ],
  },
];

const systemJobs: SystemJobDefinition[] = navItems.flatMap((item) => item.children.map((child) => ({
  path: child.to,
  labelKey: child.labelKey,
  icon: child.icon,
})));

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { togglePanel, panelOpen: researchPanelOpen } = useResearchStore();
  const { theme, toggleTheme } = useThemeStore();
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/cortex/login');
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh-TW' ? 'en' : 'zh-TW');
  };

  const matchesCurrentRoute = (item: NavItem) => {
    if (item.to === '/cortex') {
      return location.pathname === DEFAULT_AUTHENTICATED_PATH
        || location.pathname.startsWith('/cortex/dashboard');
    }
    return location.pathname === item.to
      || location.pathname.startsWith(`${item.to}/`)
      || item.children.some((child) => location.pathname === child.to);
  };

  const activeNavItem = navItems.find(matchesCurrentRoute);

  const handleNavClick = (item: NavItem) => {
    if (activeNavItem?.to === item.to && leftPanelOpen) {
      setLeftPanelOpen(false);
    } else {
      setLeftPanelOpen(true);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Icon Sidebar */}
      <aside className="w-14 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-3 gap-1 shrink-0">
        <div className="mb-4 p-2">
          <Brain className="w-7 h-7 text-primary-600" />
        </div>
        <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.children[0].to}
              onClick={() => handleNavClick(item)}
              className={`p-2.5 rounded-lg transition-colors ${
                activeNavItem?.to === item.to
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={t(item.labelKey)}
            >
              <item.icon className="w-5 h-5" />
            </Link>
          ))}
        </nav>
      </aside>

      {/* Left Panel (submenu) */}
      <div
        className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200 overflow-hidden ${
          leftPanelOpen && activeNavItem ? 'w-60' : 'w-0'
        }`}
      >
        {activeNavItem && (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <activeNavItem.icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t(activeNavItem.labelKey)}</span>
              </div>
              <button onClick={() => setLeftPanelOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-3 overflow-auto">
              <div className="space-y-1">
                {activeNavItem.children.map((subItem) => {
                  const isSubActive = location.pathname === subItem.to;
                  return (
                    <Link
                      key={subItem.to}
                      to={subItem.to}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                        isSubActive
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <subItem.icon className="w-4 h-4 shrink-0" />
                      <span>{t(subItem.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
              {activeNavItem.to === '/cortex/documents' && <DirectoryBrowser />}
            </div>
          </>
        )}
      </div>

      {/* Left toggle button */}
      {!leftPanelOpen && (
        <button
          onClick={() => setLeftPanelOpen(true)}
          className="absolute left-14 top-3 z-10 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-r-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shadow-sm"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="topToolArea shrink-0 flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === 'light' ? '切換為深色模式' : '切換為淺色模式'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <TopQuickActions />
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={i18n.language === 'zh-TW' ? 'Switch to English' : '切換為繁體中文'}
            >
              <Globe className="w-4 h-4" />
              <span className="text-xs font-medium">{i18n.language === 'zh-TW' ? 'EN' : 'TW'}</span>
            </button>
            <div
              className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-medium cursor-pointer"
              title={user?.username}
            >
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title={t('nav.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <SystemJobsTabs
          currentPath={location.pathname}
          jobs={systemJobs}
          storageKey={`cortex.systemJobsTabs.${user?.id ?? user?.username ?? 'anonymous'}`}
        />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
        <BottomToolArea />
      </main>

      {/* Right Panel (Research toggle) */}
      <button
        onClick={togglePanel}
        className={`fixed right-4 bottom-4 z-20 p-2.5 rounded-full shadow-lg transition-colors ${
          researchPanelOpen
            ? 'bg-primary-600 text-white'
            : 'bg-white text-gray-600 border border-gray-200'
        }`}
        title={t('nav.research')}
      >
        {researchPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
      </button>
    </div>
  );
}
