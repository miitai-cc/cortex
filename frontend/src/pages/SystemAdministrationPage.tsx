import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from 'eiva-fe-security';
import { Database, Plus, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminDataGrid from '../components/admin/AdminDataGrid';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import { systemAdminEntities } from '../config/systemAdminEntities';
import { systemAdminApi } from '../services/api';
import type {
  AdminFieldDefinition,
  AdminRecord,
  AdminRecordPayload,
} from '../types/systemAdmin';

const PAGE_SIZE = 20;

function blankPayload(fields: AdminFieldDefinition[]): AdminRecordPayload {
  const payload: AdminRecordPayload = { key: '', name: '', description: '', data: {}, isActive: true, sortOrder: 0 };
  for (const field of fields) {
    if (field.type === 'select' && field.options?.length) setAt(payload, field.path, field.options[0].value);
    if (field.type === 'checkbox' && valueAt(payload, field.path) === undefined) setAt(payload, field.path, false);
  }
  payload.isActive = true;
  return payload;
}

function fromRecord(record: AdminRecord): AdminRecordPayload {
  return {
    key: record.key,
    name: record.name,
    description: record.description ?? '',
    data: structuredClone(record.data ?? {}),
    isActive: record.isActive,
    sortOrder: record.sortOrder,
  };
}

function valueAt(source: object, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => (
    value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined
  ), source);
}

function setAt(source: AdminRecordPayload, path: string, value: unknown): AdminRecordPayload {
  const copy = structuredClone(source);
  const parts = path.split('.');
  let target = copy as unknown as Record<string, unknown>;
  parts.slice(0, -1).forEach((part) => {
    if (!target[part] || typeof target[part] !== 'object') target[part] = {};
    target = target[part] as Record<string, unknown>;
  });
  target[parts[parts.length - 1]] = value;
  return copy;
}

function errorMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { error?: string } }; message?: string };
  return candidate.response?.data?.error || candidate.message || fallback;
}

