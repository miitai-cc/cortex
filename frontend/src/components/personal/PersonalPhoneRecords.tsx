import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentApi } from '../../services/api';
import { Phone, Search, Plus, PhoneIncoming, Clock } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function PersonalPhoneRecords() {
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
      toast.success('Phone record added');
    },
    onError: () => toast.error('Failed to create'),
  });

  const items = data?.data.items.filter((i: any) => i.itemType === 'phone_record') || [];
  const filtered = items.filter((i: any) => 
    i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    const caller = window.prompt("Enter caller name:");
    if (!caller) return;
    const notes = window.prompt("Enter call notes:");
    createMutation.mutate({
      itemType: 'phone_record',
      title: caller,
      description: notes || '',
      status: 'active',
      priority: 'medium',
      metadata: { date: new Date().toISOString() },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search phone records..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={handleAdd} className="btn-primary whitespace-nowrap flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Record
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <Phone className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No phone records found</p>
            <p className="text-sm">Click "Add Record" to log your first call.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((item: any) => (
              <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition flex items-start gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full shrink-0">
                  <PhoneIncoming className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 break-words line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date((item.metadata as any)?.date || item.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
