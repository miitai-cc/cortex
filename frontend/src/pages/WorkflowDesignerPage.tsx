import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkflowEditor, WorkflowI18nContext } from 'eiva-fe-workflow';
import { Braces, Network, RefreshCw } from 'lucide-react';
import { useAuthStore } from 'eiva-fe-security';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import { workflowEditorTranslate } from '../config/workflowI18n';
import { API_BASE_URL } from '../config/env';
import { workflowApi } from '../services/api';

export default function WorkflowDesignerPage() {
  const token = useAuthStore((state) => state.token) ?? '';
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [payloadText, setPayloadText] = useState('{\n  "requestId": "demo-001",\n  "amount": 1000\n}');
  const overview = useQuery({ queryKey: ['workflow-overview'], queryFn: workflowApi.overview });
  const translator = useMemo(() => ({
    t: (key: string, params?: Record<string, unknown>) => workflowEditorTranslate(i18n.language, key, params),
  }), [i18n.language]);
  const payloadState = useMemo(() => {
    try {
      const value = JSON.parse(payloadText) as Record<string, unknown>;
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('輸入必須是 JSON 物件');
      return { value, error: '' };
    } catch (error) {
      return { value: {}, error: error instanceof Error ? error.message : 'JSON 格式錯誤' };
    }
  }, [payloadText]);
  const testPayload = payloadState.value;
  const payloadError = payloadState.error;
  const initialWorkflowId = searchParams.get('workflow') || 'default';

  return (
    <div className="mx-auto max-w-[1800px] px-4 pb-8">
      <CommonHeroTitle
        icon={Network}
        title="工作流程設計器"
        description="整合 eiva-fe-workflow，以節點、連線、條件與泳道設計可版本化及可執行的工作流程"
        breadcrumb={['工作流程管理', '流程設計器']}
        extraButtons={[{ label: '重新整理流程清單', icon: RefreshCw, onClick: () => overview.refetch() }]}
      />
      <section className="card mb-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Braces className="h-4 w-4 text-primary-600" />執行測試 Payload</h2>
          <p className="mt-1 text-xs text-gray-500">按設計器內的「執行」時會送出此 JSON。流程必須先儲存並發佈。</p>
        </div>
        <div>
          <textarea className={`input-field min-h-24 font-mono text-xs ${payloadError ? 'border-red-400' : ''}`} value={payloadText} onChange={(event) => setPayloadText(event.target.value)} />
          {payloadError && <p className="mt-1 text-xs text-red-500">{payloadError}</p>}
        </div>
      </section>
      {overview.isError && <div className="card mb-4 border-red-200 py-4 text-center text-sm text-red-600">無法載入工作流程與使用者資料，請確認後端已完成更新。</div>}
      <div className="h-[calc(100vh-300px)] min-h-[680px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <WorkflowI18nContext.Provider value={translator}>
          <WorkflowEditor
            apiBase={API_BASE_URL}
            authToken={token}
            initialWorkflowId={initialWorkflowId}
            testPayload={testPayload}
            availableUsers={(overview.data?.data.users ?? []).map((user) => ({ id: user.id, username: user.username }))}
            onNotify={(message, type) => type === 'error' ? toast.error(message) : type === 'success' ? toast.success(message) : toast(message)}
            onWorkflowChanged={() => queryClient.invalidateQueries({ queryKey: ['workflow-overview'] })}
            onRunResult={() => queryClient.invalidateQueries({ queryKey: ['workflow-instances'] })}
          />
        </WorkflowI18nContext.Provider>
      </div>
    </div>
  );
}
