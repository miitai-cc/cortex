import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import {
  systemSettingsApi,
  type CommonSystemLink,
  type SystemSettingsPayload,
} from '../../services/api';

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
  imapServer: '',
  imapPort: '',
  imapUsername: '',
  smtpServer: '',
  smtpPort: '',
  smtpUsername: '',
  googleMailApiEnabled: false,
  enterpriseSystems: [],
};

export default function SettingsSystemPage() {
  const { t } = useTranslation();
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
      imapServer: model.imapServer ?? '',
      imapPort: model.imapPort ?? '',
      imapUsername: model.imapUsername ?? '',
      smtpServer: model.smtpServer ?? '',
      smtpPort: model.smtpPort ?? '',
      smtpUsername: model.smtpUsername ?? '',
      googleMailApiEnabled: model.googleMailApiEnabled ?? false,
      enterpriseSystems: model.enterpriseSystems ?? [],
    });
  }, [model]);

  const save = useMutation({
    mutationFn: () => systemSettingsApi.update(form),
    onSuccess: async () => {
      await settings.refetch();
      toast.success(t("settings.system.saved"));
    },
    onError: (error: any) => toast.error(error.response?.data?.error || t("settings.system.saveFailed")),
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
      toast.error(t("settings.system.linksMax"));
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

  const invalidEnterpriseSystems = form.enterpriseSystems.some(
    (sys) => !sys.label.trim() || !sys.url.trim() || !sys.category.trim() || !sys.area.trim()
  );
  const updateEnterpriseSystem = (index: number, payload: Partial<typeof form.enterpriseSystems[0]>) => {
    setForm((current) => ({
      ...current,
      enterpriseSystems: current.enterpriseSystems.map((sys, pos) => (pos === index ? { ...sys, ...payload } : sys)),
    }));
  };
  const addEnterpriseSystem = () => {
    if (form.enterpriseSystems.length >= 50) {
      toast.error(t("settings.system.systemsMax"));
      return;
    }
    setForm((current) => ({
      ...current,
      enterpriseSystems: [...current.enterpriseSystems, { label: '', url: '', category: '', area: '' }],
    }));
  };
  const removeEnterpriseSystem = (index: number) => {
    setForm((current) => ({
      ...current,
      enterpriseSystems: current.enterpriseSystems.filter((_, position) => position !== index),
    }));
  };
  const moveEnterpriseSystem = (index: number, offset: -1 | 1) => {
    const destination = index + offset;
    if (destination < 0 || destination >= form.enterpriseSystems.length) return;
    setForm((current) => {
      const enterpriseSystems = [...current.enterpriseSystems];
      [enterpriseSystems[index], enterpriseSystems[destination]] = [enterpriseSystems[destination], enterpriseSystems[index]];
      return { ...current, enterpriseSystems };
    });
  };

  return (
    <div className="mx-auto max-w-11xl px-4 pb-10">
      <CommonHeroTitle
        icon={Sliders}
        title={t("settings.system.title")}
        description={t("settings.system.description")}
      />
      {model?.restartRequired && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>{t("settings.system.restartRequired")}</strong>
            <p>{t("settings.system.restartRequiredDesc")}</p>
          </div>
        </div>
      )}

      <section className="card mb-6 space-y-5">
        <h2 className="font-semibold">{t("settings.system.aiModel")}</h2>
        <Field label={t("settings.system.embeddingModel")} help={t("settings.system.embeddingModelHelp")}>
          <input disabled={!admin} className="input-field" value={form.embeddingModel} onChange={(event) => setForm({ ...form, embeddingModel: event.target.value })} />
        </Field>
        <Field label={t("settings.system.rerankingModel")} help={t("settings.system.rerankingModelHelp")}>
          <input disabled={!admin} className="input-field" value={form.rerankingModel} onChange={(event) => setForm({ ...form, rerankingModel: event.target.value })} />
        </Field>
        <Field label={t("settings.system.pageindexModel")} help={t("settings.system.pageindexModelHelp")}>
          <input disabled={!admin} className="input-field" value={form.pageindexModel} onChange={(event) => setForm({ ...form, pageindexModel: event.target.value })} />
        </Field>
        <hr className="border-gray-200 dark:border-gray-700" />
        <h2 className="font-semibold">{t("settings.system.apiEndpoint")}</h2>
        <Field label={t("settings.system.openaiBaseUrl")} help={t("settings.system.openaiBaseUrlHelp")}>
          <input disabled={!admin} type="url" className="input-field" value={form.openaiBaseUrl} onChange={(event) => setForm({ ...form, openaiBaseUrl: event.target.value })} />
        </Field>
        <Field label={t("settings.system.pageindexBaseUrl")} help={t("settings.system.pageindexBaseUrlHelp")}>
          <input disabled={!admin} type="url" className="input-field" value={form.pageindexBaseUrl} onChange={(event) => setForm({ ...form, pageindexBaseUrl: event.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <KeyStatus label="OPENAI_API_KEY" configured={!!model?.openaiApiKeyConfigured} />
          <KeyStatus label="PAGEINDEX_API_KEY" configured={!!model?.pageindexApiKeyConfigured} />
        </div>
        <p className="text-xs text-gray-500">{t("settings.system.apiKeyNote")}</p>
      </section>

      <section className="card mb-6 space-y-5">
        <div>
          <h2 className="font-semibold">{t("settings.system.emailIntegration")}</h2>
          <p className="mt-1 text-xs text-gray-500">{t("settings.system.emailIntegrationDesc")}</p>
        </div>
        
        <h3 className="font-medium text-sm border-b border-gray-200 pb-2 dark:border-gray-700">{t("settings.system.imapSmtp")}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("settings.system.imapServer")} help={t("settings.system.imapServerHelp")}>
            <input disabled={!admin} className="input-field" value={form.imapServer} onChange={(event) => setForm({ ...form, imapServer: event.target.value })} />
          </Field>
          <Field label={t("settings.system.imapPort")} help={t("settings.system.imapPortHelp")}>
            <input disabled={!admin} className="input-field" value={form.imapPort} onChange={(event) => setForm({ ...form, imapPort: event.target.value })} />
          </Field>
          <Field label={t("settings.system.imapUsername")} help={t("settings.system.imapUsernameHelp")}>
            <input disabled={!admin} className="input-field" value={form.imapUsername} onChange={(event) => setForm({ ...form, imapUsername: event.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-2">
          <Field label={t("settings.system.smtpServer")} help={t("settings.system.smtpServerHelp")}>
            <input disabled={!admin} className="input-field" value={form.smtpServer} onChange={(event) => setForm({ ...form, smtpServer: event.target.value })} />
          </Field>
          <Field label={t("settings.system.smtpPort")} help={t("settings.system.smtpPortHelp")}>
            <input disabled={!admin} className="input-field" value={form.smtpPort} onChange={(event) => setForm({ ...form, smtpPort: event.target.value })} />
          </Field>
          <Field label={t("settings.system.smtpUsername")} help={t("settings.system.smtpUsernameHelp")}>
            <input disabled={!admin} className="input-field" value={form.smtpUsername} onChange={(event) => setForm({ ...form, smtpUsername: event.target.value })} />
          </Field>
        </div>

        <h3 className="font-medium text-sm border-b border-gray-200 pb-2 mt-4 dark:border-gray-700">{t("settings.system.googleMailApi")}</h3>
        <label className="flex items-center gap-3">
          <input disabled={!admin} type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700" checked={form.googleMailApiEnabled} onChange={(event) => setForm({ ...form, googleMailApiEnabled: event.target.checked })} />
          <span className="text-sm">{t("settings.system.enableGoogleMailApi")}</span>
        </label>
        <p className="text-xs text-gray-500">{t("settings.system.googleMailApiDesc")}</p>
      </section>

      <section className="card mb-6 space-y-5">
        <div>
          <h2 className="font-semibold">{t("settings.system.bottomInfoBar")}</h2>
          <p className="mt-1 text-xs text-gray-500">{t("settings.system.bottomInfoBarDesc")}</p>
        </div>
        <Field label={t("settings.system.contactName")} help={t("settings.system.contactNameHelp")}>
          <input disabled={!admin} maxLength={120} className="input-field" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("settings.system.contactEmail")} help={t("settings.system.contactEmailHelp")}>
            <input disabled={!admin} type="email" maxLength={254} className="input-field" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
          </Field>
          <Field label={t("settings.system.contactPhone")} help={t("settings.system.contactPhoneHelp")}>
            <input disabled={!admin} maxLength={80} className="input-field" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} />
          </Field>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-medium"><Link2 className="h-4 w-4" />{t("settings.system.commonLinks")}</h3>
            <p className="mt-1 text-xs text-gray-500">{t("settings.system.commonLinksDesc")}</p>
          </div>
          <button type="button" disabled={!admin || form.commonLinks.length >= 20} className="btn-secondary flex items-center gap-1.5 text-sm" onClick={addLink}>
            <Plus className="h-4 w-4" />{t("settings.system.addLink")}
          </button>
        </div>
        <div className="space-y-3">
          {form.commonLinks.map((link, index) => (
            <div key={`common-link-${index}`} className="grid gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-[1fr_2fr_auto] md:items-center">
              <input disabled={!admin} maxLength={80} className="input-field" placeholder={t("settings.system.linkLabelPlaceholder")} value={link.label} onChange={(event) => updateLink(index, { label: event.target.value })} />
              <input disabled={!admin} type="url" className="input-field" placeholder={t("settings.system.linkUrlPlaceholder")} value={link.url} onChange={(event) => updateLink(index, { url: event.target.value })} />
              <div className="flex justify-end gap-1">
                <button type="button" disabled={!admin || index === 0} title={t("settings.system.moveUp")} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700" onClick={() => moveLink(index, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={!admin || index === form.commonLinks.length - 1} title={t("settings.system.moveDown")} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700" onClick={() => moveLink(index, 1)}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" disabled={!admin} title={t("settings.system.deleteLink")} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20" onClick={() => removeLink(index)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {!form.commonLinks.length && <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400 dark:border-gray-700">{t("settings.system.noCommonLinks")}</div>}
        </div>
      </section>

      <section className="card mb-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" />{t("settings.system.enterpriseSystems")}</h3>
            <p className="mt-1 text-xs text-gray-500">{t("settings.system.enterpriseSystemsDesc")}</p>
          </div>
          <button type="button" disabled={!admin || form.enterpriseSystems.length >= 50} className="btn-secondary flex items-center gap-1.5 text-sm" onClick={addEnterpriseSystem}>
            <Plus className="h-4 w-4" />{t("settings.system.addEnterpriseSystem")}
          </button>
        </div>
        <div className="space-y-3">
          {form.enterpriseSystems.map((sys, index) => (
            <div key={`enterprise-sys-${index}`} className="grid gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-[1fr_1fr_1.5fr_2fr_auto] md:items-center">
              <input disabled={!admin} maxLength={50} className="input-field" placeholder={t("settings.system.systemCategoryPlaceholder")} value={sys.category} onChange={(event) => updateEnterpriseSystem(index, { category: event.target.value })} />
              <input disabled={!admin} maxLength={50} className="input-field" placeholder={t("settings.system.systemAreaPlaceholder")} value={sys.area} onChange={(event) => updateEnterpriseSystem(index, { area: event.target.value })} />
              <input disabled={!admin} maxLength={80} className="input-field" placeholder={t("settings.system.systemNamePlaceholder")} value={sys.label} onChange={(event) => updateEnterpriseSystem(index, { label: event.target.value })} />
              <input disabled={!admin} type="url" className="input-field" placeholder={t("settings.system.systemUrlPlaceholder")} value={sys.url} onChange={(event) => updateEnterpriseSystem(index, { url: event.target.value })} />
              <div className="flex justify-end gap-1">
                <button type="button" disabled={!admin || index === 0} title="向上移動" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700" onClick={() => moveEnterpriseSystem(index, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={!admin || index === form.enterpriseSystems.length - 1} title="向下移動" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700" onClick={() => moveEnterpriseSystem(index, 1)}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" disabled={!admin} title="刪除連結" className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20" onClick={() => removeEnterpriseSystem(index)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {!form.enterpriseSystems.length && <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400 dark:border-gray-700">{t("settings.system.noEnterpriseSystems")}</div>}
        </div>
      </section>

      {!admin && <p className="mt-4 text-sm text-amber-600">{t("settings.system.viewOnly")}</p>}
      <button
        disabled={!admin || save.isPending || settings.isLoading || requiredValues.some((value) => !value.trim()) || invalidLinks || invalidEnterpriseSystems}
        onClick={() => save.mutate()}
        className="btn-primary flex items-center gap-2 px-6 py-2.5"
      >
        <Save className="h-4 w-4" />{save.isPending ? t("settings.system.saving") : t("settings.system.save")}
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
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${configured ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700'}`}>
      <KeyRound className={`h-5 w-5 ${configured ? 'text-emerald-600' : 'text-gray-400'}`} />
      <div><p className="font-mono text-xs">{label}</p><p className={`text-xs ${configured ? 'text-emerald-600' : 'text-gray-400'}`}>{configured ? t("settings.system.apiConfigured") : t("settings.system.apiNotConfigured")}</p></div>
      {configured && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />}
    </div>
  );
}
