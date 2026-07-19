import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Bookmark,
  ClipboardCheck,
  FileText,
  UserRound,
} from "lucide-react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import CommonHeroTitle from "../components/common/CommonHeroTitle";
import { knowledgeApi } from "../services/api";

export default function PersonalWorkspacePage() {
  const { section = "following" } = useParams();
  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-overview"],
    queryFn: knowledgeApi.overview,
  });
  const model = data?.data ?? {
    currentUser: {},
    records: [],
    interactions: [],
    pointEvents: [],
  };
  const userId = model.currentUser.id;
  const followed = new Set(
    model.interactions
      .filter((item: any) => item.type === "follow")
      .map((item: any) => item.targetId),
  );
  const records =
    section === "review"
      ? model.records.filter(
          (item: any) =>
            item.reviewerId === userId && item.status === "pending_review",
        )
      : model.records.filter((item: any) => followed.has(item.id));
  const total = model.pointEvents.reduce(
    (sum: number, item: any) => sum + item.points,
    0,
  );
  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      knowledgeApi.reviewRecord(id, { status }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["knowledge-overview"] });
      toast.success("審核結果已儲存");
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "審核失敗"),
  });
  return (
    <div className="max-w-6xl mx-auto px-4 pb-10">
      <CommonHeroTitle
        icon={UserRound}
        title="個人化專區"
        description="我關注的文件、等我審核及個人知識貢獻積分"
      />
      {section === "points" ? (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="card self-start">
            <Award className="h-9 w-9 text-amber-500" />
            <p className="mt-3 text-4xl font-bold">{total}</p>
            <p className="text-sm text-gray-500">累積貢獻積分</p>
            <p className="mt-4 text-xs text-gray-400">
              知識審核通過時自動獲得積分
            </p>
          </div>
          <div className="space-y-2">
            {model.pointEvents.map((item: any, index: number) => (
              <div
                className="card flex items-center"
                key={`${item.createdAt}-${index}`}
              >
                <Award className="mr-3 h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium">{item.reason}</p>
                  <p className="text-xs text-gray-500">{item.createdAt}</p>
                </div>
                <strong className="ml-auto text-emerald-600">
                  {item.points > 0 ? "+" : ""}
                  {item.points}
                </strong>
              </div>
            ))}
            {!model.pointEvents.length && (
              <div className="card py-12 text-center text-gray-500">
                尚無積分異動
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? (
            <p>載入中…</p>
          ) : (
            records.map((item: any) => (
              <article className="card" key={item.id}>
                {section === "review" ? (
                  <ClipboardCheck className="h-7 w-7 text-violet-500" />
                ) : (
                  <Bookmark className="h-7 w-7 text-primary-600" />
                )}
                <h2 className="mt-2 font-semibold">{item.title}</h2>
                <p className="text-sm text-gray-500">
                  {item.category} · {item.recordType} · {item.status}
                </p>
                {item.documentId && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <FileText className="h-3.5 w-3.5" />
                    已連結文件
                  </p>
                )}
                {section === "review" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate({ id: item.id, status: "approved" })
                      }
                      className="btn-primary flex-1"
                    >
                      通過
                    </button>
                    <button
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate({ id: item.id, status: "rejected" })
                      }
                      className="btn-secondary flex-1"
                    >
                      退回
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
          {!records.length && (
            <div className="card col-span-full py-14 text-center text-gray-500">
              {section === "review" ? "目前沒有待審核項目" : "尚未關注任何文件"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
