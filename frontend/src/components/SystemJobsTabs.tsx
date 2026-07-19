import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DEFAULT_AUTHENTICATED_PATH, LOGIN_PATH } from '../utils/authNavigation';

export interface SystemJobDefinition {
  path: string;
  labelKey: string;
  icon: LucideIcon;
}

interface SystemJobsTabsProps {
  currentPath: string;
  jobs: SystemJobDefinition[];
  storageKey: string;
}

interface TabContextMenu {
  path: string;
  x: number;
  y: number;
}

const isWorkPath = (path: unknown): path is string =>
  typeof path === 'string'
  && path.startsWith('/cortex/')
  && path !== LOGIN_PATH;

const isTrackablePath = (path: unknown, jobs: SystemJobDefinition[]): path is string =>
  isWorkPath(path)
  && (jobs.some((job) => job.path === path) || /^\/cortex\/documents\/[^/]+$/.test(path));

function readStoredTabs(storageKey: string, jobs: SystemJobDefinition[]) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((path) => isTrackablePath(path, jobs)))];
  } catch {
    return [];
  }
}

function fallbackLabel(path: string) {
  if (/^\/cortex\/documents\/[^/]+$/.test(path)) return '文件詳情';
  const segments = path.split('/').filter(Boolean);
  const segment = segments[segments.length - 1] ?? '工作';
  try {
    return decodeURIComponent(segment).replace(/-/g, ' ');
  } catch {
    return segment.replace(/-/g, ' ');
  }
}

export default function SystemJobsTabs({ currentPath, jobs, storageKey }: SystemJobsTabsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<string[]>(() => {
    const stored = readStoredTabs(storageKey, jobs);
    return isTrackablePath(currentPath, jobs) && !stored.includes(currentPath)
      ? [...stored, currentPath]
      : stored;
  });
  const [contextMenu, setContextMenu] = useState<TabContextMenu | null>(null);

  useEffect(() => {
    if (!isTrackablePath(currentPath, jobs)) return;
    setTabs((current) => current.includes(currentPath) ? current : [...current, currentPath]);
  }, [currentPath, jobs]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(tabs));
  }, [storageKey, tabs]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  const definitionFor = (path: string) => jobs.find((job) => job.path === path);
  const labelFor = (path: string) => {
    const definition = definitionFor(path);
    return definition ? t(definition.labelKey) : fallbackLabel(path);
  };

  const closeTab = (path: string) => {
    const index = tabs.indexOf(path);
    const remaining = tabs.filter((tab) => tab !== path);
    setTabs(remaining);
    setContextMenu(null);
    if (path !== currentPath) return;

    const adjacent = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
    const fallback = currentPath === DEFAULT_AUTHENTICATED_PATH
      ? '/cortex/dashboard'
      : DEFAULT_AUTHENTICATED_PATH;
    navigate(adjacent ?? fallback);
  };

  const closeOtherTabs = (path: string) => {
    setTabs([path]);
    setContextMenu(null);
    if (path !== currentPath) navigate(path);
  };

  const openContextMenu = (event: React.MouseEvent, path: string) => {
    event.preventDefault();
    const menuWidth = 176;
    const menuHeight = 88;
    setContextMenu({
      path,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  return (
    <div className="SysJobsTabs" aria-label={t('tabs.systemJobs')}>
      <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
        {t('tabs.systemJobs')}
      </span>
      <div className="SysJobsTabsScroller" role="tablist" aria-label={t('tabs.systemJobs')}>
        {tabs.map((path) => {
          const active = path === currentPath;
          const definition = definitionFor(path);
          const Icon = definition?.icon;
          return (
            <div
              key={path}
              className={`group flex shrink-0 items-center rounded-lg border transition-colors ${
                active
                  ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              onContextMenu={(event) => openContextMenu(event, path)}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className="flex max-w-48 items-center gap-1.5 py-1.5 pl-2.5 text-xs font-medium"
                title={labelFor(path)}
                onClick={() => navigate(path)}
              >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{labelFor(path)}</span>
              </button>
              <button
                type="button"
                className="mx-1 rounded p-0.5 text-gray-400 hover:bg-white hover:text-red-500 dark:hover:bg-gray-600"
                title={t('tabs.close')}
                aria-label={`${t('tabs.close')}：${labelFor(path)}`}
                onClick={() => closeTab(path)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <div
          className="fixed z-[80] w-44 rounded-lg border border-gray-200 bg-white p-1.5 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-800"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            role="menuitem"
            onClick={() => closeTab(contextMenu.path)}
          >
            {t('tabs.closeThis')}
          </button>
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700"
            role="menuitem"
            disabled={tabs.length <= 1}
            onClick={() => closeOtherTabs(contextMenu.path)}
          >
            {t('tabs.closeOthers')}
          </button>
        </div>
      )}
    </div>
  );
}
