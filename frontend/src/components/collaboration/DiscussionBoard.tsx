import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentApi, type DepartmentItem, type DepartmentItemPayload } from '../../services/api';
import { Hash, MessageSquare, Plus, Folder, ChevronRight, MessageCircle, Reply, ArrowLeft } from 'lucide-react';

const DEPARTMENT_ID = 'discussions';

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatRelativeTime = (dateStr?: string, t?: (k: string, p?: any) => string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return t ? t('discussion.minutesAgo', { n: minutes }) : `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t ? t('discussion.hoursAgo', { n: hours }) : `${hours} 小時前`;
  return formatDateTime(dateStr);
};

export default function DiscussionBoard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['discussions'],
    queryFn: () => departmentApi.overview(DEPARTMENT_ID),
  });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState<'category' | 'topic' | 'item' | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [commentText, setCommentText] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload: DepartmentItemPayload) => departmentApi.createItem(DEPARTMENT_ID, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
      setShowAddForm(null);
      setFormTitle('');
      setFormDesc('');
      setCommentText('');
    },
  });

  const items = data?.data?.items ?? [];
  const categories = useMemo(() => items.filter((i) => i.itemType === 'category'), [items]);
  const topics = useMemo(() => items.filter((i) => i.itemType === 'topic' && (i.metadata as any)?.categoryId === selectedCategory), [items, selectedCategory]);
  const topicItems = useMemo(() => items.filter((i) => i.itemType === 'item' && (i.metadata as any)?.topicId === selectedTopic), [items, selectedTopic]);
  const comments = useMemo(() => items.filter((i) => i.itemType === 'comment' && (i.metadata as any)?.itemId === selectedItem).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')), [items, selectedItem]);

  const handleCreate = (type: 'category' | 'topic' | 'item' | 'comment') => {
    if (type !== 'comment' && !formTitle.trim()) return;
    if (type === 'comment' && !commentText.trim()) return;

    const payload: DepartmentItemPayload = {
      itemType: type,
      title: type === 'comment' ? 'Reply' : formTitle,
      description: type === 'comment' ? commentText : formDesc,
      status: 'active',
      priority: 'medium',
      metadata: {},
    };

    if (type === 'topic') payload.metadata!.categoryId = selectedCategory;
    if (type === 'item') payload.metadata!.topicId = selectedTopic;
    if (type === 'comment') payload.metadata!.itemId = selectedItem;

    createMutation.mutate(payload);
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">{t('discussion.loading')}</div>;
  }

  const renderAddForm = (type: 'category' | 'topic' | 'item', onCancel: () => void) => (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <input
        type="text"
        placeholder={t('discussion.titlePlaceholder')}
        className="input-primary mb-2 w-full"
        value={formTitle}
        onChange={(e) => setFormTitle(e.target.value)}
        autoFocus
      />
      <textarea
        placeholder={t('discussion.descPlaceholder')}
        className="input-primary mb-3 h-20 w-full resize-none"
        value={formDesc}
        onChange={(e) => setFormDesc(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel} disabled={createMutation.isPending}>{t('discussion.cancel')}</button>
        <button className="btn-primary" onClick={() => handleCreate(type)} disabled={createMutation.isPending || !formTitle.trim()}>
          {createMutation.isPending ? t('discussion.saving') : t('discussion.confirmAdd')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[600px] gap-6 overflow-hidden">
      {/* Categories (Left Pane) */}
      <div className="flex w-64 shrink-0 flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 z-10">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">{t('discussion.categories')}</h2>
          <button onClick={() => setShowAddForm('category')} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          {showAddForm === 'category' && renderAddForm('category', () => setShowAddForm(null))}
          <div className="space-y-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSelectedTopic(null); setSelectedItem(null); setShowAddForm(null); }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selectedCategory === cat.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-medium' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Folder className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{cat.title}</span>
                </div>
                {selectedCategory === cat.id && <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />}
              </button>
            ))}
            {categories.length === 0 && !showAddForm && <div className="p-4 text-center text-sm text-gray-400">{t('discussion.noCategories')}</div>}
          </div>
        </div>
      </div>

      {/* Middle Pane: Topics OR Items */}
      <div className="flex flex-1 flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!selectedCategory ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-20" />
              <p>{t('discussion.selectCategory')}</p>
            </div>
          </div>
        ) : !selectedTopic ? (
          <>
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 z-10">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Hash className="h-4 w-4 opacity-50" />
                {categories.find(c => c.id === selectedCategory)?.title} - {t('discussion.topics')}
              </h2>
              <button onClick={() => setShowAddForm('topic')} className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t('discussion.addTopic')}
              </button>
            </div>
            <div className="p-4">
              {showAddForm === 'topic' && renderAddForm('topic', () => setShowAddForm(null))}
              <div className="grid gap-3 lg:grid-cols-2">
                {topics.map(topic => (
                  <div key={topic.id} onClick={() => { setSelectedTopic(topic.id); setShowAddForm(null); }} className="group cursor-pointer rounded-xl border border-gray-200 p-4 transition-all hover:border-primary-300 hover:shadow-sm dark:border-gray-800 dark:hover:border-primary-700">
                    <h3 className="font-medium text-gray-800 group-hover:text-primary-600 dark:text-gray-200">{topic.title}</h3>
                    {topic.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{topic.description}</p>}
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {items.filter(i => (i.metadata as any)?.topicId === topic.id).length} {t('discussion.items')}</span>
                      <span>{formatRelativeTime(topic.createdAt, t)}</span>
                    </div>
                  </div>
                ))}
                {topics.length === 0 && !showAddForm && <div className="col-span-full py-10 text-center text-sm text-gray-400">{t('discussion.noTopics')}</div>}
              </div>
            </div>
          </>
        ) : !selectedItem ? (
          <>
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedTopic(null); setShowAddForm(null); }} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-4 w-4 text-gray-500" /></button>
                <h2 className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[200px] xl:max-w-[400px]">
                  {topics.find(t => t.id === selectedTopic)?.title}
                </h2>
              </div>
              <button onClick={() => setShowAddForm('item')} className="btn-primary flex items-center gap-1.5 py-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t('discussion.addItem')}
              </button>
            </div>
            <div className="p-4">
              {showAddForm === 'item' && renderAddForm('item', () => setShowAddForm(null))}
              <div className="space-y-3">
                {topicItems.map(item => (
                  <div key={item.id} onClick={() => { setSelectedItem(item.id); setShowAddForm(null); }} className="cursor-pointer rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:border-primary-200 hover:bg-white dark:border-gray-800 dark:bg-gray-800/20 dark:hover:border-primary-800 dark:hover:bg-gray-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800 dark:text-gray-200">{item.title}</h3>
                        {item.description && <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{item.description}</p>}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                          {item.ownerName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        {item.ownerName || t('discussion.user')}
                      </span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {items.filter(i => i.itemType === 'comment' && (i.metadata as any)?.itemId === item.id).length} {t('discussion.comments')}</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {topicItems.length === 0 && !showAddForm && <div className="py-10 text-center text-sm text-gray-400">{t('discussion.noItems')}</div>}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedItem(null); setShowAddForm(null); }} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-4 w-4 text-gray-500" /></button>
                <h2 className="font-semibold text-gray-700 dark:text-gray-300">{t('discussion.itemDiscussion')}</h2>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {/* Original Item Post */}
              {(() => {
                const item = items.find(i => i.id === selectedItem);
                if (!item) return null;
                return (
                  <div className="mb-8">
                    <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">{item.title}</h1>
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                        {item.ownerName?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.ownerName || t('discussion.user')}</div>
                        <div className="text-xs text-gray-400">{formatDateTime(item.createdAt)}</div>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-700 dark:prose-invert dark:text-gray-300 whitespace-pre-wrap">
                      {item.description}
                    </div>
                  </div>
                );
              })()}

              <div className="mb-6 flex items-center gap-3 text-sm font-medium text-gray-500 before:h-px before:flex-1 before:bg-gray-200 after:h-px after:flex-1 after:bg-gray-200 dark:before:bg-gray-800 dark:after:bg-gray-800">
                {t('discussion.commentSection')} ({comments.length})
              </div>

              {/* Comments List */}
              <div className="space-y-6">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {comment.ownerName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{comment.ownerName || t('discussion.user')}</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(comment.createdAt, t)}</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-none bg-gray-100 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                        {comment.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment Input */}
            <div className="border-t border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex gap-3">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={t('discussion.commentPlaceholder')}
                  className="input-primary flex-1 resize-none"
                  rows={2}
                />
                <button
                  onClick={() => handleCreate('comment')}
                  disabled={!commentText.trim() || createMutation.isPending}
                  className="btn-primary flex shrink-0 items-center gap-1.5 self-end"
                >
                  <Reply className="h-4 w-4" /> {createMutation.isPending ? t('discussion.sending') : t('discussion.send')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
