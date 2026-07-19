import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Hash,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  SmilePlus,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collaborationApi } from '../../services/api';
import type {
  CollaborationChannel,
  CollaborationMessage,
  CollaborationOverview,
  CollaborationWorkspace,
} from '../../types/collaboration';
import Modal from './Modal';

const commonReactions = ['👍', '❤️', '🎉', '👀', '✅'];

function errorText(error: any, fallback: string) {
  return error?.response?.data?.error || fallback;
}

function displayTime(value?: string) {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
}

function MessageContent({ content }: { content: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-200">
      {content.split(/(@[\w.-]+)/g).map((part, index) =>
        part.startsWith('@') ? (
          <span key={`${part}-${index}`} className="rounded bg-primary-50 px-1 font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

interface MessageCardProps {
  message: CollaborationMessage;
  currentUserId: string;
  onThread?: (message: CollaborationMessage) => void;
  onReaction: (message: CollaborationMessage, emoji: string) => void;
  onEdit: (message: CollaborationMessage) => void;
  onDelete: (message: CollaborationMessage) => void;
  onIssue?: (issueId: string) => void;
  canModerate?: boolean;
  compact?: boolean;
}

function MessageCard({
  message,
  currentUserId,
  onThread,
  onReaction,
  onEdit,
  onDelete,
  onIssue,
  canModerate,
  compact,
}: MessageCardProps) {
  const [reactionOpen, setReactionOpen] = useState(false);
  const mine = message.userId === currentUserId;
  return (
    <article className={`group flex gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 ${compact ? 'py-1.5' : ''}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-indigo-700 text-sm font-semibold text-white">
        {message.username.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="text-sm text-gray-900 dark:text-gray-100">{message.username}</strong>
          <span className="text-[11px] text-gray-400">{displayTime(message.createdAt)}</span>
          {message.edited && <span className="text-[10px] text-gray-400">已編輯</span>}
          <div className="relative ml-auto hidden items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm group-hover:flex dark:border-gray-600 dark:bg-gray-700">
            <button className="rounded p-1 text-gray-400 hover:text-amber-500" onClick={() => setReactionOpen(!reactionOpen)} title="加入表情">
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
            {onThread && (
              <button className="rounded p-1 text-gray-400 hover:text-primary-600" onClick={() => onThread(message)} title="回覆討論串">
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
            )}
            {mine && (
              <button className="rounded p-1 text-gray-400 hover:text-primary-600" onClick={() => onEdit(message)} title="編輯">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {(mine || canModerate) && (
              <button className="rounded p-1 text-gray-400 hover:text-red-500" onClick={() => onDelete(message)} title="刪除">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {reactionOpen && (
              <div className="absolute right-0 top-8 z-20 flex rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-600 dark:bg-gray-700">
                {commonReactions.map((emoji) => (
                  <button key={emoji} className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => { onReaction(message, emoji); setReactionOpen(false); }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <MessageContent content={message.content} />
        {message.issueId && (onIssue ? <button onClick={() => onIssue(message.issueId!)} className="mt-1 inline-block rounded bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 hover:underline dark:bg-violet-900/30 dark:text-violet-300">開啟連結的 Issue</button> : <span className="mt-1 inline-block rounded bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">已連結 Issue</span>)}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {message.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => onReaction(message, reaction.emoji)}
              className={`rounded-full border px-2 py-0.5 text-xs ${reaction.reacted ? 'border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-900/30' : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700'}`}
            >
              {reaction.emoji} {reaction.count}
            </button>
          ))}
          {!!message.threadCount && onThread && (
            <button onClick={() => onThread(message)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
              <MessageCircle className="h-3 w-3" /> {message.threadCount} 則回覆
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function TeamChannels({ overview, token }: { overview: CollaborationOverview; token: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const requestedChannelId = searchParams.get('channel') ?? '';
  const requestedChannel = overview.channels.find((channel) => channel.id === requestedChannelId);
  const [workspaceId, setWorkspaceId] = useState(requestedChannel?.workspaceId ?? overview.workspaces[0]?.id ?? '');
  const workspaceChannels = useMemo(
    () => overview.channels.filter((channel) => channel.workspaceId === workspaceId),
    [overview.channels, workspaceId],
  );
  const [channelId, setChannelId] = useState(requestedChannel?.id ?? workspaceChannels[0]?.id ?? '');
  const selectedChannel = overview.channels.find((channel) => channel.id === channelId);
  const [messageText, setMessageText] = useState('');
  const [threadText, setThreadText] = useState('');
  const [selectedThread, setSelectedThread] = useState<CollaborationMessage | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [workspaceModal, setWorkspaceModal] = useState<CollaborationWorkspace | 'new' | null>(null);
  const [channelModal, setChannelModal] = useState<CollaborationChannel | 'new' | null>(null);
  const [membersModal, setMembersModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (requestedChannel) {
      setWorkspaceId(requestedChannel.workspaceId);
      setChannelId(requestedChannel.id);
      setSelectedThread(null);
    }
  }, [requestedChannel?.id, requestedChannel?.workspaceId]);

  useEffect(() => {
    if (!overview.workspaces.some((workspace) => workspace.id === workspaceId)) {
      setWorkspaceId(overview.workspaces[0]?.id ?? '');
    }
  }, [overview.workspaces, workspaceId]);

  useEffect(() => {
    if (!workspaceChannels.some((channel) => channel.id === channelId)) {
      setChannelId(workspaceChannels[0]?.id ?? '');
      setSelectedThread(null);
    }
  }, [channelId, workspaceChannels]);

  const messages = useQuery({
    queryKey: ['collaboration-messages', channelId],
    queryFn: () => collaborationApi.messages(channelId),
    enabled: !!channelId,
  });
  const threads = useQuery({
    queryKey: ['collaboration-thread', selectedThread?.id],
    queryFn: () => collaborationApi.messages(channelId, selectedThread!.id),
    enabled: !!channelId && !!selectedThread,
  });
  const search = useQuery({
    queryKey: ['collaboration-message-search', channelId, activeSearch],
    queryFn: () => collaborationApi.searchMessages(activeSearch, channelId),
    enabled: !!channelId && !!activeSearch,
  });

  const refreshChannel = () => {
    queryClient.invalidateQueries({ queryKey: ['collaboration-messages', channelId] });
    queryClient.invalidateQueries({ queryKey: ['collaboration-thread'] });
    queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] });
    if (activeSearch) queryClient.invalidateQueries({ queryKey: ['collaboration-message-search'] });
  };

  useEffect(() => {
    if (!channelId || !token) return;
    collaborationApi.markRead(channelId).then(() => queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] }));
    const socket = new WebSocket(collaborationApi.websocketUrl(channelId, token));
    socket.onmessage = () => {
      refreshChannel();
      collaborationApi.markRead(channelId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] });
      });
    };
    return () => socket.close();
  }, [channelId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data]);

  const send = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      collaborationApi.sendMessage(channelId, { content, parentId }),
    onSuccess: (_data, variables) => {
      if (variables.parentId) setThreadText('');
      else setMessageText('');
      refreshChannel();
    },
    onError: (error) => toast.error(errorText(error, '訊息傳送失敗')),
  });

  const reaction = async (message: CollaborationMessage, emoji: string) => {
    try {
      await collaborationApi.toggleReaction(message.id, emoji);
      refreshChannel();
    } catch (error) {
      toast.error(errorText(error, '加入表情失敗'));
    }
  };
  const editMessage = async (message: CollaborationMessage) => {
    const content = window.prompt('編輯訊息', message.content);
    if (!content?.trim() || content === message.content) return;
    try {
      await collaborationApi.updateMessage(message.id, content);
      refreshChannel();
    } catch (error) {
      toast.error(errorText(error, '訊息編輯失敗'));
    }
  };
  const deleteMessage = async (message: CollaborationMessage) => {
    if (!window.confirm('確定刪除此訊息？若是主訊息，其討論串也會一併刪除。')) return;
    try {
      await collaborationApi.deleteMessage(message.id);
      if (selectedThread?.id === message.id) setSelectedThread(null);
      refreshChannel();
    } catch (error) {
      toast.error(errorText(error, '訊息刪除失敗'));
    }
  };
  const manageAllowed = selectedChannel && (
    overview.currentUser.role === 'admin' || selectedChannel.createdBy === overview.currentUser.id
  );
  const selectedWorkspace = overview.workspaces.find((workspace) => workspace.id === workspaceId);
  const workspaceManageAllowed = selectedWorkspace && (
    overview.currentUser.role === 'admin' || selectedWorkspace.createdBy === overview.currentUser.id
  );

  const visibleMessages = (activeSearch ? search.data?.data?.messages : messages.data?.data?.messages) as CollaborationMessage[] | undefined;
  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:h-[calc(100vh-210px)] lg:grid-cols-[250px_minmax(400px,1fr)_minmax(0,360px)]">
      <aside className="flex min-h-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/70">
        <div className="border-b border-gray-200 p-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <select className="input-field min-w-0 flex-1 font-medium" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
              {overview.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
            {workspaceManageAllowed && <button className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-primary-600 dark:hover:bg-gray-700" onClick={() => setWorkspaceModal(selectedWorkspace)} title="編輯工作空間"><Pencil className="h-4 w-4" /></button>}
            <button className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-primary-600 dark:hover:bg-gray-700" onClick={() => setWorkspaceModal('new')} title="新增工作空間">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <span>頻道</span>
          <button onClick={() => setChannelModal('new')} className="rounded p-1 hover:bg-gray-200 hover:text-primary-600 dark:hover:bg-gray-700" title="新增頻道"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-3">
          {workspaceChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => { setChannelId(channel.id); setActiveSearch(''); setSelectedThread(null); }}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${channel.id === channelId ? 'bg-primary-100 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
            >
              {channel.isPrivate ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-4 w-4 shrink-0" />}
              <span className="truncate">{channel.name}</span>
              {!!channel.unreadCount && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{channel.unreadCount > 99 ? '99+' : channel.unreadCount}</span>}
            </button>
          ))}
          {!workspaceChannels.length && <p className="px-3 py-8 text-center text-xs text-gray-400">尚無頻道</p>}
        </div>
        <div className="border-t border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{overview.currentUser.username}</div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        {selectedChannel ? (
          <>
            <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              {selectedChannel.isPrivate ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">{selectedChannel.name}</h2>
                <p className="truncate text-xs text-gray-500">{selectedChannel.description || '未設定頻道說明'}</p>
              </div>
              <button onClick={() => setMembersModal(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                <Users className="h-4 w-4" /> {selectedChannel.memberCount}
              </button>
              {manageAllowed && (
                <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-gray-800" title="編輯頻道" onClick={() => setChannelModal(selectedChannel)}><Pencil className="h-4 w-4" /></button>
              )}
              {manageAllowed && (
                <button
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  title="刪除頻道"
                  onClick={async () => {
                    if (!window.confirm(`確定刪除 #${selectedChannel.name} 與全部訊息？`)) return;
                    try { await collaborationApi.deleteChannel(selectedChannel.id); queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] }); }
                    catch (error) { toast.error(errorText(error, '刪除頻道失敗')); }
                  }}
                ><Trash2 className="h-4 w-4" /></button>
              )}
            </header>
            <form className="flex gap-2 border-b border-gray-100 p-2 dark:border-gray-800" onSubmit={(event) => { event.preventDefault(); setActiveSearch(searchText.trim()); }}>
              <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" /><input className="input-field w-full pl-8" placeholder="搜尋此頻道訊息" value={searchText} onChange={(event) => setSearchText(event.target.value)} /></div>
              <button className="btn-secondary px-3" type="submit">搜尋</button>
              {activeSearch && <button type="button" className="btn-secondary px-3" onClick={() => { setActiveSearch(''); setSearchText(''); }}>清除</button>}
            </form>
            <div className="flex-1 overflow-auto py-3">
              {activeSearch && <p className="px-4 pb-2 text-xs text-gray-500">「{activeSearch}」的搜尋結果</p>}
              {visibleMessages?.map((message) => (
                <MessageCard key={message.id} message={message} currentUserId={overview.currentUser.id} canModerate={overview.currentUser.role === 'admin'} onThread={setSelectedThread} onReaction={reaction} onEdit={editMessage} onDelete={deleteMessage} onIssue={(issueId) => navigate(`/cortex/collaboration/issues?issue=${encodeURIComponent(issueId)}`)} />
              ))}
              {!messages.isLoading && !visibleMessages?.length && <div className="py-20 text-center text-sm text-gray-400">{activeSearch ? '找不到符合的訊息' : '這個頻道還沒有訊息，開始第一段對話吧。'}</div>}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-gray-200 p-3 dark:border-gray-700">
              <div className="rounded-xl border border-gray-300 bg-white focus-within:border-primary-400 dark:border-gray-600 dark:bg-gray-800">
                <textarea
                  className="min-h-20 w-full resize-none rounded-xl bg-transparent px-3 py-2 text-sm outline-none"
                  placeholder={`傳訊息到 #${selectedChannel.name}；使用 @username 提及成員`}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (messageText.trim()) send.mutate({ content: messageText }); } }}
                />
                <div className="flex items-center border-t border-gray-100 px-2 py-1.5 dark:border-gray-700">
                  <select
                    className="max-w-40 bg-transparent text-xs text-gray-500 outline-none"
                    value=""
                    onChange={(event) => { if (event.target.value) setMessageText((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@${event.target.value} `); }}
                  >
                    <option value="">@ 提及成員</option>
                    {overview.users.map((user) => <option key={user.id} value={user.username}>{user.username}</option>)}
                  </select>
                  <span className="ml-2 text-[10px] text-gray-400">Enter 傳送 · Shift+Enter 換行</span>
                  <button disabled={!messageText.trim() || send.isPending} onClick={() => send.mutate({ content: messageText })} className="ml-auto rounded-lg bg-primary-600 p-2 text-white disabled:opacity-40" title="傳送"><Send className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </>
        ) : <div className="flex flex-1 items-center justify-center text-gray-400">請建立或選擇頻道</div>}
      </section>

      <aside className="hidden min-h-0 flex-col border-l border-gray-200 dark:border-gray-700 lg:flex">
        {selectedThread ? (
          <>
            <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700"><div><h3 className="font-semibold">討論串</h3><p className="text-xs text-gray-500">#{selectedChannel?.name}</p></div><button className="rounded p-1 text-gray-400 hover:bg-gray-100" onClick={() => setSelectedThread(null)}><ChevronRight className="h-5 w-5" /></button></header>
            <div className="border-b border-gray-100 py-2 dark:border-gray-800"><MessageCard message={selectedThread} currentUserId={overview.currentUser.id} canModerate={overview.currentUser.role === 'admin'} onReaction={reaction} onEdit={editMessage} onDelete={deleteMessage} compact /></div>
            <div className="flex-1 overflow-auto py-2">
              {(threads.data?.data?.messages as CollaborationMessage[] | undefined)?.map((message) => <MessageCard key={message.id} message={message} currentUserId={overview.currentUser.id} canModerate={overview.currentUser.role === 'admin'} onReaction={reaction} onEdit={editMessage} onDelete={deleteMessage} compact />)}
              {!threads.data?.data?.messages?.length && <p className="px-4 py-8 text-center text-xs text-gray-400">尚無回覆</p>}
            </div>
            <div className="border-t border-gray-200 p-3 dark:border-gray-700">
              <textarea className="input-field min-h-16 w-full resize-none" placeholder="回覆討論串" value={threadText} onChange={(event) => setThreadText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (threadText.trim()) send.mutate({ content: threadText, parentId: selectedThread.id }); } }} />
              <div className="mt-2 flex items-center">
                <select className="max-w-36 bg-transparent text-xs text-gray-500" value="" onChange={(event) => { if (event.target.value) setThreadText((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@${event.target.value} `); }}><option value="">@ 提及</option>{overview.users.map((user) => <option key={user.id} value={user.username}>{user.username}</option>)}</select>
                <button className="btn-primary ml-auto flex items-center gap-1.5" disabled={!threadText.trim() || send.isPending} onClick={() => send.mutate({ content: threadText, parentId: selectedThread.id })}><Send className="h-3.5 w-3.5" />回覆</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-gray-400"><MessageCircle className="mb-3 h-10 w-10 opacity-40" /><p className="text-sm">選擇訊息的討論串按鈕<br />即可進行聚焦討論</p></div>
        )}
      </aside>

      {workspaceModal && <WorkspaceModal workspace={workspaceModal === 'new' ? undefined : workspaceModal} onClose={() => setWorkspaceModal(null)} onSaved={() => { setWorkspaceModal(null); queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] }); }} />}
      {channelModal && <ChannelModal channel={channelModal === 'new' ? undefined : channelModal} overview={overview} workspaceId={workspaceId} onClose={() => setChannelModal(null)} onSaved={() => { setChannelModal(null); queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] }); }} />}
      {membersModal && selectedChannel && <MembersModal overview={overview} channel={selectedChannel} canManage={!!manageAllowed} onClose={() => setMembersModal(false)} onChanged={() => { queryClient.invalidateQueries({ queryKey: ['collaboration-overview'] }); queryClient.invalidateQueries({ queryKey: ['collaboration-members', selectedChannel.id] }); }} />}
    </div>
  );
}

