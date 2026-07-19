import { useQuery } from '@tanstack/react-query';
import { Building2, LayoutDashboard } from 'lucide-react';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { systemSettingsApi } from '../../services/api';

export default function EnterpriseSystemsPage() {
  const settingsQuery = useQuery({ queryKey: ['system-settings'], queryFn: systemSettingsApi.get });
  const enterpriseSystems = settingsQuery.data?.data?.enterpriseSystems ?? [];
  
  const groupedSystems = enterpriseSystems.reduce((acc: any, sys) => {
    if (!acc[sys.category]) acc[sys.category] = {};
    if (!acc[sys.category][sys.area]) acc[sys.category][sys.area] = [];
    acc[sys.category][sys.area].push(sys);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-10">
      <CommonHeroTitle 
        icon={Building2} 
        title="企業資訊系統" 
        description="依據分類與區域顯示可對外連接的子系統" 
      />
      
      {enterpriseSystems.length > 0 ? (
        <section className="card mt-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(groupedSystems).map(([category, areas]) => (
              <div key={category} className="space-y-3">
                <h3 className="font-medium text-primary-600 border-b border-primary-100 pb-1">{category}</h3>
                {Object.entries(areas as any).map(([area, systems]) => (
                  <div key={area} className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400">{area}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {(systems as any[]).map((sys, idx) => (
                        <a key={idx} href={sys.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded bg-gray-50 p-2 text-sm hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
                          <LayoutDashboard className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="truncate">{sys.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-6 flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-400">尚未設定企業資訊系統</p>
        </div>
      )}
    </div>
  );
}
