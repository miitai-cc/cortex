import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sliders, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

export default function SettingsSystemPage() {
  const { t } = useTranslation();
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [rerankingModel, setRerankingModel] = useState('bge-reranker-v2-m3');
  const [llmProvider, setLlmProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    toast.success(t('settings.saved'));
  };

  return (
    <div>
      <CommonHeroTitle icon={Sliders} title={t('nav.settings.system')} description="調整 AI 模型與系統參數" />

      <div className="max-w-2xl space-y-6">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">{t('settings.model')}</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.embeddingModel')}</label>
            <select
              className="input-field w-full"
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
            >
              <option value="text-embedding-3-small">text-embedding-3-small</option>
              <option value="text-embedding-3-large">text-embedding-3-large</option>
              <option value="bge-large-en-v1.5">bge-large-en-v1.5</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.rerankingModel')}</label>
            <select
              className="input-field w-full"
              value={rerankingModel}
              onChange={(e) => setRerankingModel(e.target.value)}
            >
              <option value="bge-reranker-v2-m3">bge-reranker-v2-m3</option>
              <option value="cohere-rerank-v3.5">cohere-rerank-v3.5</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.llmProvider')}</label>
            <select
              className="input-field w-full"
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="local">Local LLM</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.apiKey')}</label>
            <input
              type="password"
              className="input-field w-full"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          {t('settings.save')}
        </button>
      </div>
    </div>
  );
}
