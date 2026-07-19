import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Filter,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import {
  departmentConfigBySlug,
  departmentConfigs,
  type DepartmentConfig,
  type DepartmentSlug,
} from '../../config/departments';
import {
  departmentApi,
  type DepartmentItem,
  type DepartmentItemPayload,
  type DepartmentItemPriority,
  type DepartmentItemStatus,
} from '../../services/api';

const statuses: Array<{ value: DepartmentItemStatus; labelKey: string }> = [
  { value: 'planned', labelKey: 'dept.status.planned' },
  { value: 'active', labelKey: 'dept.status.active' },
  { value: 'pending_review', labelKey: 'dept.status.pending_review' },
  { value: 'blocked', labelKey: 'dept.status.blocked' },
  { value: 'completed', labelKey: 'dept.status.completed' },
  { value: 'archived', labelKey: 'dept.status.archived' },
];

const priorities: Array<{ value: DepartmentItemPriority; labelKey: string }> = [
  { value: 'low', labelKey: 'dept.priority.low' },
  { value: 'medium', labelKey: 'dept.priority.medium' },
  { value: 'high', labelKey: 'dept.priority.high' },
  { value: 'critical', labelKey: 'dept.priority.critical' },
];

const statusStyles: Record<DepartmentItemStatus, string> = {
  planned: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  pending_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const priorityStyles: Record<DepartmentItemPriority, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600 dark:text-blue-400',
  high: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
};

const defaultForm = (config: DepartmentConfig): DepartmentItemPayload => ({
  itemType: config.itemTypes[0].value,
  title: '',
  description: '',
  status: 'planned',
  priority: 'medium',
  ownerName: '',
  dueDate: '',
  amount: undefined,
  metadata: {},
});

function errorMessage(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
  return candidate.response?.data?.error
    ?? candidate.response?.data?.message
    ?? candidate.message
    ?? fallback;
}

function statusLabel(value: DepartmentItemStatus) {
  return statuses.find((status) => status.value === value)?.labelKey ?? value;
}

function priorityLabel(value: DepartmentItemPriority) {
  return priorities.find((priority) => priority.value === value)?.labelKey ?? value;
}

function formatDate(value?: string) {
  if (!value) return '未設定期限';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-TW');
}

