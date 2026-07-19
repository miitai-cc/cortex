import { useState } from 'react';
import { Brain, CloudCog, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import SystemAdministrationPage from './SystemAdministrationPage';

export default function AiManagementSettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'ai-models' | 'contexts' | 'ai-providers'>('ai-models');

  return (
    <div className="mx-auto max-w-[1600px] pb-10">
      <div className="px-4">
        <CommonHeroTitle
          icon={Cpu}
          title={t('nav.settings.aiManagement')}
          description="管理 AI 模型端點與預設的 Context 模板"
        />
      </div>
      
      <div className="border-b border-gray-200 px-4 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab('ai-models')}
            className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'ai-models'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Cpu className="h-4 w-4" />
            AI Model 管理
          </button>
          <button
            onClick={() => setActiveTab('contexts')}
            className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'contexts'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Brain className="h-4 w-4" />
            上下文管理
          </button>
          <button
            onClick={() => setActiveTab('ai-providers')}
            className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'ai-providers'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <CloudCog className="h-4 w-4" />
            AI Providers 管理
          </button>
        </nav>
      </div>
      
      <div className="mt-6 px-4">
        <SystemAdministrationPage sectionProp={activeTab} hideHeader hideWrapper />
      </div>
    </div>
  );
}
