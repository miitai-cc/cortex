import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, ChatMessage } from '../stores/chatStore';
import { useContextStore } from '../stores/contextStore';
import {
  Send,
  Loader2,
  Plus,
  Trash2,
  MessageSquare,
  Bot,
  User,
  Sparkles,
  BookOpen,
  X,
  FileText,
} from 'lucide-react';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import ContextPanel from '../components/ContextPanel';

export default function ChatPage() {
  const {
    conversations,
    activeConversationId,
    isStreaming,
    streamingContent,
    setActiveConversation,
    createConversation,
    deleteConversation,
    addMessage,
    setStreaming,
    appendStreamingContent,
    finalizeStream,
    resetStreaming,
  } = useChatStore();

  const {
    selectedDocs,
    settings,
    panelOpen: contextPanelOpen,
    togglePanel: toggleContextPanel,
    removeDocument,
  } = useContextStore();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingRefs, setStreamingRefs] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversation(conversations[0].id);
    }
  }, [conversations, activeConversationId, setActiveConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, streamingContent]);

  const handleNewChat = useCallback(() => {
    createConversation();
    setInput('');
    inputRef.current?.focus();
  }, [createConversation]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    let convId: string = activeConversationId || '';
    if (!convId) {
      convId = createConversation();
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      timestamp: Date.now(),
    };
    addMessage(convId, userMsg);
    setInput('');
    setLoading(true);
    setStreaming(true);
    resetStreaming();

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulatedRefs: any[] = [];

    try {
      const history = activeConversation?.messages
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })) ?? [];

      const token = localStorage.getItem('auth-token') || '';

      const body: any = {
        conversation_id: convId,
        message: msg,
        history,
      };

      if (selectedDocs.length > 0) {
        body.context_doc_ids = selectedDocs.map((d) => d.id);
        body.context_settings = {
          top_k: settings.topK,
          use_hybrid: settings.useHybrid,
          similarity_threshold: settings.similarityThreshold,
          include_metadata: settings.includeMetadata,
        };
      }

      const response = await fetch('/cortex/api/v0.85/chat/send_stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Stream request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      const currentEvent = 'message';

      let streamOpen = true;
      while (streamOpen) {
        const { done, value } = await reader.read();
        if (done) {
          streamOpen = false;
          continue;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n').map((l: string) => l.trim()).filter(Boolean);
          let eventType = currentEvent;
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6);
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            const type = eventType === 'message' ? (data.type || 'token') : eventType;

            switch (type) {
              case 'meta':
                convId = data.conversation_id;
                break;
              case 'references':
                accumulatedRefs = data.references || [];
                setStreamingRefs(accumulatedRefs);
                break;
              case 'token':
                appendStreamingContent(data.content);
                break;
              case 'done':
                break;
              case 'error':
                appendStreamingContent(`\n\n錯誤：${data.message}`);
                break;
              default:
                if (data.content) appendStreamingContent(data.content);
                break;
            }
          } catch { /* skip parse errors */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendStreamingContent('抱歉，連線發生錯誤，請稍後重試。');
      }
    } finally {
      setLoading(false);
      finalizeStream(convId, accumulatedRefs);
      abortRef.current = null;
      setStreamingRefs([]);
    }
  }, [input, loading, activeConversationId, activeConversation, selectedDocs, settings, createConversation, addMessage, setStreaming, appendStreamingContent, finalizeStream, resetStreaming]);

  const handleStopStreaming = useCallback(() => {
    abortRef.current?.abort();
    if (activeConversationId) {
      finalizeStream(activeConversationId, streamingRefs);
      setStreamingRefs([]);
    }
  }, [activeConversationId, finalizeStream, streamingRefs]);

  const displayedMessages = activeConversation?.messages ?? [];
  const hasRefs = streamingRefs.length > 0;

  return (
    <div className="flex h-full">
      {/* Conversation sidebar */}
      <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增對話
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${conv.id === activeConversationId
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              onClick={() => setActiveConversation(conv.id)}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">尚無對話，點擊上方開始</p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
        <div className="px-4 pt-4">
          <CommonHeroTitle icon={MessageSquare} title="對話" description="與您的知識庫對話，支援多輪上下文理解與即時串流回覆" />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {displayedMessages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-primary-500" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Cortex 智慧檢索</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-10 max-w-md text-center">
                  與您的知識庫對話，支援多輪上下文理解與即時串流回覆
                </p>
                <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                  {[
                    { q: '文件中有哪些重點概念？', desc: '知識摘要' },
                    { q: '比較最近上傳文件的異同', desc: '文件比較' },
                    { q: '整理相關研究主題的發展脈絡', desc: '脈絡分析' },
                    { q: '根據文件回答具體問題', desc: '精確問答' },
                  ].map(({ q, desc }) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors text-left"
                    >
                      <span className="text-xs text-primary-500 font-medium block mb-1">{desc}</span>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {displayedMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                    }`}
                >
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  {msg.references && msg.references.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">參考來源：</p>
                      <div className="space-y-1">
                        {msg.references.slice(0, 3).map((ref: any, i: number) => (
                          <div key={i} className="text-xs text-gray-400 dark:text-gray-500 flex items-start gap-1">
                            <span className="text-primary-400 shrink-0">[{i + 1}]</span>
                            <span className="line-clamp-1">{(ref.content || '').slice(0, 80)}...</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming message */}
            {isStreaming && (
              <div className="flex gap-3 mb-6">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[75%] px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md">
                  {streamingContent ? (
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {streamingContent}
                      <span className="inline-block w-2 h-4 bg-primary-600 animate-pulse ml-0.5 rounded-sm" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">思考中</span>
                    </div>
                  )}

                  {hasRefs && (
                    <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">參考來源：</p>
                      <div className="space-y-1">
                        {streamingRefs.slice(0, 3).map((ref: any, i: number) => (
                          <div key={i} className="text-xs text-gray-400 dark:text-gray-500 flex items-start gap-1">
                            <span className="text-primary-400 shrink-0">[{i + 1}]</span>
                            <span className="line-clamp-1">{(ref.content || '').slice(0, 80)}...</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="max-w-4xl mx-auto p-4">
            {/* Context indicator */}
            {selectedDocs.length > 0 && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2.5 py-1 rounded-full">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="font-medium">{selectedDocs.length} 個上下文文件</span>
                </div>
                {selectedDocs.slice(0, 3).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full"
                  >
                    <FileText className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    <span className="max-w-[120px] truncate">{doc.filename}</span>
                    <button
                      onClick={() => removeDocument(doc.id)}
                      className="ml-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {selectedDocs.length > 3 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">+{selectedDocs.length - 3} 更多</span>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={toggleContextPanel}
                className={`shrink-0 p-3 rounded-xl border transition-colors ${contextPanelOpen
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                title="上下文庫管理"
              >
                <BookOpen className="w-5 h-5" />
              </button>
              <input
                ref={inputRef}
                type="text"
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="輸入您的問題... (Enter 發送)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={loading}
              />
              {isStreaming ? (
                <button
                  onClick={handleStopStreaming}
                  className="px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                >
                  停止
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="px-5 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Context Panel */}
      <ContextPanel />
    </div>
  );
}
