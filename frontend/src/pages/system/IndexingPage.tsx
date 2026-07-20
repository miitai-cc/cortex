import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderSearch, GitBranch, Share2,
  CheckCircle2, XCircle, Loader2, Terminal, Trash2, Square, Play,
} from 'lucide-react';
import { indexingApi } from '../../services/api';
import { openIndexingStream, type IndexEvent, type EventType } from '../../grpc/indexingWsClient';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type JobStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

interface LogEntry {
  id: number;
  type: EventType;
  message: string;
  ts: string;
}

interface JobState {
  status: JobStatus;
  fullPath: string;
  logs: LogEntry[];
}

const EMPTY_JOB: JobState = { status: 'idle', fullPath: '', logs: [] };

let logSeq = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Hook: manages a single gRPC-over-WebSocket stream
// ─────────────────────────────────────────────────────────────────────────────
function useIndexingStream(wsUrlFactory: (path: string) => string) {
  const [job, setJob] = useState<JobState>(EMPTY_JOB);
  const cleanupRef = useRef<(() => void) | null>(null);

  const start = useCallback((relPath: string) => {
    // Cancel any ongoing stream
    cleanupRef.current?.();

    setJob({ status: 'connecting', fullPath: '', logs: [] });
    logSeq = 0;

    const wsUrl = wsUrlFactory(relPath);

    const cleanup = openIndexingStream(wsUrl, {
      onEvent: (event: IndexEvent) => {
        const entry: LogEntry = {
          id: ++logSeq,
          type: event.type,
          message: event.message,
          ts: new Date().toLocaleTimeString('zh-TW', { hour12: false }),
        };
        setJob((prev) => ({
          ...prev,
          fullPath: event.full_path || prev.fullPath,
          status:
            event.type === 'COMPLETE' ? 'complete'
              : event.type === 'ERROR' ? 'error'
              : prev.status === 'connecting' ? 'streaming' : prev.status,
          logs: [...prev.logs, entry],
        }));
      },
      onError: () => {
        setJob((prev) => ({
          ...prev,
          status: 'error',
          logs: [
            ...prev.logs,
            { id: ++logSeq, type: 'ERROR', message: 'WebSocket 連線失敗', ts: '' },
          ],
        }));
      },
    });

    cleanupRef.current = cleanup;
  }, [wsUrlFactory]);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setJob(EMPTY_JOB);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  return { job, start, reset };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status, runningLabel }: { status: JobStatus; runningLabel?: string }) {
  const { t } = useTranslation();
  if (status === 'idle') return null;
  const map: Record<string, { icon: any; cls: string; label: string }> = {
    connecting: { icon: Loader2, cls: 'text-blue-500 animate-spin',   label: t('indexing.connecting') },
    streaming:  { icon: Loader2, cls: 'text-violet-500 animate-spin', label: runningLabel ?? t('indexing.indexing') },
    complete:   { icon: CheckCircle2, cls: 'text-emerald-500',        label: t('indexing.complete') },
    error:      { icon: XCircle,      cls: 'text-red-500',            label: t('indexing.failed') },
  };
  const { icon: Icon, cls, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function LogPanel({ logs, status, onClear }: {
  logs: LogEntry[];
  status: JobStatus;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  if (status === 'idle' && logs.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{t('indexing.streamOutput')}</span>
        </div>
        <button
          onClick={onClear}
          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title={t('indexing.clear')}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {/* Log lines */}
      <div className="bg-gray-950 dark:bg-gray-950 p-3 h-52 overflow-y-auto font-mono text-xs leading-5">
        {logs.map((entry) => (
          <div
            key={entry.id}
            className={
              entry.type === 'ERROR'    ? 'text-red-400' :
              entry.type === 'COMPLETE' ? 'text-emerald-400 font-semibold' :
              'text-gray-300'
            }
          >
            {entry.ts && <span className="text-gray-600 mr-2">{entry.ts}</span>}
            {entry.message}
          </div>
        ))}
        {(status === 'connecting' || status === 'streaming') && (
          <div className="flex items-center gap-1.5 text-gray-500 mt-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="animate-pulse">{t('indexing.waitingOutput')}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function IndexCard({
  icon: Icon,
  iconCls,
  btnCls,
  title,
  description,
  btnId,
  btnLabel,
  runningLabel,
  job,
  disabled,
  onStart,
  onClear,
  isLongRunning,
}: {
  icon: any; iconCls: string; btnCls: string;
  title: string; description: string;
  btnId: string; btnLabel: string;
  runningLabel?: string;
  job: JobState; disabled: boolean;
  onStart: () => void; onClear: () => void;
  isLongRunning?: boolean;
}) {
  const { t } = useTranslation();
  const running = job.status === 'connecting' || job.status === 'streaming';

  return (
    <div className="card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 shrink-0 ${iconCls}`} />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <StatusBadge status={job.status} runningLabel={isLongRunning && running ? '執行中…' : undefined} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          id={btnId}
          disabled={disabled || running}
          onClick={onStart}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            disabled || running
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : `${btnCls} text-white shadow-sm hover:shadow-md active:scale-95`
          }`}
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
          {running ? (runningLabel ?? t('indexing.indexing')) : btnLabel}
        </button>
        {/* Stop button — only for long-running processes */}
        {isLongRunning && running && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            title={t('indexing.stop')}
          >
            <Square className="w-4 h-4" />
            {t('indexing.stop')}
          </button>
        )}
      </div>

      {/* Full path */}
      {job.fullPath && (
        <p className="text-xs text-gray-400 dark:text-gray-500 break-all">
          {t('indexing.path')}<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{job.fullPath}</code>
        </p>
      )}

      {/* Live streaming log */}
      <LogPanel logs={job.logs} status={job.status} onClear={onClear} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function IndexingPage() {
  const { t } = useTranslation();
  const [relPath, setRelPath] = useState('');

  const gitNexusIndex  = useIndexingStream(indexingApi.gitNexusWsUrl);
  const graphifyIndex  = useIndexingStream(indexingApi.graphifyWsUrl);
  // 啟始：serve needs no path; extract needs a path
  const gitNexusServe  = useIndexingStream(() => indexingApi.gitNexusServeWsUrl());
  const graphifyExtract = useIndexingStream(indexingApi.graphifyExtractWsUrl);

  const anyRunning = [
    gitNexusIndex, graphifyIndex, gitNexusServe, graphifyExtract,
  ].some((j) => j.job.status === 'connecting' || j.job.status === 'streaming');

  const canStart = relPath.trim().length > 0;

  const handlePathChange = (v: string) => {
    setRelPath(v);
    // Reset jobs when path changes
    [gitNexusIndex, graphifyIndex, graphifyExtract].forEach((j) => {
      if (j.job.status !== 'idle') j.reset();
    });
  };

  const sectionDivider = (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
    </div>
  );

  return (
    <div>
      <CommonHeroTitle icon={FolderSearch} title={t('indexing.title')} />

      {/* Path input */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('indexing.relPathLabel')}
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          {t('indexing.relPathHelp')}
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded ml-1">projects/my-repo</code>
        </p>
        <div className="relative">
          <FolderSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            id="indexing-rel-path"
            type="text"
            className="input-field pl-10"
            placeholder={t('indexing.pathPlaceholder')}
            value={relPath}
            onChange={(e) => handlePathChange(e.target.value)}
            disabled={anyRunning}
          />
        </div>
        {relPath.trim() && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {t('indexing.fullPath')}<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">$WORK_ROOT / {relPath.trim().replace(/^\/+/, '')}</code>
          </p>
        )}
      </div>

      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
        {t('indexing.buildIndexHeader')}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <IndexCard
          icon={GitBranch}
          iconCls="text-violet-500 dark:text-violet-400"
          btnCls="bg-violet-600 hover:bg-violet-700"
          title={t('indexing.gitNexusBuild')}
          description={t('indexing.gitNexusBuildDesc')}
          btnId="btn-gitnexus-index"
          btnLabel={t('indexing.gitNexusBuild')}
          job={gitNexusIndex.job}
          disabled={!canStart}
          onStart={() => gitNexusIndex.start(relPath.trim())}
          onClear={gitNexusIndex.reset}
        />
        <IndexCard
          icon={Share2}
          iconCls="text-emerald-500 dark:text-emerald-400"
          btnCls="bg-emerald-600 hover:bg-emerald-700"
          title={t('indexing.graphifyBuild')}
          description={t('indexing.graphifyBuildDesc')}
          btnId="btn-graphify-index"
          btnLabel={t('indexing.graphifyBuild')}
          job={graphifyIndex.job}
          disabled={!canStart}
          onStart={() => graphifyIndex.start(relPath.trim())}
          onClear={graphifyIndex.reset}
        />
      </div>

      {sectionDivider}

      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
        {t('indexing.startToolsHeader')}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IndexCard
          icon={Play}
          iconCls="text-violet-400 dark:text-violet-300"
          btnCls="bg-violet-500 hover:bg-violet-600"
          title={t('indexing.startGitNexus')}
          description={t('indexing.startGitNexusDesc')}
          btnId="btn-gitnexus-serve"
          btnLabel={t('indexing.startGitNexus')}
          runningLabel={t('indexing.running')}
          job={gitNexusServe.job}
          disabled={false}
          onStart={() => gitNexusServe.start('')}
          onClear={gitNexusServe.reset}
          isLongRunning
        />
        <IndexCard
          icon={Play}
          iconCls="text-emerald-400 dark:text-emerald-300"
          btnCls="bg-emerald-500 hover:bg-emerald-600"
          title={t('indexing.startGraphify')}
          description={t('indexing.startGraphifyDesc')}
          btnId="btn-graphify-extract"
          btnLabel={t('indexing.startGraphify')}
          runningLabel={t('indexing.extracting')}
          job={graphifyExtract.job}
          disabled={!canStart}
          onStart={() => graphifyExtract.start(relPath.trim())}
          onClear={graphifyExtract.reset}
          isLongRunning
        />
      </div>
    </div>
  );
}
