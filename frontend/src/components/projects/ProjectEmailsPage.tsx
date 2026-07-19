import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Plus, ChevronDown, Inbox, Send, Archive, Search, Tag, Clock, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommonHeroTitle from '../common/CommonHeroTitle';
import { projectApi } from '../../services/api';
import type { ProjectRecord } from '../../types/projects';

type Category = 'inbox' | 'sent' | 'archived';

const categories: { id: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'inbox', label: '收件匣', icon: <Inbox size={16} />, color: 'text-blue-600' },
  { id: 'sent', label: '已傳送', icon: <Send size={16} />, color: 'text-emerald-600' },
  { id: 'archived', label: '已封存', icon: <Archive size={16} />, color: 'text-gray-500' },
];

export default function ProjectEmailsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<Category>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<ProjectRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigneeName: '', status: 'inbox' });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['projectOverview', projectId],
    queryFn: () => projectApi.overview(projectId || undefined).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectApi.createRecord(projectId, 'email', data),
    onSuccess: () => {
      toast.success('郵件記錄已建立');
      queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
      setShowAdd(false);
      setForm({ title: '', description: '', assigneeName: '', status: 'inbox' });
    },
    onError: () => toast.error('建立失敗'),
  });

  const projects = overview?.projects || [];
  const records = overview?.records || [];
  const emails = records.filter(r => r.recordType === 'email');

  const filteredEmails = useMemo(() => {
    return emails.filter(e => {
      const cat = e.status || 'inbox';
      if (cat !== activeCategory) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return e.title.toLowerCase().includes(term) || (e.description || '').toLowerCase().includes(term) ||
          (e.assigneeName || '').toLowerCase().includes(term);
      }
      return true;
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [emails, activeCategory, searchTerm]);

  const catCounts = useMemo(() => {
    const counts: Record<Category, number> = { inbox: 0, sent: 0, archived: 0 };
    emails.forEach(e => {
      const cat = (e.status || 'inbox') as Category;
      if (cat in counts) counts[cat]++;
    });
    return counts;
  }, [emails]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <CommonHeroTitle
        icon={Mail}
        title="郵件整理"
        description="專案相關郵件記錄與分類管理"
        breadcrumb={['專案管理', '郵件整理']}
      />

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setSearchParams({ project: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm"
            >
              <option value="">選擇專案</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋郵件..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
          </div>

          {projectId && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors shadow-sm ml-auto"
            >
              <Plus size={14} />
              新增郵件記錄
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-200 border-t-teal-600" />
          </div>
        ) : !projectId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Mail className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-lg">請先選擇一個專案</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 h-[calc(100vh-240px)]">
            {/* Left: Categories */}
            <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-3">分類</h3>
              <div className="space-y-1">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setSelectedEmail(null); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      activeCategory === cat.id
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className={cat.color}>{cat.icon}</span>
                    <span className="flex-1 text-left">{cat.label}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                      {catCounts[cat.id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Middle: Email List */}
            <div className="col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-700">
                  {categories.find(c => c.id === activeCategory)?.label}
                  <span className="text-gray-400 font-normal ml-1">({filteredEmails.length})</span>
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredEmails.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm">
                    無郵件記錄
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filteredEmails.map(email => {
                      const meta = (email.metadata || {}) as Record<string, any>;
                      const isSelected = selectedEmail?.id === email.id;
                      return (
                        <div
                          key={email.id}
                          onClick={() => setSelectedEmail(email)}
                          className={`px-4 py-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-teal-50 border-l-2 border-l-teal-500' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-800 truncate">{email.title}</span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                              {email.createdAt ? new Date(email.createdAt).toLocaleDateString('zh-TW') : ''}
                            </span>
                          </div>
                          {email.assigneeName && (
                            <p className="text-[11px] text-gray-500 mb-1">{email.assigneeName}</p>
                          )}
                          <p className="text-[11px] text-gray-400 line-clamp-1">{email.description || '暫無內容'}</p>
                          {meta.tags && Array.isArray(meta.tags) && meta.tags.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {meta.tags.slice(0, 3).map((tag: string, i: number) => (
                                <span key={i} className="text-[9px] px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded-full">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Preview */}
            <div className="col-span-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              {selectedEmail ? (
                <>
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-800">{selectedEmail.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {selectedEmail.assigneeName && (
                        <span className="flex items-center gap-1"><User size={12} />{selectedEmail.assigneeName}</span>
                      )}
                      {selectedEmail.createdAt && (
                        <span className="flex items-center gap-1"><Clock size={12} />{new Date(selectedEmail.createdAt).toLocaleString('zh-TW')}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Tag size={12} />
                        {selectedEmail.status || 'inbox'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto">
                    <div className="prose prose-sm max-w-none">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {selectedEmail.description || '暫無郵件內容'}
                      </p>
                    </div>
                    {(selectedEmail.metadata as Record<string, any>)?.attachments && (
                      <div className="mt-6 border-t border-gray-100 pt-4">
                        <h4 className="text-xs font-semibold text-gray-500 mb-2">附件</h4>
                        <div className="space-y-1">
                          {((selectedEmail.metadata as Record<string, any>).attachments as string[]).map((att, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2">
                              <Tag size={12} />
                              {att}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-300">
                  <div className="text-center">
                    <Mail size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">選擇郵件以預覽</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">新增郵件記錄</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">郵件主旨 *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="郵件主旨" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">寄件人 / 收件人</label>
                <input type="text" value={form.assigneeName} onChange={(e) => setForm({ ...form, assigneeName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="寄件人或收件人" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">內容</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                  placeholder="郵件內容摘要" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">分類</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none">
                  <option value="inbox">收件匣</option>
                  <option value="sent">已傳送</option>
                  <option value="archived">已封存</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">取消</button>
              <button
                onClick={() => {
                  if (!form.title.trim()) { toast.error('請輸入郵件主旨'); return; }
                  createMutation.mutate({
                    title: form.title,
                    description: form.description || undefined,
                    assigneeName: form.assigneeName || undefined,
                    status: form.status,
                  });
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? '建立中...' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
