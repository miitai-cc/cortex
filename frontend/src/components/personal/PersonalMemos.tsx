import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentApi } from '../../services/api';
import { StickyNote, Search, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const COLORS = [
  'bg-yellow-100 text-yellow-900',
  'bg-pink-100 text-pink-900',
  'bg-blue-100 text-blue-900',
  'bg-green-100 text-green-900',
  'bg-purple-100 text-purple-900',
];

export default function PersonalMemos() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['department', 'personal'],
    queryFn: () => departmentApi.overview('personal'),
  });

  const createMutation = useMutation({
    mutationFn: (newItem: any) => departmentApi.createItem('personal', newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'personal'] });
      toast.success('Memo added');
    },
    onError: () => toast.error('Failed to create memo'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentApi.deleteItem('personal', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'personal'] });
      toast.success('Memo deleted');
    },
    onError: () => toast.error('Failed to delete memo'),
  });

  const items = data?.data.items.filter((i: any) => i.itemType === 'memo') || [];
  const filtered = items.filter((i: any) => 
    i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    const title = window.prompt("Memo Title:");
    if (!title) return;
    const content = window.prompt("Memo Content:");
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    createMutation.mutate({
      itemType: 'memo',
      title: title,
      description: content || '',
      status: 'active',
      priority: 'medium',
      metadata: { color: randomColor },
    });
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 pb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <CommonHeroTitle
        icon={StickyNote}
        title={t('personal.memos.title')}
        description={t('personal.memos.desc')}
        theme={{ titleColor: '#eab308' }}
        extraButtons={[{ label: t('personal.memos.new'), icon: Plus, onClick: handleAdd }]}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input 
            type="text" 
            placeholder={t('personal.memos.search')} 
            className="w-full pl-12 pr-4 py-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all text-gray-700 dark:text-gray-200 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading memos...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <StickyNote className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">{t('personal.memos.empty')}</p>
          <p className="text-sm">Click "{t('personal.memos.new')}" to add a sticky note.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((item: any) => {
            const colorClass = (item.metadata as any)?.color || 'bg-yellow-100 text-yellow-900';
            return (
              <div 
                key={item.id} 
                className={`relative group p-5 rounded-md shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 rotate-1 hover:rotate-0 min-h-[200px] flex flex-col ${colorClass} dark:bg-opacity-90`}
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      if (window.confirm('Delete this memo?')) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    className="p-1.5 bg-black/10 hover:bg-black/20 rounded-full text-black/70 hover:text-black transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="font-bold text-lg mb-2 pr-6 border-b border-black/10 pb-2">{item.title}</h3>
                <p className="text-sm whitespace-pre-wrap flex-1">{item.description}</p>
                <div className="text-[10px] uppercase font-bold text-black/40 mt-4 text-right">
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