function WorkspaceModal({ workspace, onClose, onSaved }: { workspace?: CollaborationWorkspace; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(workspace?.name ?? '');
  const [description, setDescription] = useState(workspace?.description ?? '');
  const save = useMutation({
    mutationFn: () => workspace ? collaborationApi.updateWorkspace(workspace.id, { name, description }) : collaborationApi.createWorkspace({ name, description }),
    onSuccess: () => { toast.success(workspace ? '工作空間已更新' : '工作空間已建立'); onSaved(); },
    onError: (error) => toast.error(errorText(error, '儲存工作空間失敗')),
  });
  return <Modal title={workspace ? '編輯工作空間' : '新增工作空間'} onClose={onClose} width="max-w-lg"><div className="space-y-4"><label className="block text-sm font-medium">名稱<input autoFocus className="input-field mt-1 w-full" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm font-medium">說明<textarea className="input-field mt-1 min-h-20 w-full" value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="flex items-center justify-end gap-2">{workspace && <button className="mr-auto flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={async () => { if (!window.confirm(`確定刪除工作空間「${workspace.name}」、全部頻道與訊息？`)) return; try { await collaborationApi.deleteWorkspace(workspace.id); toast.success('工作空間已刪除'); onSaved(); } catch (error) { toast.error(errorText(error, '刪除工作空間失敗')); } }}><Trash2 className="h-4 w-4" />刪除</button>}<button className="btn-secondary" onClick={onClose}>取消</button><button className="btn-primary" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>{workspace ? '儲存' : '建立'}</button></div></div></Modal>;
}

