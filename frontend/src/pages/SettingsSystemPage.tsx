import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from 'eiva-fe-security';
import { AlertTriangle, CheckCircle2, KeyRound, Save, Sliders } from 'lucide-react';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import { systemSettingsApi, type SystemSettingsPayload } from '../services/api';

const empty: SystemSettingsPayload = { embeddingModel: '', rerankingModel: '', pageindexModel: '', openaiBaseUrl: '', pageindexBaseUrl: '' };

export default function SettingsSystemPage() {
  const user = useAuthStore((state) => state.user);
  const [form, setForm] = useState<SystemSettingsPayload>(empty);
  const settings = useQuery({ queryKey: ['system-settings'], queryFn: systemSettingsApi.get });
  const model = settings.data?.data;
  useEffect(() => {
    if (!model) return;
    setForm({ embeddingModel: model.embeddingModel, rerankingModel: model.rerankingModel, pageindexModel: model.pageindexModel, openaiBaseUrl: model.openaiBaseUrl, pageindexBaseUrl: model.pageindexBaseUrl });
  }, [model]);
  const save = useMutation({
    mutationFn: () => systemSettingsApi.update(form),
    onSuccess: () => { settings.refetch(); toast.success('系統參數已儲存，重新啟動後生效'); },
    onError: (error: any) => toast.error(error.response?.data?.error || '系統參數儲存失敗'),
  });
  const admin = user?.roles?.includes('admin') ?? false;
  return <div className="mx-auto max-w-4xl px-4 pb-10">
    <CommonHeroTitle icon={Sliders} title="系統參數" description="維護後端實際使用的模型與 API Endpoint；秘密金鑰只由環境變數提供" />
    {model?.restartRequired && <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>設定尚未套用</strong><p>已持久化至後端資料庫；請重新啟動 Cortex Backend，啟動流程會自動載入新值。</p></div></div>}
    <div className="card space-y-5">
      <h2 className="font-semibold">AI 模型</h2>
      <Field label="Embedding 模型" help="文件索引與查詢向量化使用的模型名稱"><input disabled={!admin} className="input-field w-full" value={form.embeddingModel} onChange={(event) => setForm({ ...form, embeddingModel: event.target.value })} /></Field>
      <Field label="Reranking 模型" help="RAG 結果重新排序使用的模型名稱"><input disabled={!admin} className="input-field w-full" value={form.rerankingModel} onChange={(event) => setForm({ ...form, rerankingModel: event.target.value })} /></Field>
      <Field label="PageIndex 模型" help="PageIndex 文件結構分析使用的 LLM 模型"><input disabled={!admin} className="input-field w-full" value={form.pageindexModel} onChange={(event) => setForm({ ...form, pageindexModel: event.target.value })} /></Field>
      <hr className="border-gray-200 dark:border-gray-700" />
      <h2 className="font-semibold">API Endpoint</h2>
      <Field label="OpenAI 相容 API Base URL" help="必須使用 http 或 https"><input disabled={!admin} type="url" className="input-field w-full" value={form.openaiBaseUrl} onChange={(event) => setForm({ ...form, openaiBaseUrl: event.target.value })} /></Field>
      <Field label="PageIndex API Base URL" help="PageIndex 會以此端點呼叫相容 LLM API"><input disabled={!admin} type="url" className="input-field w-full" value={form.pageindexBaseUrl} onChange={(event) => setForm({ ...form, pageindexBaseUrl: event.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><KeyStatus label="OPENAI_API_KEY" configured={!!model?.openaiApiKeyConfigured} /><KeyStatus label="PAGEINDEX_API_KEY" configured={!!model?.pageindexApiKeyConfigured} /></div>
      <p className="text-xs text-gray-500">基於安全性，API Key 不會透過此頁讀取、回傳或明文寫入資料庫；請在後端環境變數或秘密管理服務中設定。</p>
    </div>
    {!admin && <p className="mt-4 text-sm text-amber-600">目前帳號只有檢視權限；僅系統管理員可修改。</p>}
    <button disabled={!admin || save.isPending || settings.isLoading || Object.values(form).some((value) => !value.trim())} onClick={() => save.mutate()} className="btn-primary mt-5 flex items-center gap-2 px-6 py-2.5"><Save className="h-4 w-4" />{save.isPending ? '儲存中…' : '儲存系統參數'}</button>
  </div>;
}

function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) { return <label className="block"><span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span><span className="ml-2 text-xs text-gray-400">{help}</span><div className="mt-1">{children}</div></label>; }
function KeyStatus({ label, configured }: { label: string; configured: boolean }) { return <div className={`flex items-center gap-3 rounded-lg border p-3 ${configured ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700'}`}><KeyRound className={`h-5 w-5 ${configured ? 'text-emerald-600' : 'text-gray-400'}`} /><div><p className="font-mono text-xs">{label}</p><p className={`text-xs ${configured ? 'text-emerald-600' : 'text-gray-400'}`}>{configured ? '已由環境設定' : '未設定'}</p></div>{configured && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />}</div>; }
