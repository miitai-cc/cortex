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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search memos..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={handleAdd} className="btn-primary whitespace-nowrap flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Memo
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading memos...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <StickyNote className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No memos found</p>
          <p className="text-sm">Click "New Memo" to add a sticky note.</p>
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
