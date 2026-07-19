import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from 'eiva-fe-security';
import { useResearchStore } from '../stores/researchStore';
import { useThemeStore } from '../stores/themeStore';
import {
  Brain,
  PanelRightOpen,
  PanelRightClose,
  PanelLeftOpen,
  PanelLeftClose,
  Moon,
  Sun,
  Megaphone,
  User,
  Globe,
  LogOut,
} from 'lucide-react';
import DirectoryBrowser from './DirectoryBrowser';
import BottomToolArea from './BottomToolArea';
import TopQuickActions from './TopQuickActions';
import TopNewsTicker from './common/TopNewsTicker';
import TopApiStatus from './common/TopApiStatus';

import SystemJobsTabs, { type SystemJobDefinition } from './SystemJobsTabs';
import { DEFAULT_AUTHENTICATED_PATH } from '../utils/authNavigation';
import { departmentConfigs } from '../config/departments';
import { systemAdminApi } from '../services/api';
import type { SystemUserContext } from '../types/systemAdmin';
import { navItems, type SubMenuItem, type NavItem } from '../lib/navConfig';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { togglePanel, panelOpen: researchPanelOpen } = useResearchStore();
  const { theme, toggleTheme } = useThemeStore();
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [directory, setDirectory] = useState(() => localStorage.getItem('cortex-doc-directory') || '/');
  const [selectedProject, setSelectedProject] = useState<{ id?: string; name: string }>(() => {
    try {
      return JSON.parse(localStorage.getItem('cortex-selected-project') || '{"name":"未選專案"}');
    } catch {
      return { name: '未選專案' };
    }
  });
  const systemContext = useQuery({ queryKey: ['system-context'], queryFn: systemAdminApi.context, staleTime: 60_000 });
  const account = user as typeof user & { role?: string };
  const admin = (user?.roles?.includes('admin') ?? false) || account?.role === 'admin';
  const visibleNavItems = useMemo(() => {
    const policies = systemContext.data?.data.menus ?? [];
    if (!policies.length) return navItems;
    return navItems
      .filter((item) => item.to === '/cortex/settings' && admin
        ? true
        : policies.find((policy) => policy.path === item.to)?.enabled !== false);
  }, [admin, systemContext.data?.data.menus]);
  const systemJobs: SystemJobDefinition[] = useMemo(() => visibleNavItems.flatMap((item) => item.children.map((child) => ({
    path: child.to,
    labelKey: child.labelKey,
    icon: child.icon,
  }))), [visibleNavItems]);

  useEffect(() => {
    const directoryChanged = (event: Event) => setDirectory((event as CustomEvent<string>).detail || localStorage.getItem('cortex-doc-directory') || '/');
    const projectChanged = (event: Event) => setSelectedProject((event as CustomEvent<{ id?: string; name: string }>).detail || { name: '未選專案' });
    const storageChanged = (event: StorageEvent) => {
      if (event.key === 'cortex-doc-directory') setDirectory(event.newValue || '/');
      if (event.key === 'cortex-selected-project') {
        try { setSelectedProject(JSON.parse(event.newValue || '{"name":"未選專案"}')); } catch { setSelectedProject({ name: '未選專案' }); }
      }
    };
    window.addEventListener('cortex-directory-changed', directoryChanged);
    window.addEventListener('cortex-project-changed', projectChanged);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.removeEventListener('cortex-directory-changed', directoryChanged);
      window.removeEventListener('cortex-project-changed', projectChanged);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);

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

  const activeNavItem = visibleNavItems.find(matchesCurrentRoute);

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
          {visibleNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.children?.length > 0 ? item.children[0].to : item.to}
              onClick={() => handleNavClick(item)}
              className={`p-2.5 rounded-lg transition-colors ${activeNavItem?.to === item.to
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
        className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200 overflow-hidden ${leftPanelOpen && activeNavItem ? 'w-60' : 'w-0'
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
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${isSubActive
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
          <CurrentWorkContext
            context={systemContext.data?.data.currentUser}
            fallbackUsername={user?.username ?? 'unknown'}
            project={selectedProject.name || '未選專案'}
            directory={directory}
          />
          
          <div className="flex-1 flex justify-center px-4">
            <TopNewsTicker />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <TopApiStatus systemContext={systemContext} />
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
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
        className={`fixed right-4 bottom-4 z-20 p-2.5 rounded-full shadow-lg transition-colors ${researchPanelOpen
            ? 'bg-primary-600 text-white'
            : 'bg-white text-gray-600 border border-gray-200'
          }`}
        title={t('nav.orgManagement')}
      >
        {researchPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
      </button>
    </div>
  );
}

function CurrentWorkContext({ context, fallbackUsername, project, directory }: {
  context?: SystemUserContext;
  fallbackUsername: string;
  project: string;
  directory: string;
}) {
  const company = context?.company || '未設定公司';
  const department = context?.departmentName || '未設定部門';
  const username = context?.username || fallbackUsername;
  const name = context?.displayName || fallbackUsername;
  const title = context?.jobTitle || '未設定職稱';
  const permission = context?.permissionLabel || context?.roleName || '未設定權限';
  const text = `${company}/${department}/${username}:${name}-${title}:${permission} === ${project} : ${directory}`;
  return (
    <div className="min-w-0 flex-1 truncate text-xs font-medium text-gray-600 dark:text-gray-300" title={text} aria-label="目前使用者與工作上下文">
      {text}
    </div>
  );
}
