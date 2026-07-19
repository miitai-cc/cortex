import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentApi, usersDirectoryApi } from '../../services/api';
import { Send, Plus, Search, Building2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function CircularMessages() {
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: colData, isLoading } = useQuery({
    queryKey: ['department', 'collaboration'],
    queryFn: () => departmentApi.overview('collaboration'),
  });

  const { data: dirData } = useQuery({
    queryKey: ['directory', 'users'],
    queryFn: () => usersDirectoryApi.getUsers(),
  });

  const users = dirData?.data.users || [];
  const departments = Array.from(new Set(users.map((u: any) => u.departmentKey).filter(Boolean))) as string[];

  const createMutation = useMutation({
    mutationFn: (newItem: any) => departmentApi.createItem('collaboration', newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'collaboration'] });
      toast.success('Circular message sent successfully');
    },
    onError: () => toast.error('Failed to send circular message'),
  });

  const items = colData?.data.items.filter((i: any) => i.itemType === 'circular_message') || [];
  
  const filtered = items.filter((i: any) => 
    i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    const title = window.prompt("Circular Message Title:");
    if (!title) return;
    const content = window.prompt("Message Content:");
    if (!content) return;
    
    // Simplistic prompt for target
    const targetInput = window.prompt("Target Departments (comma separated) or leave empty for All Company:", "");
    
    let targetDepartments: string[] = [];
    let isCompanyWide = true;
    
    if (targetInput && targetInput.trim().length > 0) {
      targetDepartments = targetInput.split(',').map(s => s.trim());
      isCompanyWide = false;
    }
    
    createMutation.mutate({
      itemType: 'circular_message',
      title: title,
      description: content,
      status: 'active',
      priority: 'high',
      metadata: { targetDepartments, isCompanyWide, readBy: [] },
    });
  };

  const markAsReadMutation = useMutation({
    mutationFn: (payload: { id: string, readBy: string[] }) => 
      departmentApi.updateItem('collaboration', payload.id, { metadata: { readBy: payload.readBy } } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', 'collaboration'] });
    }
  });

  const handleMarkRead = (item: any) => {
    const meta = (item.metadata as any) || {};
    const readBy = meta.readBy || [];
    // Just appending a dummy user ID for now to simulate read
    if (!readBy.includes('current_user')) {
      markAsReadMutation.mutate({ id: item.id, readBy: [...readBy, 'current_user'] });
      toast.success('Marked as read');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search circular messages..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={handleCreate} className="btn-primary whitespace-nowrap flex items-center gap-2">
          <Plus className="h-4 w-4" /> Send Circular
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading circulars...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <Send className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No circular messages</p>
            <p className="text-sm">Click "Send Circular" to broadcast a message.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((item: any) => {
              const meta = (item.metadata as any) || {};
              const isCompanyWide = meta.isCompanyWide !== false;
              const targetDepts = meta.targetDepartments || [];
              const readBy = meta.readBy || [];
              const isRead = readBy.includes('current_user');

              return (
                <div key={item.id} className={`p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition flex flex-col sm:flex-row gap-4 ${!isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`text-base font-semibold ${!isRead ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-white'}`}>
                        {item.title}
                        {!isRead && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">New</span>}
                      </h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 mb-3">
                      {item.description}
                    </p>
                    
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{isCompanyWide ? 'All Company' : targetDepts.join(', ')}</span>
                      </div>
                      
                      {!isRead ? (
                        <button 
                          onClick={() => handleMarkRead(item)}
                          className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium px-3 py-1.5 bg-primary-50 rounded-full hover:bg-primary-100 transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Mark as Read
                        </button>
                      ) : (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Read
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
