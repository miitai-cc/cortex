import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { Settings, Shield, Bell, Key } from 'lucide-react';

export default function PersonalSettings() {
  const { t } = useTranslation();
  return (
    <div className="max-w-[1200px] mx-auto px-4 pb-12 animate-in fade-in zoom-in-95 duration-700">
      <CommonHeroTitle
        icon={Settings}
        title={t('personal.settings.title')}
        description={t('personal.settings.desc')}
        theme={{ titleColor: '#1e293b' }}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="col-span-1 space-y-2">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer border-l-4 border-l-slate-800 dark:border-l-slate-400 font-semibold text-slate-800 dark:text-slate-200">
            {t('personal.settings.profile')}
          </div>
          <div className="p-4 rounded-2xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer font-medium transition-colors">
            {t('personal.settings.security')}
          </div>
          <div className="p-4 rounded-2xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer font-medium transition-colors">
            {t('personal.settings.notifications')}
          </div>
        </div>

        <div className="col-span-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-8 border border-white/50 dark:border-gray-700/50 shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <UserIcon className="text-slate-500" /> {t('personal.settings.general')}
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('personal.settings.displayName')}</label>
              <input type="text" defaultValue="Current User" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-500 outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('personal.settings.email')}</label>
              <input type="email" defaultValue="user@example.com" disabled className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 rounded-xl px-4 py-3 cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('personal.settings.language')}</label>
              <select className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-500 outline-none">
                <option>English (US)</option>
                <option>繁體中文 (台灣)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
            <button className="px-6 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{t('personal.settings.cancel')}</button>
            <button className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium shadow-lg shadow-slate-800/20 transition-all active:scale-95">{t('personal.settings.save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
