import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, FolderCog, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import { knowledgeApi } from '../services/api';

export default function KnowledgeCategoriesPage() {
  const client = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' });
  const { data } = useQuery({ queryKey: ['knowledge-overview'], queryFn: knowledgeApi.overview });
  const model = data?.data ?? { categories: [], currentUser: {} };
  const refresh = () => client.invalidateQueries({ queryKey: ['knowledge-overview'] });
  const create = useMutation({ mutationFn: () => knowledgeApi.createCategory(form), onSuccess: () => { setForm({ name: '', description: '', color: '#6366f1' }); refresh(); toast.success('分類已建立'); } });
  const edit = async (item: any) => {
    const name = window.prompt('分類名稱', item.name);
    if (!name) return;
    const description = window.prompt('分類說明', item.description || '') ?? item.description;
    await knowledgeApi.updateCategory(item.id, { name, description, color: item.color });
    refresh();
  };
  const remove = async (item: any) => {
    if (!window.confirm(`確定刪除分類「${item.name}」？`)) return;
    try { await knowledgeApi.deleteCategory(item.id); refresh(); }
    catch (error: any) { toast.error(error.response?.data?.error || '使用中的分類無法刪除'); }
  };
  return <div className="mx-auto max-w-5xl px-4 pb-10">
    <CommonHeroTitle icon={FolderCog} title="分類主題設定" description="建立與維護企業知識分類；使用中的分類受到刪除保護" />
    <div className="card mb-6 grid gap-3 md:grid-cols-[1fr_2fr_auto_auto]">
      <input className="input-field" placeholder="分類名稱" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      <input className="input-field" placeholder="分類說明" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
      <input type="color" className="h-10 w-14 rounded border" value={form.color} onChange={event => setForm({ ...form, color: event.target.value })} />
      <button className="btn-primary flex items-center gap-2" disabled={!form.name.trim()} onClick={() => create.mutate()}><Plus className="h-4 w-4" />新增</button>
    </div>
    <div className="space-y-3">{model.categories.map((item: any) => <article className="card flex items-center gap-3" key={item.id}>
      <span className="h-5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
      <div><h2 className="font-semibold">{item.name}</h2><p className="text-sm text-gray-500">{item.description || '未填寫說明'}</p></div>
      {model.currentUser.role === 'admin' && <div className="ml-auto flex gap-2"><button onClick={() => edit(item)} className="rounded p-2 hover:bg-gray-100"><Edit3 className="h-4 w-4" /></button><button onClick={() => remove(item)} className="rounded p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>}
    </article>)}</div>
  </div>;
}
