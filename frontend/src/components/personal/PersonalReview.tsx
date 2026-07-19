import CommonHeroTitle from '../../components/common/CommonHeroTitle';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeApi } from '../../services/api';
import { ClipboardCheck, CheckCircle2, XCircle, FileText, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PersonalReview() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['knowledge-overview'],
    queryFn: knowledgeApi.overview,
  });

  const model = data?.data ?? {
    currentUser: {},
    records: [],
  };
  const userId = model.currentUser.id;

  const records = model.records.filter(
    (item: any) =>
      item.reviewerId === userId && item.status === "pending_review",
  );

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      knowledgeApi.reviewRecord(id, { status }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["knowledge-overview"] });
      toast.success("Review submitted successfully");
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed to submit review"),
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 pb-12 animate-in slide-in-from-right-8 duration-700">
      <CommonHeroTitle
        icon={ClipboardCheck}
        title={t('personal.review.title')}
        description={t('personal.review.desc')}
        theme={{ titleColor: '#7c3aed' }}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md rounded-3xl border border-white/50 dark:border-gray-700/50 shadow-xl">
          <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">{t('personal.review.empty.title')}</h2>
          <p className="text-gray-500">{t('personal.review.empty.desc')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {records.map((item: any) => (
            <div 
              key={item.id} 
              className="group flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-md hover:shadow-xl transition-all duration-300 gap-6"
            >
              <div className="flex items-start gap-5 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/40 dark:to-fuchsia-900/40 flex items-center justify-center shrink-0">
                  <FileText className="h-7 w-7 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate mb-1">{item.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700/50 rounded-md font-medium">
                      {item.category}
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700/50 rounded-md font-medium">
                      {item.recordType}
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-md font-medium">
                      <Clock className="h-3.5 w-3.5" /> {t('personal.review.pending')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ id: item.id, status: "approved" })}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <CheckCircle2 className="h-5 w-5" /> {t('personal.review.approve')}
                </button>
                <button
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ id: item.id, status: "rejected" })}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-rose-600 border-2 border-rose-100 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <XCircle className="h-5 w-5" /> {t('personal.review.reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
