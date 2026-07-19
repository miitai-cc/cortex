import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Clock, MessageSquare, Trash2 } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import CommonHeroTitle from '../../components/common/CommonHeroTitle';

export default function ChatHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversations, setActiveConversation, deleteConversation } = useChatStore();

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div>
      <CommonHeroTitle icon={Clock} title={t('nav.chat.history')} description={t('chat.historyDescription')} />

      {sorted.length === 0 ? (
        <div className="card text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('chat.noHistory')}</p>
          <button
            onClick={() => navigate('/cortex/chat')}
            className="mt-4 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('chat.startNew')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((conv) => (
            <div
              key={conv.id}
              className="card flex items-center gap-3 cursor-pointer hover:border-primary-300 transition-colors"
              onClick={() => { setActiveConversation(conv.id); navigate('/cortex/chat'); }}
            >
              <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg shrink-0">
                <MessageSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{conv.title}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {conv.messages.length}{t('chat.messages')} · {new Date(conv.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
