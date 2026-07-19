import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from 'eiva-fe-security';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  KeyRound,
  Link2,
  Plus,
  Save,
  Sliders,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import {
  systemSettingsApi,
  type CommonSystemLink,
  type SystemSettingsPayload,
} from '../services/api';

const empty: SystemSettingsPayload = {
  embeddingModel: '',
  rerankingModel: '',
  pageindexModel: '',
  openaiBaseUrl: '',
  pageindexBaseUrl: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  commonLinks: [],
};

export default function SettingsSystemPage() {
  const user = useAuthStore((state) => state.user);
  const [form, setForm] = useState<SystemSettingsPayload>(empty);
  const settings = useQuery({ queryKey: ['system-settings'], queryFn: systemSettingsApi.get });
  const model = settings.data?.data;

  useEffect(() => {
    if (!model) return;
    setForm({
      embeddingModel: model.embeddingModel,
      rerankingModel: model.rerankingModel,
      pageindexModel: model.pageindexModel,
      openaiBaseUrl: model.openaiBaseUrl,
      pageindexBaseUrl: model.pageindexBaseUrl,
      contactName: model.contactName ?? '',
      contactEmail: model.contactEmail ?? '',
      contactPhone: model.contactPhone ?? '',
      commonLinks: model.commonLinks ?? [],
    });
  }, [model]);

  const save = useMutation({
    mutationFn: () => systemSettingsApi.update(form),
    onSuccess: async () => {
      await settings.refetch();
      toast.success('系統參數已儲存；底部資訊立即更新，模型設定於重啟後生效');
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '系統參數儲存失敗'),
  });
  const account = user as typeof user & { role?: string };
  const admin = (user?.roles?.includes('admin') ?? false) || account?.role === 'admin';
  const requiredValues = [
    form.embeddingModel,
    form.rerankingModel,
    form.pageindexModel,
    form.openaiBaseUrl,
    form.pageindexBaseUrl,
  ];
  const invalidLinks = form.commonLinks.some((link) => !link.label.trim() || !link.url.trim());

  const updateLink = (index: number, patch: Partial<CommonSystemLink>) => {
    setForm((current) => ({
      ...current,
      commonLinks: current.commonLinks.map((link, position) =>
        position === index ? { ...link, ...patch } : link),
    }));
  };
  const addLink = () => {
    if (form.commonLinks.length >= 20) {
      toast.error('常用連結最多 20 筆');
      return;
    }
    setForm((current) => ({
      ...current,
      commonLinks: [...current.commonLinks, { label: '', url: '' }],
    }));
  };
  const removeLink = (index: number) => {
    setForm((current) => ({
      ...current,
      commonLinks: current.commonLinks.filter((_, position) => position !== index),
    }));
  };
  const moveLink = (index: number, offset: -1 | 1) => {
    const destination = index + offset;
    if (destination < 0 || destination >= form.commonLinks.length) return;
    setForm((current) => {
      const commonLinks = [...current.commonLinks];
      [commonLinks[index], commonLinks[destination]] = [commonLinks[destination], commonLinks[index]];
      return { ...current, commonLinks };
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <CommonHeroTitle
        icon={Sliders}
        title="系統參數"
        description="維護模型、API Endpoint，以及全站底部顯示的聯絡窗口與常用連結"
      />
      {model?.restartRequired && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>模型設定尚未套用</strong>
            <p>設定已持久化至後端資料庫；模型及 Endpoint 需重新啟動 Cortex Backend 後套用。</p>
          </div>
        </div>
      )}

      <section className="card mb-6 space-y-5">
        <h2 className="font-semibold">AI 模型</h2>
        <Field label="Embedding 模型" help="文件索引與查詢向量化使用的模型名稱">
          <input disabled={!admin} className="input-field" value={form.embeddingModel} onChange={(event) => setForm({ ...form, embeddingModel: event.target.value })} />
        </Field>
        <Field label="Reranking 模型" help="RAG 結果重新排序使用的模型名稱">
          <input disabled={!admin} className="input-field" value={form.rerankingModel} onChange={(event) => setForm({ ...form, rerankingModel: event.target.value })} />
        </Field>
        <Field label="PageIndex 模型" help="PageIndex 文件結構分析使用的 LLM 模型">
          <input disabled={!admin} className="input-field" value={form.pageindexModel} onChange={(event) => setForm({ ...form, pageindexModel: event.target.value })} />
        </Field>
        <hr className="border-gray-200 dark:border-gray-700" />
        <h2 className="font-semibold">API Endpoint</h2>
        <Field label="OpenAI 相容 API Base URL" help="必須使用 http 或 https">
          <input disabled={!admin} type="url" className="input-field" value={form.openaiBaseUrl} onChange={(event) => setForm({ ...form, openaiBaseUrl: event.target.value })} />
        </Field>
        <Field label="PageIndex API Base URL" help="PageIndex 會以此端點呼叫相容 LLM API">
          <input disabled={!admin} type="url" className="input-field" value={form.pageindexBaseUrl} onChange={(event) => setForm({ ...form, pageindexBaseUrl: event.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <KeyStatus label="OPENAI_API_KEY" configured={!!model?.openaiApiKeyConfigured} />
          <KeyStatus label="PAGEINDEX_API_KEY" configured={!!model?.pageindexApiKeyConfigured} />
        </div>
        <p className="text-xs text-gray-500">基於安全性，API Key 不會透過此頁讀取、回傳或明文寫入資料庫；請在後端環境變數或秘密管理服務中設定。</p>
      </section>

      <section className="card mb-6 space-y-5">
        <div>
          <h2 className="font-semibold">底部資訊列</h2>
          <p className="mt-1 text-xs text-gray-500">聯絡窗口會顯示在每個功能頁最下方；未填欄位不顯示連結。</p>
        </div>
        <Field label="聯絡窗口名稱" help="例如：資訊服務台、MIS 值班窗口">
          <input disabled={!admin} maxLength={120} className="input-field" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="聯絡 Email" help="點選後開啟郵件程式">
            <input disabled={!admin} type="email" maxLength={254} className="input-field" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
          </Field>
          <Field label="聯絡電話／分機" help="可留空">
            <input disabled={!admin} maxLength={80} className="input-field" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} />
          </Field>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-medium"><Link2 className="h-4 w-4" />常用連結</h3>
            <p className="mt-1 text-xs text-gray-500">依此處順序顯示於底部選單，僅接受 HTTP／HTTPS 網址。</p>
          </div>
          <button type="button" disabled={!admin || form.commonLinks.length >= 20} className="btn-secondary flex items-center gap-1.5 text-sm" onClick={addLink}>
            <Plus className="h-4 w-4" />新增連結
          </button>
        </div>
        <div className="space-y-3">
          {form.commonLinks.map((link, index) => (
            <div key={`common-link-${index}`} className="grid gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-[1fr_2fr_auto] md:items-center">
              <input disabled={!admin} maxLength={80} className="input-field" placeholder="連結名稱" value={link.label} onChange={(event) => updateLink(index, { label: event.target.value })} />
              <input disabled={!admin} type="url" className="input-field" placeholder="https://portal.example.com" value={link.url} onChange={(event) => updateLink(index, { url: event.target.value })} />
              <div className="flex justify-end gap-1">
                <button type="button" disabled={!admin || index === 0} title="向上移動" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700" onClick={() => moveLink(index, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={!admin || index === form.commonLinks.length - 1} title="向下移動" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700" onClick={() => moveLink(index, 1)}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" disabled={!admin} title="刪除連結" className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20" onClick={() => removeLink(index)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {!form.commonLinks.length && <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400 dark:border-gray-700">尚未設定常用連結</div>}
        </div>
      </section>

      {!admin && <p className="mt-4 text-sm text-amber-600">目前帳號只有檢視權限；僅系統管理員可修改。</p>}
      <button
        disabled={!admin || save.isPending || settings.isLoading || requiredValues.some((value) => !value.trim()) || invalidLinks}
        onClick={() => save.mutate()}
        className="btn-primary flex items-center gap-2 px-6 py-2.5"
      >
        <Save className="h-4 w-4" />{save.isPending ? '儲存中…' : '儲存系統參數'}
      </button>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <span className="ml-2 text-xs text-gray-400">{help}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function KeyStatus({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${configured ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700'}`}>
      <KeyRound className={`h-5 w-5 ${configured ? 'text-emerald-600' : 'text-gray-400'}`} />
      <div><p className="font-mono text-xs">{label}</p><p className={`text-xs ${configured ? 'text-emerald-600' : 'text-gray-400'}`}>{configured ? '已由環境設定' : '未設定'}</p></div>
      {configured && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />}
    </div>
  );
}