export default function SystemAdministrationPage() {
  const { section = '' } = useParams();
  const baseDefinition = systemAdminEntities[section];
  const user = useAuthStore((state) => state.user);
  const account = user as typeof user & { role?: string };
  const admin = (user?.roles?.includes('admin') ?? false) || account?.role === 'admin';
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminRecord | null | undefined>();
  const [form, setForm] = useState<AdminRecordPayload>({ key: '', name: '', data: {}, isActive: true, sortOrder: 0 });
  const roleLookup = useQuery({
    queryKey: ['system-admin-lookup', 'roles'],
    queryFn: () => systemAdminApi.list('roles', { page: 1, pageSize: 100 }),
    enabled: section === 'users' && admin,
  });
  const departmentLookup = useQuery({
    queryKey: ['system-admin-lookup', 'departments'],
    queryFn: () => systemAdminApi.list('departments', { page: 1, pageSize: 100 }),
    enabled: section === 'users' && admin,
  });
  const definition = useMemo(() => {
    if (!baseDefinition || section !== 'users') return baseDefinition;
    const roleOptions = roleLookup.data?.data.records.map((record) => ({ value: record.key, label: record.name })) ?? [];
    const departmentOptions = departmentLookup.data?.data.records.map((record) => ({ value: record.key, label: record.name })) ?? [];
    return {
      ...baseDefinition,
      fields: baseDefinition.fields.map((field) => {
        if (field.path === 'data.role' && roleOptions.length) return { ...field, options: roleOptions };
        if (field.path === 'data.departmentKey' && departmentOptions.length) {
          return { ...field, type: 'select' as const, options: [{ value: '', label: '未指定部門' }, ...departmentOptions] };
        }
        return field;
      }),
    };
  }, [baseDefinition, departmentLookup.data?.data.records, roleLookup.data?.data.records, section]);

  useEffect(() => setPage(1), [deferredSearch, section]);
  const query = useQuery({
    queryKey: ['system-admin', definition?.entity, page, deferredSearch],
    queryFn: () => systemAdminApi.list(definition.entity, { page, pageSize: PAGE_SIZE, search: deferredSearch }),
    enabled: !!definition && admin,
    placeholderData: (previous) => previous,
  });
  const model = query.data?.data;
  const columns = useMemo(() => definition?.fields.filter((field) => field.grid) ?? [], [definition]);

  if (!definition) return <Navigate to="/cortex/settings/system" replace />;

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['system-admin', definition.entity] }),
      client.invalidateQueries({ queryKey: ['system-context'] }),
    ]);
  };
  const save = useMutation({
    mutationFn: () => editing
      ? systemAdminApi.update(definition.entity, editing.id, form)
      : systemAdminApi.create(definition.entity, form),
    onSuccess: async () => {
      toast.success(`${definition.itemName}已${editing ? '更新' : '新增'}`);
      setEditing(undefined);
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error, `${definition.itemName}儲存失敗`)),
  });
  const remove = useMutation({
    mutationFn: (record: AdminRecord) => systemAdminApi.delete(definition.entity, record.id),
    onSuccess: async () => {
      toast.success(`${definition.itemName}已刪除`);
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error, `${definition.itemName}刪除失敗`)),
  });
  const openCreate = () => {
    setForm(blankPayload(definition.fields));
    setEditing(null);
  };
  const openEdit = (record: AdminRecord) => {
    const payload = fromRecord(record);
    if (definition.entity === 'users') payload.data.password = '';
    setForm(payload);
    setEditing(record);
  };
  const submit = () => {
    const missing = definition.fields.some((field) => {
      if (!field.required) return false;
      const value = valueAt(form, field.path);
      return value === undefined || value === null || String(value).trim() === '';
    });
    if (missing || (!editing && definition.entity === 'users' && String(form.data.password ?? '').length < 8)) {
      toast.error('請填寫所有必填欄位；新使用者密碼至少 8 字');
      return;
    }
    save.mutate();
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-10">
      <CommonHeroTitle icon={Database} title={definition.title} description={definition.description} />
      {!admin && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <ShieldAlert className="h-5 w-5" />目前帳號沒有系統設定管理權限。
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1 lg:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input className="input-field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`即時搜尋所有${definition.itemName}欄位…`} />
        </label>
        <button type="button" className="btn-secondary flex items-center gap-2" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />重新整理</button>
        <button type="button" className="btn-primary flex items-center gap-2" disabled={!admin} onClick={openCreate}><Plus className="h-4 w-4" />新增{definition.itemName}</button>
      </div>
      <AdminDataGrid
        records={model?.records ?? []}
        columns={columns}
        loading={query.isLoading}
        page={model?.page ?? page}
        pageSize={model?.pageSize ?? PAGE_SIZE}
        total={model?.total ?? 0}
        totalPages={model?.totalPages ?? 1}
        canEdit={admin}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={(record) => {
          if (window.confirm(`確定刪除「${record.name}」？此操作無法復原。`)) remove.mutate(record);
        }}
      />
      {editing !== undefined && (
        <EditorDialog
          title={`${editing ? '編輯' : '新增'}${definition.itemName}`}
          fields={definition.fields}
          form={form}
          editing={!!editing}
          saving={save.isPending}
          onChange={(path, value) => setForm((current) => setAt(current, path, value))}
          onClose={() => setEditing(undefined)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function EditorDialog({ title, fields, form, editing, saving, onChange, onClose, onSubmit }: {
  title: string;
  fields: AdminFieldDefinition[];
  form: AdminRecordPayload;
  editing: boolean;
  saving: boolean;
  onChange: (path: string, value: unknown) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"><h2 className="text-lg font-semibold">{title}</h2><button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={onClose}><X className="h-5 w-5" /></button></header>
        <div className="grid flex-1 gap-4 overflow-auto p-6 md:grid-cols-2">
          {fields.map((field) => (
            <DynamicField key={field.path} field={field} value={valueAt(form, field.path)} editing={editing} onChange={(value) => onChange(field.path, value)} />
          ))}
        </div>
        <footer className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700"><button type="button" className="btn-secondary" onClick={onClose}>取消</button><button type="button" className="btn-primary" disabled={saving} onClick={onSubmit}>{saving ? '儲存中…' : '儲存'}</button></footer>
      </section>
    </div>
  );
}

function DynamicField({ field, value, editing, onChange }: { field: AdminFieldDefinition; value: unknown; editing: boolean; onChange: (value: unknown) => void }) {
  const inputClass = 'input-field mt-1 w-full';
  const shownValue = value ?? '';
  if (field.type === 'checkbox') {
    return <label className="flex items-center gap-2 self-end rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-600"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />{field.label}</label>;
  }
  return (
    <label className={`${field.type === 'textarea' ? 'md:col-span-2' : ''} block text-sm font-medium text-gray-700 dark:text-gray-200`}>
      {field.label}{field.required && <span className="ml-1 text-red-500">*</span>}
      {field.type === 'textarea' ? (
        <textarea className={`${inputClass} min-h-24`} value={String(shownValue)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : field.type === 'select' ? (
        <select className={inputClass} value={String(shownValue)} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      ) : (
        <input
          className={inputClass}
          type={field.type === 'tags' ? 'text' : field.type ?? 'text'}
          value={field.type === 'tags' && Array.isArray(value) ? value.join(', ') : String(shownValue)}
          placeholder={field.type === 'password' && editing ? '留空表示不變更' : field.placeholder}
          onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : field.type === 'tags' ? event.target.value.split(',').map((item) => item.trim()).filter(Boolean) : event.target.value)}
        />
      )}
      {field.help && <span className="mt-1 block text-xs font-normal text-gray-400">{field.help}</span>}
    </label>
  );
}