function ChannelModal({ channel, overview, workspaceId, onClose, onSaved }: { channel?: CollaborationChannel; overview: CollaborationOverview; workspaceId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(channel?.name ?? '');
  const [description, setDescription] = useState(channel?.description ?? '');
  const [isPrivate, setPrivate] = useState(channel?.isPrivate ?? false);
  const [memberIds, setMemberIds] = useState<string[]>([overview.currentUser.id]);
  const save = useMutation({
    mutationFn: () => channel ? collaborationApi.updateChannel(channel.id, { workspaceId, name, description, isPrivate }) : collaborationApi.createChannel({ workspaceId, name, description, isPrivate, memberIds }),
    onSuccess: () => { toast.success(channel ? '頻道已更新' : '頻道已建立'); onSaved(); },
    onError: (error) => toast.error(errorText(error, '儲存頻道失敗')),
  });
  return <Modal title={channel ? `編輯 #${channel.name}` : '新增頻道'} onClose={onClose}><div className="space-y-4"><label className="block text-sm font-medium">頻道名稱<input autoFocus className="input-field mt-1 w-full" placeholder="例如：product-team" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm font-medium">說明<textarea className="input-field mt-1 min-h-16 w-full" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPrivate} onChange={(event) => setPrivate(event.target.checked)} /><Lock className="h-4 w-4" />私人頻道（僅頻道成員可讀寫）</label>{!channel && isPrivate && <div><p className="mb-2 text-sm font-medium">初始成員</p><div className="grid gap-2 sm:grid-cols-2">{overview.users.map((user) => <label key={user.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600"><input type="checkbox" disabled={user.id === overview.currentUser.id} checked={memberIds.includes(user.id)} onChange={(event) => setMemberIds(event.target.checked ? [...memberIds, user.id] : memberIds.filter((id) => id !== user.id))} />{user.username}</label>)}</div></div>}{channel && <p className="text-xs text-gray-500">頻道成員請從頻道標題旁的成員按鈕管理。</p>}<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>取消</button><button className="btn-primary" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>{channel ? '儲存' : '建立頻道'}</button></div></div></Modal>;
}

