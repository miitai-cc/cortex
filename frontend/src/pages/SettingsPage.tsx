import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Settings } from 'lucide-react';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language);

  const handleLanguageChange = (lng: string) => {
    setLanguage(lng);
    i18n.changeLanguage(lng);
    toast.success(t('settings.saved'));
  };

  return (
    <div className="max-w-2xl-empty">
      <CommonHeroTitle icon={Settings} title={t('settings.title')} />

      <div className="card space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('settings.language')}
          </label>
          <select
            className="input-field"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            <option value="zh-TW">{t('settings.language.zhTW')}</option>
            <option value="en">{t('settings.language.en')}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
