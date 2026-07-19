import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Cpu,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  BarChart3,
  Layers,
  ArrowUpDown,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { aiModelApi } from '../services/api';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
interface EmbedResult {
  model: string;
  dimension: number;
  preview: number[];
  embedding: number[];
}

interface RerankResultItem {
  index: number;
  document: string;
  relevance_score: number;
}

interface RerankResult {
  model: string;
  query: string;
  results: RerankResultItem[];
}

// ──────────────────────────────────────────
// Embedding Tab
// ──────────────────────────────────────────
function EmbeddingTab() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmbedResult | null>(null);
  const [error, setError] = useState('');
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEmbed = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await aiModelApi.embed(text.trim());
      setResult(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data || t('common.error');
      setError(typeof msg === 'string' ? msg : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.embedding));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maxAbs = result ? Math.max(...result.preview.map(Math.abs), 1e-9) : 1;
  const normalized = result ? result.preview.map((v) => v / maxAbs) : [];

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            輸入文字 (Text to Embed)
          </span>
        </div>
        <textarea
          id="embed-input-text"
          className="input-field w-full resize-none"
          rows={4}
          placeholder="輸入要向量化的文字，例如：Rust 的借用規則是什麼？"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleEmbed();
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">Ctrl+Enter 送出</span>
          <button
            id="embed-submit-btn"
            onClick={handleEmbed}
            disabled={loading || !text.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? '向量化中…' : 'Embed'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Meta */}
          <div className="card">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">模型</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{result.model}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">向量維度</span>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{result.dimension}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">預覽</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">前 {result.preview.length} 個維度</span>
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Embedding 向量視覺化（前 {result.preview.length} 維）
                </span>
              </div>
              <button
                id="embed-copy-btn"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? '已複製' : '複製完整向量'}
              </button>
            </div>

            <div className="flex items-center gap-0.5 h-28">
              {normalized.map((v, i) => {
                const positive = v >= 0;
                const heightPct = Math.abs(v) * 100;
                return (
                  <div
                    key={i}
                    className="relative flex-1 flex flex-col justify-center group h-full"
                    title={`dim[${i}] = ${result.preview[i].toFixed(4)}`}
                  >
                    {/* Center line */}
                    <div className="absolute top-1/2 w-full h-px bg-gray-200 dark:bg-gray-600" />
                    {/* Bar */}
                    <div
                      className="absolute w-full rounded-sm transition-all duration-500"
                      style={{
                        height: `${Math.max(heightPct / 2, 2)}%`,
                        background: positive
                          ? `hsl(${220 + i * 5}, 70%, 55%)`
                          : `hsl(${360 - i * 3}, 65%, 55%)`,
                        top: positive ? undefined : '50%',
                        bottom: positive ? '50%' : undefined,
                      }}
                    />
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {result.preview[i].toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">dim[0]</span>
              <span className="text-xs text-gray-400">dim[{result.preview.length - 1}]</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 rounded-sm bg-blue-500" /> 正值
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 rounded-sm bg-red-400" /> 負值
              </span>
            </div>
          </div>

          {/* Full embedding toggle */}
          <div className="card">
            <button
              id="embed-toggle-full"
              onClick={() => setShowFull(!showFull)}
              className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              {showFull ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showFull ? '收起完整向量' : `展開完整向量 (${result.dimension} 個值)`}
            </button>
            {showFull && (
              <pre className="mt-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto max-h-48 overflow-y-auto">
                [{result.embedding.map((v) => v.toFixed(6)).join(', ')}]
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Reranking Tab
// ──────────────────────────────────────────
function RerankingTab() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RerankResult | null>(null);
  const [error, setError] = useState('');

  const addDoc = () => setDocuments((prev) => [...prev, '']);
  const removeDoc = (idx: number) => setDocuments((prev) => prev.filter((_, i) => i !== idx));
  const updateDoc = (idx: number, val: string) =>
    setDocuments((prev) => prev.map((d, i) => (i === idx ? val : d)));

  const handleRerank = async () => {
    const validDocs = documents.filter((d) => d.trim());
    if (!query.trim() || validDocs.length === 0) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await aiModelApi.rerank(query.trim(), validDocs);
      setResult(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data || t('common.error');
      setError(typeof msg === 'string' ? msg : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 0.7) return 'bg-emerald-500';
    if (score >= 0.4) return 'bg-amber-400';
    return 'bg-rose-400';
  };

  const scoreLabel = (score: number) => {
    if (score >= 0.7) return { text: '高度相關', cls: 'text-emerald-600 dark:text-emerald-400' };
    if (score >= 0.4) return { text: '部分相關', cls: 'text-amber-600 dark:text-amber-400' };
    return { text: '低度相關', cls: 'text-rose-500 dark:text-rose-400' };
  };

  const rankBadge = (rank: number) => {
    if (rank === 0) return 'bg-gradient-to-br from-amber-400 to-orange-500';
    if (rank === 1) return 'bg-gradient-to-br from-slate-400 to-slate-500';
    if (rank === 2) return 'bg-gradient-to-br from-orange-700 to-orange-800';
    return 'bg-gray-300 dark:bg-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Query */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">查詢語句 (Query)</span>
        </div>
        <input
          id="rerank-query-input"
          type="text"
          className="input-field w-full"
          placeholder="輸入查詢，例如：Rust 記憶體安全機制"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Documents */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              候選文件 (Documents)
            </span>
          </div>
          <button
            id="rerank-add-doc-btn"
            onClick={addDoc}
            className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800 transition-colors"
          >
            <Plus className="w-3 h-3" />
            新增文件
          </button>
        </div>
        {documents.map((doc, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <span className="mt-2.5 text-xs font-mono text-gray-400 dark:text-gray-500 w-5 shrink-0 text-right">
              {idx + 1}
            </span>
            <textarea
              id={`rerank-doc-${idx}`}
              className="input-field flex-1 resize-none text-sm"
              rows={2}
              placeholder={`候選文件 ${idx + 1}`}
              value={doc}
              onChange={(e) => updateDoc(idx, e.target.value)}
            />
            {documents.length > 2 && (
              <button
                onClick={() => removeDoc(idx)}
                className="mt-1 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <button
            id="rerank-submit-btn"
            onClick={handleRerank}
            disabled={loading || !query.trim() || documents.every((d) => !d.trim())}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpDown className="w-4 h-4" />}
            {loading ? 'Reranking…' : 'Rerank'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 px-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>模型：{result.model}</span>
            <span className="mx-1">·</span>
            <span>共 {result.results.length} 個文件排序結果</span>
          </div>
          {result.results.map((item, rank) => {
            const label = scoreLabel(item.relevance_score);
            return (
              <div key={item.index} className="card border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-start gap-3">
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${rankBadge(rank)}`}
                  >
                    {rank + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{item.document}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${scoreColor(item.relevance_score)}`}
                          style={{ width: `${Math.min(item.relevance_score * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold tabular-nums ${label.cls}`}>
                        {(item.relevance_score * 100).toFixed(1)}%
                      </span>
                      <span className={`text-xs ${label.cls}`}>{label.text}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────
type TabId = 'embedding' | 'reranking';

const TABS: { id: TabId; label: string; icon: typeof Cpu }[] = [
  { id: 'embedding', label: 'Embedding', icon: Layers },
  { id: 'reranking', label: 'Reranking', icon: ArrowUpDown },
];

export default function AiModelsPage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const activeTab: TabId = tab === 'reranking' ? 'reranking' : 'embedding';

  useEffect(() => {
    if (tab !== 'embedding' && tab !== 'reranking') {
      navigate('/cortex/ai-models/embedding', { replace: true });
    }
  }, [navigate, tab]);

  return (
    <div className="max-w-3xl mx-auto">
      <CommonHeroTitle
        icon={Cpu}
        title="AI Models"
        description="直接呼叫 Embedding 與 Reranking 模型進行測試"
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`ai-models-tab-${id}`}
            onClick={() => navigate(`/cortex/ai-models/${id}`)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === id
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'embedding' && <EmbeddingTab />}
      {activeTab === 'reranking' && <RerankingTab />}
    </div>
  );
}