function MembersModal({ overview, channel, canManage, onClose, onChanged }: { overview: CollaborationOverview; channel: CollaborationChannel; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const members = useQuery({ queryKey: ['collaboration-members', channel.id], queryFn: () => collaborationApi.members(channel.id) });
  const rows = members.data?.data?.members ?? [];
  const memberIds = new Set(rows.map((member: any) => member.userId));
  const addable = overview.users.filter((user) => !memberIds.has(user.id));
  const [selected, setSelected] = useState<string[]>([]);
  return <Modal title={`#${channel.name} 成員`} onClose={onClose} width="max-w-lg"><div className="space-y-2">{rows.map((member: any) => <div key={member.userId} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-medium text-primary-700">{(member.username || member.userId).slice(0, 1).toUpperCase()}</div><div><p className="text-sm font-medium">{member.username || member.userId}</p><p className="text-xs text-gray-400">{member.role === 'owner' ? '擁有者' : '成員'}</p></div>{canManage && member.role !== 'owner' && <button className="ml-auto rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" onClick={async () => { if (!window.confirm('確定移除此成員？')) return; await collaborationApi.removeMember(channel.id, member.userId); onChanged(); }}><UserMinus className="h-4 w-4" /></button>}</div>)}{canManage && !!addable.length && <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700"><p className="mb-2 text-sm font-medium">加入成員</p><div className="max-h-40 space-y-1 overflow-auto">{addable.map((user) => <label key={user.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"><input type="checkbox" checked={selected.includes(user.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, user.id] : selected.filter((id) => id !== user.id))} />{user.username}</label>)}</div><button disabled={!selected.length} className="btn-primary mt-3 flex items-center gap-2" onClick={async () => { try { await collaborationApi.addMembers(channel.id, selected); setSelected([]); onChanged(); toast.success('成員已加入'); } catch (error) { toast.error(errorText(error, '加入成員失敗')); } }}><UserPlus className="h-4 w-4" />加入所選成員</button></div>}</div></Modal>;
}
