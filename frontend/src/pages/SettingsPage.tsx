import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language);

  const handleLanguageChange = (lng: string) => {
    setLanguage(lng);
    i18n.changeLanguage(lng);
    toast.success(t('settings.saved'));
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('settings.title')}</h1>
      
      <div className="card space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
