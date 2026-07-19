import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import type { AdminFieldDefinition, AdminRecord } from '../../types/systemAdmin';

function valueAt(record: AdminRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => (
    value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined
  ), record);
}

function displayValue(value: unknown, field: AdminFieldDefinition): React.ReactNode {
  if (field.type === 'checkbox' || typeof value === 'boolean') {
    return value
      ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">是</span>
      : <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-300">否</span>;
  }
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined || value === '') return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return String(value);
}

interface Props {
  records: AdminRecord[];
  columns: AdminFieldDefinition[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  canEdit: boolean;
  onPageChange: (page: number) => void;
  onEdit: (record: AdminRecord) => void;
  onDelete: (record: AdminRecord) => void;
}

export default function AdminDataGrid({
  records,
  columns,
  loading,
  page,
  pageSize,
  total,
  totalPages,
  canEdit,
  onPageChange,
  onEdit,
  onDelete,
}: Props) {
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" role="grid">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
            <tr>
              {columns.map((column) => <th key={column.path} className="whitespace-nowrap px-4 py-3">{column.label}</th>)}
              <th className="sticky right-0 whitespace-nowrap bg-gray-50 px-4 py-3 text-right dark:bg-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-primary-50/30 dark:hover:bg-gray-700/40">
                {columns.map((column) => (
                  <td key={column.path} className="max-w-72 truncate px-4 py-3 text-gray-700 dark:text-gray-200" title={String(valueAt(record, column.path) ?? '')}>
                    {displayValue(valueAt(record, column.path), column)}
                  </td>
                ))}
                <td className="sticky right-0 whitespace-nowrap bg-white px-4 py-2 text-right dark:bg-gray-800">
                  <button type="button" disabled={!canEdit} className="rounded-lg p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600 disabled:opacity-30 dark:hover:bg-gray-700" title="編輯" onClick={() => onEdit(record)}><Pencil className="h-4 w-4" /></button>
                  <button type="button" disabled={!canEdit} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/20" title="刪除" onClick={() => onDelete(record)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <div className="border-t border-gray-100 py-10 text-center text-sm text-gray-400 dark:border-gray-700">資料載入中…</div>}
      {!loading && !records.length && <div className="border-t border-gray-100 py-14 text-center text-sm text-gray-400 dark:border-gray-700">沒有符合條件的資料</div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        <span>第 {start.toLocaleString()}–{end.toLocaleString()} 筆，共 {total.toLocaleString()} 筆</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1 || loading} className="rounded-lg border border-gray-200 p-1.5 hover:bg-white disabled:opacity-30 dark:border-gray-600 dark:hover:bg-gray-700" onClick={() => onPageChange(page - 1)} aria-label="上一頁"><ChevronLeft className="h-4 w-4" /></button>
          <span>第 {page} / {Math.max(totalPages, 1)} 頁</span>
          <button type="button" disabled={page >= totalPages || loading} className="rounded-lg border border-gray-200 p-1.5 hover:bg-white disabled:opacity-30 dark:border-gray-600 dark:hover:bg-gray-700" onClick={() => onPageChange(page + 1)} aria-label="下一頁"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </footer>
    </div>
  );
}
