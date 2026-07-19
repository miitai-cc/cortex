import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Server } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { SystemContext } from '../../types/systemAdmin';

interface TopApiStatusProps {
  systemContext: UseQueryResult<any, Error>;
}

export default function TopApiStatus({ systemContext }: TopApiStatusProps) {
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false);
      }
    };
    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopup]);

  const { data, isError, error, isSuccess, isLoading } = systemContext;

  const serverName = (import.meta as any).env.VITE_APP_SERVER_NAME || data?.data?.about?.productName || 'Cortex API Server';
  const isOnline = isSuccess || (!isError && !isLoading);
  
  // Use 'any' to safely drill into axios/fetch error objects
  const errObj = error as any;
  const errorCode = errObj?.response?.status || errObj?.code || 'ERR';
  const errorMsg = errObj?.response?.data?.message || errObj?.message || '無法連線至伺服器';

  return (
    <div className="relative flex items-center gap-2" ref={popupRef}>
      {/* Server Name Display */}
      <div className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-sm flex items-center gap-1.5 whitespace-nowrap">
        <Server className="w-3.5 h-3.5 opacity-90" />
        {serverName}
      </div>

      {/* API Status */}
      {isOnline ? (
        <div className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-sm flex items-center gap-1.5 cursor-default whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 opacity-90" />
          伺服器正常
        </div>
      ) : (
        <button
          onClick={() => setShowPopup(!showPopup)}
          className="bg-yellow-400 text-red-700 px-2.5 py-1 rounded-md text-[11px] font-black shadow-sm flex items-center gap-1.5 hover:bg-yellow-300 transition-colors whitespace-nowrap border border-yellow-500/50"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          伺服器呼叫失敗 ({errorCode})
        </button>
      )}

      {/* Error Popup (10px below) */}
      {showPopup && !isOnline && (
        <div className="absolute top-[calc(100%+10px)] right-0 w-64 bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-900/80 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
          {/* Triangle Pointer */}
          <div className="absolute -top-2.5 right-4 w-4 h-4 bg-white dark:bg-gray-800 border-t-2 border-l-2 border-red-200 dark:border-red-900/80 rotate-45"></div>
          
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-sm">連線錯誤</h4>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg border border-red-100 dark:border-red-900/30">
              <p className="text-gray-700 dark:text-gray-300 text-xs break-words font-medium">
                {errorMsg}
              </p>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              錯誤代碼: {errorCode}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
