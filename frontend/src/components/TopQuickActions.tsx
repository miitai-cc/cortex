import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from 'eiva-fe-security';
import {
  Bot,
  CircleHelp,
  Loader2,
  MessagesSquare,
  Play,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { codexApi } from '../services/api';
import {
  openCodexPromptStream,
  type CodexPromptEvent,
  type CodexPromptStream,
} from '../grpc/codexWsClient';
import zhTwGuide from '../docs/user-guide.zh-TW.md?raw';
import enGuide from '../docs/user-guide.en.md?raw';

type OpenPanel = 'codex' | 'help' | null;
type GuideLanguage = 'zh-TW' | 'en';
type PromptLog = CodexPromptEvent & { id: number; timestamp: string };

const eventStyle: Record<CodexPromptEvent['type'], string> = {
  CONNECTED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  STARTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PROGRESS: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  COMPLETE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  CANCELLED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

export default function TopQuickActions() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const account = user as typeof user & { role?: string };
  const admin = (user?.roles?.includes('admin') ?? false) || account?.role === 'admin';
  const [panel, setPanel] = useState<OpenPanel>(null);
  const [guideLanguage, setGuideLanguage] = useState<GuideLanguage>(
    i18n.language.toLowerCase().startsWith('en') ? 'en' : 'zh-TW',
  );
  const [prompt, setPrompt] = useState('');
  const [logs, setLogs] = useState<PromptLog[]>([]);
  const [running, setRunning] = useState(false);
  const streamRef = useRef<CodexPromptStream | null>(null);
  const logSequence = useRef(0);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => streamRef.current?.disconnect(), []);
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  const appendEvent = (event: CodexPromptEvent) => {
    setLogs((current) => [
      ...current.slice(-999),
      {
        ...event,
        id: ++logSequence.current,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    if (event.type === 'COMPLETE' || event.type === 'ERROR' || event.type === 'CANCELLED') {
      setRunning(false);
      streamRef.current = null;
    }
  };

  const runPrompt = () => {
    const value = prompt.trim();
    if (!value || !token || running || !admin) return;
    setLogs([]);
    logSequence.current = 0;
    setRunning(true);
    streamRef.current = openCodexPromptStream(codexApi.websocketUrl(token), value, {
      onEvent: appendEvent,
      onError: (message) => {
        appendEvent({ type: 'ERROR', jobId: '', message });
        setRunning(false);
        streamRef.current = null;
      },
    });
  };

  const cancelPrompt = () => {
    streamRef.current?.cancel();
  };

  const closePanel = () => {
    if (panel === 'codex' && running) {
      if (!window.confirm(t('quick.codex.closeConfirm'))) return;
      streamRef.current?.disconnect();
      streamRef.current = null;
      setRunning(false);
    }
    setPanel(null);
  };

  return (
    <>
      <QuickButton icon={Bot} label={t('quick.codex.title')} onClick={() => setPanel('codex')} />

      <QuickButton
        icon={MessagesSquare}
        label={t('quick.communication')}
        onClick={() => navigate('/cortex/collaboration/channels')}
      />

      {panel === 'codex' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={t('quick.codex.title')}>
          <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
            <header className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-primary-50 p-2.5 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300"><Bot className="h-5 w-5" /></span>
                <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('quick.codex.title')}</h2><p className="mt-1 text-xs text-gray-500">{t('quick.codex.description')}</p></div>
              </div>
              <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={closePanel}><X className="h-5 w-5" /></button>
            </header>
            <div className="grid min-h-0 flex-1 gap-5 overflow-auto p-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('quick.codex.prompt')}
                  <textarea
                    autoFocus
                    className="input-field mt-2 min-h-52 resize-y font-mono text-sm"
                    maxLength={20_000}
                    disabled={running || !admin}
                    placeholder={t('quick.codex.placeholder')}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                </label>
                <div className="flex items-center justify-between text-xs text-gray-400"><span>{t('quick.codex.workspaceNotice')}</span><span>{prompt.length.toLocaleString()} / 20,000</span></div>
                {!admin && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">{t('quick.codex.adminOnly')}</div>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary flex items-center gap-2" disabled={!admin || !token || running || !prompt.trim()} onClick={runPrompt}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? t('quick.codex.running') : t('quick.codex.run')}
                  </button>
                  <button type="button" className="btn-secondary flex items-center gap-2" disabled={!running} onClick={cancelPrompt}><Square className="h-4 w-4" />{t('quick.codex.cancel')}</button>
                  <button type="button" className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-700" disabled={running || !logs.length} onClick={() => setLogs([])}><Trash2 className="mr-1 inline h-4 w-4" />{t('quick.codex.clear')}</button>
                </div>
              </div>
              <div className="flex min-h-80 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-950 dark:border-gray-700">
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2 text-xs text-gray-400"><span>{t('quick.codex.output')}</span><span>{running ? t('quick.codex.streaming') : t('quick.codex.idle')}</span></div>
                <div ref={outputRef} className="min-h-0 flex-1 space-y-2 overflow-auto p-4 font-mono text-xs leading-5 text-gray-200">
                  {!logs.length && <div className="flex h-full min-h-56 items-center justify-center text-gray-500">{t('quick.codex.noOutput')}</div>}
                  {logs.map((log) => (
                    <div key={log.id} className="grid grid-cols-[auto_auto_1fr] items-start gap-2">
                      <span className="text-gray-600">{log.timestamp}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${eventStyle[log.type]}`}>{log.stream ?? log.type}</span>
                      <span className={`whitespace-pre-wrap break-words ${log.type === 'ERROR' ? 'text-red-300' : log.type === 'COMPLETE' ? 'text-emerald-300' : ''}`}>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {panel === 'help' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={t('quick.help.title')}>
          <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
            <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"><CircleHelp className="h-5 w-5" /></span>
              <div className="mr-auto"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('quick.help.title')}</h2><p className="text-xs text-gray-500">{t('quick.help.description')}</p></div>
              <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                <button type="button" className={`rounded-md px-3 py-1.5 text-xs font-medium ${guideLanguage === 'zh-TW' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-800 dark:text-primary-300' : 'text-gray-500 dark:text-gray-300'}`} onClick={() => setGuideLanguage('zh-TW')}>繁體中文</button>
                <button type="button" className={`rounded-md px-3 py-1.5 text-xs font-medium ${guideLanguage === 'en' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-800 dark:text-primary-300' : 'text-gray-500 dark:text-gray-300'}`} onClick={() => setGuideLanguage('en')}>English</button>
              </div>
              <button type="button" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={closePanel}><X className="h-5 w-5" /></button>
            </header>
            <div className="userGuideContent flex-1 overflow-auto px-7 py-6">
              <ReactMarkdown>{guideLanguage === 'zh-TW' ? zhTwGuide : enGuide}</ReactMarkdown>
            </div>
          </section>
        </div>
      )}
      <QuickButton
        icon={CircleHelp}
        label={t('quick.help.title')}
        onClick={() => {
          setGuideLanguage(i18n.language.toLowerCase().startsWith('en') ? 'en' : 'zh-TW');
          setPanel('help');
        }}
      />
    </>
  );
}

function QuickButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
