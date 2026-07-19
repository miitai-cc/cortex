import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  X,
  Search,
  FileText,
  Check,
  CheckCheck,
  Trash2,
  Sliders,
  Info,
} from 'lucide-react';
import { documentApi } from '../services/api';
import { useContextStore } from '../stores/contextStore';

export default function ContextPanel() {
  const {
    selectedDocs,
    settings,
    panelOpen,
    setPanelOpen,
    toggleDocument,
    clearDocuments,
    selectAll,
    updateSettings,
  } = useContextStore();

  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentApi.list(),
  });

  const documents = docsData?.data?.data ?? docsData?.data ?? [];
  const allDocs = Array.isArray(documents) ? documents : [];

  const filteredDocs = allDocs.filter((doc: any) => {
    const matchSearch = !search || doc.filename?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || doc.file_type?.includes(filterType);
    return matchSearch && matchType;
  });

  const selectedCount = selectedDocs.length;
  const allFilteredSelected = filteredDocs.length > 0 && filteredDocs.every((d: any) => selectedDocs.some((s) => s.id === d.id));

  const fileTypes = [...new Set(allDocs.map((d: any) => {
    const ext = d.file_type?.split('/').pop()?.split('.').pop() ?? 'other';
    return ext.toLowerCase();
  }))];

  if (!panelOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-30 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary-50 rounded-lg">
            <BookOpen className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">上下文庫</h3>
            <p className="text-xs text-gray-400">
              {selectedCount > 0 ? `已選 ${selectedCount} 個文件` : '選取文件作為對話上下文'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="搜尋文件..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors whitespace-nowrap ${filterType === 'all'
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
          >
            全部 ({allDocs.length})
          </button>
          {fileTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors whitespace-nowrap ${filterType === type
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <button
          onClick={() => allFilteredSelected ? clearDocuments() : selectAll(filteredDocs)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {allFilteredSelected ? <Trash2 className="w-3.5 h-3.5" /> : <CheckCheck className="w-3.5 h-3.5" />}
          {allFilteredSelected ? '取消全選' : '全選'}
        </button>
        {selectedCount > 0 && (
          <button
            onClick={clearDocuments}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清除 ({selectedCount})
          </button>
        )}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${showSettings
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          設定
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-3 py-3 border-b border-gray-100 bg-gray-50 space-y-3">
          <div>
            <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Top-K 參考數</span>
              <span className="font-medium text-gray-800">{settings.topK}</span>
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={settings.topK}
              onChange={(e) => updateSettings({ topK: Number(e.target.value) })}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary-600"
            />
          </div>
          <div>
            <label className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>相似度閾值</span>
              <span className="font-medium text-gray-800">{settings.similarityThreshold}</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.similarityThreshold}
              onChange={(e) => updateSettings({ similarityThreshold: Number(e.target.value) })}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary-600"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.useHybrid}
              onChange={(e) => updateSettings({ useHybrid: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-xs text-gray-600">啟用混合搜尋</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeMetadata}
              onChange={(e) => updateSettings({ includeMetadata: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-xs text-gray-600">包含文件中繼資料</span>
          </label>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">找不到文件</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredDocs.map((doc: any) => {
              const isSelected = selectedDocs.some((d) => d.id === doc.id);
              const ext = doc.file_type?.split('/').pop()?.split('.').pop()?.toLowerCase() ?? 'file';
              const typeColors: Record<string, string> = {
                pdf: 'bg-red-100 text-red-700',
                docx: 'bg-blue-100 text-blue-700',
                xlsx: 'bg-green-100 text-green-700',
                txt: 'bg-purple-100 text-purple-700',
                md: 'bg-amber-100 text-amber-700',
              };
              return (
                <button
                  key={doc.id}
                  onClick={() => toggleDocument(doc)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${isSelected
                      ? 'bg-primary-50 border border-primary-200'
                      : 'bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected
                      ? 'bg-primary-600 border-primary-600'
                      : 'border-gray-300'
                    }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[ext] || 'bg-gray-100 text-gray-600'}`}>
                        {ext.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {doc.chunk_count ?? 0} 區塊
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${doc.status === 'indexed' ? 'bg-green-100 text-green-700' :
                          doc.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                        }`}>
                        {doc.status === 'indexed' ? '已索引' :
                          doc.status === 'processing' ? '處理中' :
                            doc.status === 'pending' ? '等待中' : doc.status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <Info className="w-3.5 h-3.5" />
          <span>選取的文件將作為對話的知識來源</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Top-K: {settings.topK}</span>
          <span>·</span>
          <span>混合搜尋: {settings.useHybrid ? '開' : '關'}</span>
          <span>·</span>
          <span>閾值: {settings.similarityThreshold}</span>
        </div>
      </div>
    </div>
  );
}