function formatAmount(value?: number) {
  if (value == null) return '—';
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DepartmentPortalPage() {
  const { department = '' } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const queryClient = useQueryClient();
  const isDepartment = department in departmentConfigBySlug;
  const config = isDepartment
    ? departmentConfigBySlug[department as DepartmentSlug]
    : departmentConfigs[0];
  const queryKey = ['department-overview', department];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DepartmentItemStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState<DepartmentItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DepartmentItemPayload>(() => defaultForm(config));

  useEffect(() => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setEditing(null);
    setFormOpen(false);
    setForm(defaultForm(config));
  }, [config]);

  const overviewQuery = useQuery({
    queryKey,
    queryFn: () => departmentApi.overview(department),
    enabled: isDepartment,
  });
  const model = overviewQuery.data?.data;
  const isEnglish = i18n.language.toLowerCase().startsWith('en');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (model?.items ?? []).filter((item) => {
      const matchesQuery = !query
        || item.title.toLocaleLowerCase().includes(query)
        || (item.description ?? '').toLocaleLowerCase().includes(query)
        || (item.ownerName ?? '').toLocaleLowerCase().includes(query);
      return matchesQuery
        && (statusFilter === 'all' || item.status === statusFilter)
        && (typeFilter === 'all' || item.itemType === typeFilter);
    });
  }, [model?.items, search, statusFilter, typeFilter]);

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const saveMutation = useMutation({
    mutationFn: (payload: DepartmentItemPayload) => editing
      ? departmentApi.updateItem(department, editing.id, payload)
      : departmentApi.createItem(department, payload),
    onSuccess: () => {
      toast.success(editing ? '工作項目已更新' : '工作項目已建立');
      setFormOpen(false);
      setEditing(null);
      setForm(defaultForm(config));
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, '儲存失敗')),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentApi.deleteItem(department, id),
    onSuccess: () => {
      toast.success('工作項目已刪除');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, '刪除失敗')),
  });

  if (!isDepartment) {
    return <Navigate to="/cortex/departments/ceo" replace />;
  }

  const openCreate = (itemType?: string) => {
    setEditing(null);
    setForm({ ...defaultForm(config), itemType: itemType ?? config.itemTypes[0].value });
    setFormOpen(true);
  };

  const openEdit = (item: DepartmentItem) => {
    setEditing(item);
    setForm({
      itemType: item.itemType,
      title: item.title,
      description: item.description ?? '',
      status: item.status,
      priority: item.priority,
      ownerName: item.ownerName ?? '',
      amount: item.amount,
      dueDate: item.dueDate ?? '',
      metadata: item.metadata ?? {},
    });
    setFormOpen(true);
  };

  const removeItem = (item: DepartmentItem) => {
    if (window.confirm(`確定刪除「${item.title}」？此動作無法復原。`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error('請輸入標題');
      return;
    }
    saveMutation.mutate({
      ...form,
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      ownerName: form.ownerName?.trim() || undefined,
      dueDate: form.dueDate || undefined,
      amount: config.supportsAmount ? form.amount : undefined,
    });
  };

  const stats = model?.stats ?? {
    total: 0,
    active: 0,
    completed: 0,
    blocked: 0,
    highPriority: 0,
    overdue: 0,
    amountTotal: 0,
  };
  const metrics = [
    { label: '全部項目', value: stats.total, icon: ListChecks, color: 'text-slate-600' },
    { label: '進行／待審', value: stats.active, icon: RefreshCw, color: 'text-blue-600' },
    { labelKey: 'dept.status.completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600' },
    { labelKey: 'dept.status.blocked', value: stats.blocked, icon: AlertCircle, color: 'text-red-600' },
    { label: '高優先', value: stats.highPriority, icon: AlertTriangle, color: 'text-orange-600' },
    { label: '已逾期', value: stats.overdue, icon: CalendarClock, color: 'text-rose-600' },
  ];

  return (
    <div className="mx-auto max-w-11xl px-4 pb-12">
      <CommonHeroTitle
        icon={config.icon}
        title={isEnglish ? config.titleEn : config.title}
        description={isEnglish ? config.descriptionEn : config.description}
        breadcrumb={['部門專區', config.focus]}
        extraButtons={[
          { label: '重新整理', icon: RefreshCw, onClick: () => overviewQuery.refetch() },
          { label: '新增項目', icon: Plus, onClick: () => openCreate() },
        ]}
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="card flex items-center gap-3">
            <span className={`rounded-lg bg-gray-50 p-2.5 dark:bg-gray-700 ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
          </article>
        ))}
      </section>

      {config.supportsAmount && (
        <section className={`mb-6 flex items-center gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700 ${config.accentSoft}`}>
          <CircleDollarSign className={`h-7 w-7 ${config.accent}`} />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">目前項目金額合計</p>
            <p className={`text-xl font-bold ${config.accent}`}>{formatAmount(stats.amountTotal)}</p>
          </div>
          <p className="ml-auto hidden max-w-lg text-right text-xs text-gray-500 md:block">
            金額為工作管理用彙總；正式財務數字仍應以核准後的會計或 ERP 資料為準。
          </p>
        </section>
      )}

      <section className="card mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">專區功能模組</h2>
            <p className="text-xs text-gray-500">依部門職責規劃；點選模組可篩選，再按新增建立該類項目。</p>
          </div>
          {typeFilter !== 'all' && (
            <button className="btn-secondary text-sm" onClick={() => setTypeFilter('all')}>{t('dept.filters.all')}</button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {config.itemTypes.map((itemType) => {
            const count = model?.items.filter((item) => item.itemType === itemType.value).length ?? 0;
            const selected = typeFilter === itemType.value;
            return (
              <article
                key={itemType.value}
                className={`rounded-xl border p-4 transition ${selected ? 'border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/40' : 'border-gray-200 hover:border-primary-300 dark:border-gray-700'}`}
              >
                <button 
                  className="w-full text-left" 
                  onClick={() => {
                    if (itemType.linkTo) {
                      navigate(itemType.linkTo);
                    } else {
                      setTypeFilter(selected ? 'all' : itemType.value);
                    }
                  }}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {isEnglish ? itemType.labelEn : itemType.label}
                    </h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${config.accentSoft} ${config.accent}`}>{count}</span>
                  </div>
                  <p className="min-h-10 text-xs leading-5 text-gray-500 dark:text-gray-400">{itemType.description}</p>
                </button>
                <button className={`mt-3 flex items-center gap-1 text-xs font-medium ${config.accent}`} onClick={() => openCreate(itemType.value)}>
                  <Plus className="h-3.5 w-3.5" />新增{itemType.label}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="input-field w-full pl-9"
              placeholder="搜尋標題、內容或負責人…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select className="input-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DepartmentItemStatus | 'all')}>
              <option value="all">全部狀態</option>
              {statuses.map((status) => <option key={status.value} value={status.value}>{t(status.labelKey)}</option>)}
            </select>
            <select className="input-field" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">全部類型</option>
              {config.itemTypes.map((itemType) => <option key={itemType.value} value={itemType.value}>{itemType.label}</option>)}
            </select>
          </div>
          <button className="btn-primary flex items-center justify-center gap-2" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />新增工作項目
          </button>
        </div>

        {overviewQuery.isLoading && (
          <div className="flex min-h-52 items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />載入專區資料…
          </div>
        )}
        {overviewQuery.isError && (
          <div className="flex min-h-52 flex-col items-center justify-center text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
            <p className="font-medium text-red-600">無法載入部門資料</p>
            <p className="mt-1 max-w-lg text-sm text-gray-500">{errorMessage(overviewQuery.error, '請確認後端服務與資料庫遷移已完成。')}</p>
            <button className="btn-secondary mt-4" onClick={() => overviewQuery.refetch()}>{t('dept.action.retry')}</button>
          </div>
        )}
        {!overviewQuery.isLoading && !overviewQuery.isError && (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const itemType = config.itemTypes.find((candidate) => candidate.value === item.itemType);
              return (
                <article key={item.id} className="rounded-xl border border-gray-200 p-4 transition hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${config.accentSoft} ${config.accent}`}>{itemType?.label ?? item.itemType}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[item.status]}`}>{t(`dept.status.${item.status}`)}</span>
                        <span className={`text-xs font-semibold ${priorityStyles[item.priority]}`}>{t(`dept.priority.${item.priority}`)}{t('dept.item.prioritySuffix')}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                      {item.description && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{item.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{t('dept.item.owner')}{item.ownerName || t('dept.item.unassigned')}</span>
                        <span>{t('dept.item.dueDate')}{formatDate(item.dueDate)}</span>
                        {config.supportsAmount && <span>{t('dept.item.amount')}{formatAmount(item.amount)}</span>}
                        {item.updatedAt && <span>{t('dept.item.updated')}{new Date(item.updatedAt).toLocaleString('zh-TW')}</span>}
                      </div>
                    </div>
                    {item.canEdit && (
                      <div className="flex shrink-0 gap-1 self-end md:self-start">
                        <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-gray-700" title={t("dept.action.editBtn")} onClick={() => openEdit(item)}>
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title={t("dept.action.deleteBtn")} onClick={() => removeItem(item)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            {!filteredItems.length && (
              <div className="py-14 text-center text-sm text-gray-500">
                <config.icon className={`mx-auto mb-3 h-9 w-9 ${config.accent}`} />
                <p className="font-medium text-gray-700 dark:text-gray-200">{t('dept.empty.title')}</p>
                <p className="mt-1">{t('dept.empty.desc')}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={editing ? t('dept.action.edit') : t('dept.action.new')}>
          <form className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-800" onSubmit={submit}>
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? t('dept.action.edit') : t('dept.action.new')}</h2>
                <p className="mt-1 text-xs text-gray-500">{isEn && config.titleEn ? config.titleEn : config.title} · {config.focus} {/* TODO: Add focus translation if needed */}</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setFormOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                項目類型
                <select className="input-field mt-1 w-full" value={form.itemType} onChange={(event) => setForm({ ...form, itemType: event.target.value })}>
                  {config.itemTypes.map((itemType) => <option key={itemType.value} value={itemType.value}>{itemType.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                負責人
                <input className="input-field mt-1 w-full" maxLength={120} placeholder={t("dept.form.ownerPlaceholder")} value={form.ownerName ?? ''} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 md:col-span-2">
                標題 <span className="text-red-500">*</span>
                <input autoFocus required className="input-field mt-1 w-full" maxLength={200} placeholder={t("dept.form.titlePlaceholder")} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 md:col-span-2">
                說明
                <textarea className="input-field mt-1 min-h-28 w-full resize-y" maxLength={5000} placeholder={t("dept.form.descPlaceholder")} value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                狀態
                <select className="input-field mt-1 w-full" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DepartmentItemStatus })}>
                  {statuses.map((status) => <option key={status.value} value={status.value}>{t(status.labelKey)}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                優先級
                <select className="input-field mt-1 w-full" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as DepartmentItemPriority })}>
                  {priorities.map((priority) => <option key={priority.value} value={priority.value}>{t(priority.labelKey)}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                完成期限
                <input type="date" className="input-field mt-1 w-full" value={form.dueDate ?? ''} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
              </label>
              {config.supportsAmount && (
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  金額（TWD）
                  <input type="number" min="0" step="1" className="input-field mt-1 w-full" placeholder="0" value={form.amount ?? ''} onChange={(event) => setForm({ ...form, amount: event.target.value === '' ? undefined : Number(event.target.value) })} />
                </label>
              )}
            </div>
            <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
              <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>{t('dept.action.cancel')}</button>
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? t('dept.action.save') : t('dept.action.create')}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

