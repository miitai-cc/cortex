import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Search, Loader2, FileText } from 'lucide-react';
import { searchApi } from '../../services/api';
import ReactMarkdown from 'react-markdown';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';

export default function SearchHybridPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await searchApi.query({ query: query.trim(), top_k: 5, use_hybrid: true });
      setResult(res.data);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <CommonHeroTitle icon={Layers} title={t('nav.search.hybrid')} description="結合向量語意與關鍵字的混合搜尋模式" />

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          className="input-field flex-1"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          {t('search.submit')}
        </button>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {result && (
        <div className="space-y-6">
          {result.answer && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('search.answer')}</h2>
              <div className="prose max-w-none">
                <ReactMarkdown>{result.answer}</ReactMarkdown>
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('search.sources')}</h2>
            {result.chunks?.length > 0 ? (
              <div className="space-y-3">
                {result.chunks.map((chunk: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {chunk.filename || t('common.loading')}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                        {Math.round(chunk.score * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{chunk.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">{t('search.noResults')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
