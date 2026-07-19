import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronUp,
  ExternalLink,
  Headphones,
  Link2,
  Mail,
  Phone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { systemAdminApi, systemSettingsApi } from '../services/api';

export default function BottomToolArea() {
  const { t } = useTranslation();
  const settings = useQuery({
    queryKey: ['system-settings'],
    queryFn: systemSettingsApi.get,
    staleTime: 60_000,
  });
  const model = settings.data?.data;
  const systemContext = useQuery({
    queryKey: ['system-context'],
    queryFn: systemAdminApi.context,
    staleTime: 60_000,
  });
  const about = systemContext.data?.data.about;
  const [linksOpen, setLinksOpen] = useState(false);
  const linksMenuRef = useRef<HTMLDivElement>(null);
  const commonLinks = model?.commonLinks ?? [];

  useEffect(() => {
    if (!linksOpen) return undefined;
    const closeOutside = (event: MouseEvent) => {
      if (!linksMenuRef.current?.contains(event.target as Node)) setLinksOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLinksOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [linksOpen]);

  return (
    <footer className="bottomToolArea" aria-label={t('bottom.systemInformation')}>
      <div className="flex shrink-0 items-center gap-2">
        <span>{about?.copyright || `© ${new Date().getFullYear()} ${about?.companyName || about?.productName || 'Cortex'}`}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span>{t('bottom.version')} v{about?.version || model?.systemVersion || '…'}</span>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <Headphones className="h-3.5 w-3.5 shrink-0 text-primary-500" />
        <span className="shrink-0">{t('bottom.contact')}：</span>
        <span className="truncate font-medium text-gray-700 dark:text-gray-200">
          {model?.contactName || t('bottom.notConfigured')}
        </span>
        {model?.contactEmail && (
          <a className="flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400" href={`mailto:${model.contactEmail}`} title={model.contactEmail}>
            <Mail className="h-3.5 w-3.5" /><span className="hidden lg:inline">{model.contactEmail}</span>
          </a>
        )}
        {model?.contactPhone && (
          <a className="flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400" href={`tel:${model.contactPhone.replace(/[^+\d]/g, '')}`} title={model.contactPhone}>
            <Phone className="h-3.5 w-3.5" /><span>{model.contactPhone}</span>
          </a>
        )}
      </div>

      <div className="relative ml-auto shrink-0" ref={linksMenuRef}>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
          disabled={!commonLinks.length}
          aria-haspopup="menu"
          aria-expanded={linksOpen}
          onClick={() => setLinksOpen((open) => !open)}
        >
          <Link2 className="h-3.5 w-3.5" />
          {t('bottom.commonLinks')}
          <ChevronUp className={`h-3.5 w-3.5 transition-transform ${linksOpen ? '' : 'rotate-180'}`} />
        </button>
        {linksOpen && (
          <div className="absolute bottom-full right-0 z-50 mb-2 max-h-72 w-64 overflow-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800" role="menu">
            {commonLinks.map((link) => (
              <a
                key={`${link.label}-${link.url}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setLinksOpen(false)}
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
