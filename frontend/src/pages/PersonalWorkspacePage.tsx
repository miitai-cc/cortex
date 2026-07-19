import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Bookmark,
  ClipboardCheck,
  FileText,
  Flag,
  FolderKanban,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import CommonHeroTitle from "../components/common/CommonHeroTitle";
import { knowledgeApi, projectApi } from "../services/api";
import { MyTasks, PersonalAnnouncements, PersonalStatus } from "../components/personal/PersonalFeatures";
import PersonalPhoneRecords from "../components/personal/PersonalPhoneRecords";
import PersonalMemos from "../components/personal/PersonalMemos";
import PersonalDirectory from "../components/personal/PersonalDirectory";

export default function PersonalWorkspacePage() {
  const { section = "following" } = useParams();
  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-overview"],
    queryFn: knowledgeApi.overview,
  });
  const personalProjects = useQuery({
    queryKey: ["personal-projects"],
    queryFn: projectApi.personal,
    enabled: section === "projects",
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
    <div className={`${section === "projects" ? "max-w-[1600px]" : "max-w-11xl"} mx-auto px-4 pb-10`}>
      <CommonHeroTitle
        icon={UserRound}
        title="個人化專區"
        description="我關注的文件、等我審核、個人知識貢獻積分與專案工作"
      />
      {section === "projects" ? (
        <div className="space-y-6">
          {personalProjects.isLoading && (
            <div className="card py-14 text-center text-gray-500">載入我的專案工作…</div>
          )}
          {personalProjects.isError && (
            <div className="card border-red-200 py-14 text-center text-red-600">
              無法載入專案資料，請確認後端服務已完成更新。
            </div>
          )}
          {personalProjects.data && (
            <>
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-semibold"><FolderKanban className="h-5 w-5 text-primary-600" />參與的專案</h2>
                  <Link className="text-sm text-primary-600 hover:underline" to="/cortex/projects/information">開啟專案管理</Link>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {personalProjects.data.data.projects.map((project) => (
                    <Link className="card transition hover:border-primary-400" key={project.id} to={`/cortex/projects/information?project=${encodeURIComponent(project.id)}`}>
                      <span className="text-xs font-bold text-primary-600">{project.code}</span>
                      <h3 className="mt-1 font-semibold">{project.name}</h3>
                      <p className="mt-2 text-sm text-gray-500">{project.managerName} · {project.status}</p>
                    </Link>
                  ))}
                  {!personalProjects.data.data.projects.length && <div className="card col-span-full py-12 text-center text-gray-500">目前尚未參與任何專案</div>}
                </div>
              </section>
              <div className="grid gap-6 xl:grid-cols-3">
                {[
                  { title: "指派給我的工作", icon: ClipboardCheck, items: personalProjects.data.data.tasks, route: "kanban" },
                  { title: "即將到來的里程碑", icon: Flag, items: personalProjects.data.data.milestones, route: "milestones" },
                  { title: "待處理成果稽核", icon: ClipboardCheck, items: personalProjects.data.data.audits, route: "audits" },
                ].map(({ title, icon: Icon, items, route }) => (
                  <section className="card" key={title}>
                    <h2 className="mb-3 flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-violet-500" />{title}<span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">{items.length}</span></h2>
                    <div className="space-y-2">
                      {items.slice(0, 8).map((item) => (
                        <Link className="block rounded-lg border border-gray-200 p-3 text-sm hover:border-primary-400 dark:border-gray-700" key={item.id} to={`/cortex/projects/${route}?project=${encodeURIComponent(item.projectId)}`}>
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{item.status} · {item.endDate || "未設定期限"}</p>
                        </Link>
                      ))}
                      {!items.length && <p className="py-8 text-center text-sm text-gray-500">目前沒有項目</p>}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      ) : section === "tasks" ? (
        <MyTasks />
      ) : section === "announcements" ? (
        <PersonalAnnouncements />
      ) : section === "status" ? (
        <PersonalStatus />
      ) : section === "points" ? (
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
      ) : section === "phone-records" ? (
        <PersonalPhoneRecords />
      ) : section === "memos" ? (
        <PersonalMemos />
      ) : section === "directory" ? (
        <PersonalDirectory />
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
