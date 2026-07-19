import { useQuery } from '@tanstack/react-query';
import { usersDirectoryApi } from '../../services/api';
import { Search, UserCircle, Building2, Mail } from 'lucide-react';
import { useState } from 'react';

export default function PersonalDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['directory', 'users'],
    queryFn: () => usersDirectoryApi.getUsers(),
  });

  const users = data?.data.users || [];
  
  // Extract unique departments for filter dropdown
  const departments = Array.from(new Set(users.map((u: any) => u.departmentKey).filter(Boolean))) as string[];

  const filtered = users.filter((u: any) => {
    const matchesSearch = 
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDept = departmentFilter ? u.departmentKey === departmentFilter : true;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name, email, or title..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="border rounded-lg px-4 py-2 bg-white dark:bg-gray-800 dark:border-gray-700 min-w-[200px]"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading directory...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <UserCircle className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No employees found</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((user: any) => (
            <div key={user.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex gap-4 hover:border-primary-300 transition-colors">
              <div className="h-16 w-16 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full flex items-center justify-center text-2xl font-bold shrink-0">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white truncate" title={user.username}>{user.username}</h3>
                <p className="text-sm text-gray-500 font-medium truncate mb-2">{user.jobTitle || 'No Title'}</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{user.departmentKey || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <a href={`mailto:${user.email}`} className="truncate hover:text-primary-500 transition-colors">
                      {user.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
