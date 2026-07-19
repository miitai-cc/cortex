import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Bookmark,
  CircleHelp,
  Edit3,
  FileText,
  FolderCog,
  Library,
  MessageSquare,
  Plus,
  Save,
  Star,
  Trash2,
  UserRoundSearch,
  X,
} from "lucide-react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import CommonHeroTitle from "../../components/common/CommonHeroTitle";
import { knowledgeApi } from "../../services/api";

type RecordItem = {
  id: string;
  documentId?: string;
  contentId?: string;
  title: string;
  category: string;
  recordType: string;
  status: string;
  tags: string[];
  ownerId?: string;
  reviewerId?: string;
  question?: string;
  answer?: string;
  projectSummary?: string;
  deliverables: string[];
  likes: number;
  rating: number;
  ratingCount: number;
  commentCount: number;
};
type Editor = {
  id?: string;
  title: string;
  category: string;
  record_type: string;
  tags: string;
  reviewer_id: string;
  document_id: string;
  content_id: string;
  question: string;
  answer: string;
  project_summary: string;
  deliverables: string;
};
const emptyEditor: Editor = {
  title: "",
  category: "未分類",
  record_type: "document",
  tags: "",
  reviewer_id: "",
  document_id: "",
  content_id: "",
  question: "",
  answer: "",
  project_summary: "",
  deliverables: "",
};

export default function KnowledgeCenterPage() {
  const { t } = useTranslation();
  const { section = "documents" } = useParams();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [discussion, setDiscussion] = useState<RecordItem | null>(null);
  const [comment, setComment] = useState("");
  const [expertOpen, setExpertOpen] = useState(false);
  const [expert, setExpert] = useState({
    display_name: "",
    expertise: "",
    bio: "",
    contact: "",
  });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState({
    name: "",
    description: "",
    color: "#6366f1",
  });
  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-overview"],
    queryFn: knowledgeApi.overview,
  });
  const model = data?.data ?? {
    currentUser: {},
    records: [],
    categories: [],
    experts: [],
    interactions: [],
    users: [],
    documents: [],
    contents: [],
  };
  const current = model.currentUser;
  const { data: commentData } = useQuery({
    queryKey: ["knowledge-comments", discussion?.id],
    queryFn: () => knowledgeApi.comments(discussion!.id),
    enabled: Boolean(discussion),
  });
  const comments = commentData?.data ?? [];
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["knowledge-overview"] });
  const saveRecord = useMutation({
    mutationFn: (payload: any) =>
      editor?.id
        ? knowledgeApi.updateRecord(editor.id, payload)
        : knowledgeApi.createRecord(payload),
    onSuccess: () => {
      refresh();
      setEditor(null);
      toast.success(t("knowledge.saved"));
    },
    onError: (e: any) => toast.error(e.response?.data?.error || t("knowledge.saveFailed")),
  });
  const review = useMutation({
    mutationFn: ({
      id,
      status,
      reviewer_id,
    }: {
      id: string;
      status: string;
      reviewer_id?: string;
    }) => knowledgeApi.reviewRecord(id, { status, reviewer_id }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.response?.data?.error || t("knowledge.reviewFailed")),
  });
  const interact = useMutation({
    mutationFn: (payload: any) => knowledgeApi.interact(payload),
    onSuccess: refresh,
  });
  const addComment = useMutation({
    mutationFn: () =>
      knowledgeApi.addComment(discussion!.id, { content: comment }),
    onSuccess: () => {
      setComment("");
      client.invalidateQueries({ queryKey: ["knowledge-comments"] });
      refresh();
    },
  });
  const saveExpert = useMutation({
    mutationFn: () =>
      knowledgeApi.saveExpert({
        ...expert,
        expertise: expert.expertise
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setExpertOpen(false);
      refresh();
      toast.success(t("knowledge.expertUpdated"));
    },
  });
  const saveCategory = useMutation({
    mutationFn: () => knowledgeApi.createCategory(category),
    onSuccess: () => {
      setCategory({ name: "", description: "", color: "#6366f1" });
      refresh();
    },
  });
  const records = useMemo(
    () =>
      model.records.filter((record: RecordItem) => {
        const hit =
          record.title.toLowerCase().includes(search.toLowerCase()) ||
          record.tags.some((tag) =>
            tag.toLowerCase().includes(search.toLowerCase()),
          );
        if (!hit) return false;
        if (section === "review")
          return ["draft", "pending_review", "rejected"].includes(
            record.status,
          );
        if (section === "faq")
          return ["faq", "project"].includes(record.recordType);
        if (section === "community") return record.status === "approved";
        return true;
      }),
    [model.records, search, section],
  );
  const edit = (record?: RecordItem) =>
    setEditor(
      record
        ? {
          id: record.id,
          title: record.title,
          category: record.category,
          record_type: record.recordType,
          tags: record.tags.join(", "),
          reviewer_id: record.reviewerId || "",
          document_id: record.documentId || "",
          content_id: record.contentId || "",
          question: record.question || "",
          answer: record.answer || "",
          project_summary: record.projectSummary || "",
          deliverables: record.deliverables.join("\n"),
        }
        : emptyEditor,
    );
  const submitRecord = () => {
    if (!editor) return;
    saveRecord.mutate({
      title: editor.title,
      category: editor.category,
      record_type: editor.record_type,
      tags: editor.tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      reviewer_id: editor.reviewer_id || undefined,
      document_id: editor.document_id || undefined,
      content_id: editor.content_id || undefined,
      question: editor.question || undefined,
      answer: editor.answer || undefined,
      project_summary: editor.project_summary || undefined,
      deliverables: editor.deliverables
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    });
  };
  const followed = new Set(
    model.interactions
      .filter((x: any) => x.type === "follow")
      .map((x: any) => x.targetId),
  );
  return (
    <div className="max-w-11xl mx-auto px-4 pb-10">
      <CommonHeroTitle
        icon={Library}
        title={t("knowledge.title")}
        description={t("knowledge.description")}
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          className="input-field min-w-64 flex-1"
          placeholder={t("knowledge.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {section === "documents" && (
          <button
            onClick={() => setCategoryOpen(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <FolderCog className="h-4 w-4" />
            {t("knowledge.categorySettings")}
          </button>
        )}
        {section === "experts" ? (
          <button
            onClick={() => {
              const mine = model.experts.find(
                (x: any) => x.userId === current.id,
              );
              setExpert({
                display_name: mine?.displayName || current.username || "",
                expertise: (mine?.expertise || []).join(", "),
                bio: mine?.bio || "",
                contact: mine?.contact || "",
              });
              setExpertOpen(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Edit3 className="h-4 w-4" />
            {t("knowledge.editMyExpertProfile")}
          </button>
        ) : (
          <button
            onClick={() => edit()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("knowledge.addKnowledge")}
          </button>
        )}
      </div>
      {section === "experts" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {model.experts.map((item: any) => (
            <article className="card" key={item.userId}>
              <UserRoundSearch className="h-9 w-9 text-primary-600" />
              <h2 className="mt-2 font-semibold">{item.displayName}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {item.bio || t("knowledge.noBio")}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {item.expertise.map((tag: string) => (
                  <span
                    className="rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-700"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs">
                <span>{item.contact}</span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Award className="h-4 w-4" />
                  {t("knowledge.points", { count: item.points })}
                </span>
              </div>
            </article>
          ))}
          {!model.experts.length && (
            <div className="card col-span-full py-12 text-center text-gray-500">
              {t("knowledge.noExperts")}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            <p>{t("knowledge.loading")}</p>
          ) : (
            records.map((record: RecordItem) => (
              <article className="card flex flex-col" key={record.id}>
                <div className="flex items-start gap-2">
                  {record.recordType === "faq" ? (
                    <CircleHelp className="h-5 w-5 text-violet-500" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{record.title}</h2>
                    <p className="text-xs text-gray-500">
                      {record.category} · {record.recordType} · {record.status}
                    </p>
                  </div>
                  {record.ownerId === current.id && (
                    <div className="flex gap-2">
                      <button onClick={() => edit(record)} title={t("knowledge.edit")}>
                        <Edit3 className="h-4 w-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() =>
                          window.confirm(t("knowledge.deleteRecord", { title: record.title })) &&
                          knowledgeApi.deleteRecord(record.id).then(refresh)
                        }
                        title={t("knowledge.delete")}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
                {record.question && (
                  <p className="mt-3 text-sm font-medium">
                    Q：{record.question}
                  </p>
                )}
                {record.answer && (
                  <p className="mt-1 line-clamp-3 text-sm text-gray-600">
                    A：{record.answer}
                  </p>
                )}
                {record.projectSummary && (
                  <p className="mt-3 line-clamp-3 text-sm text-gray-600">
                    {record.projectSummary}
                  </p>
                )}
                <div className="my-3 flex flex-wrap gap-1">
                  {record.tags.map((tag) => (
                    <span
                      className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-3 text-xs text-gray-500">
                  <button
                    onClick={() =>
                      interact.mutate({
                        target_id: record.id,
                        interaction_type: "follow",
                      })
                    }
                    className={
                      followed.has(record.id) ? "text-primary-600" : ""
                    }
                  >
                    <Bookmark className="inline h-4 w-4" /> {t("knowledge.follow")}
                  </button>
                  <button
                    onClick={() =>
                      interact.mutate({
                        target_id: record.id,
                        interaction_type: "like",
                        score: 1,
                      })
                    }
                  >
                    <Star className="inline h-4 w-4" /> {record.likes}
                  </button>
                  <button onClick={() => setDiscussion(record)}>
                    <MessageSquare className="inline h-4 w-4" />{" "}
                    {record.commentCount}
                  </button>
                  <span className="ml-auto">
                    ★ {record.rating.toFixed(1)} ({record.ratingCount})
                  </span>
                </div>
                {section === "review" &&
                  record.ownerId === current.id &&
                  record.status !== "pending_review" && (
                    <button
                      onClick={() =>
                        review.mutate({
                          id: record.id,
                          status: "pending_review",
                          reviewer_id: record.reviewerId,
                        })
                      }
                      disabled={!record.reviewerId}
                      className="btn-primary mt-3 disabled:opacity-50"
                    >
                       {t("knowledge.submitToReviewer")}
                     </button>
                  )}
              </article>
            ))
          )}
          {!records.length && (
            <div className="card col-span-full py-12 text-center text-gray-500">
              {t("knowledge.noContent")}
             </div>
          )}
        </div>
      )}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 dark:bg-gray-900">
            <div className="mb-4 flex justify-between">
              <h2 className="font-semibold">
                {editor.id ? t("knowledge.editKnowledge") : t("knowledge.addKnowledgeTitle")}
              </h2>
              <button onClick={() => setEditor(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input-field md:col-span-2"
                placeholder={t("knowledge.titleField")}
                value={editor.title}
                onChange={(e) =>
                  setEditor({ ...editor, title: e.target.value })
                }
              />
              <select
                className="input-field"
                value={editor.record_type}
                onChange={(e) =>
                  setEditor({ ...editor, record_type: e.target.value })
                }
              >
                <option value="document">{t("knowledge.document")}</option>
                <option value="faq">{t("knowledge.faq")}</option>
                <option value="project">{t("knowledge.project")}</option>
              </select>
              <select
                className="input-field"
                value={editor.category}
                onChange={(e) =>
                  setEditor({ ...editor, category: e.target.value })
                }
              >
                <option value="未分類">{t("knowledge.uncategorized")}</option>
                {model.categories.map((x: any) => (
                  <option key={x.id}>{x.name}</option>
                ))}
              </select>
              <input
                className="input-field md:col-span-2"
                placeholder={t("knowledge.tagsPlaceholder")}
                value={editor.tags}
                onChange={(e) => setEditor({ ...editor, tags: e.target.value })}
              />
              <select
                className="input-field"
                value={editor.document_id}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    document_id: e.target.value,
                    content_id: "",
                  })
                }
              >
                <option value="">{t("knowledge.noLinkDocument")}</option>
                {model.documents.map((x: any) => (
                  <option value={x.id} key={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
              <select
                className="input-field"
                value={editor.content_id}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    content_id: e.target.value,
                    document_id: "",
                  })
                }
              >
                <option value="">{t("knowledge.noLinkContent")}</option>
                {model.contents.map((x: any) => (
                  <option value={x.id} key={x.id}>
                    {x.title} ({x.status})
                  </option>
                ))}
              </select>
              <select
                className="input-field md:col-span-2"
                value={editor.reviewer_id}
                onChange={(e) =>
                  setEditor({ ...editor, reviewer_id: e.target.value })
                }
              >
                <option value="">{t("knowledge.selectReviewer")}</option>
                {model.users
                  .filter((x: any) => x.id !== current.id)
                  .map((x: any) => (
                    <option value={x.id} key={x.id}>
                      {x.username} ({x.role})
                    </option>
                  ))}
              </select>
              {editor.record_type === "faq" && (
                <>
                  <textarea
                    className="input-field md:col-span-2"
                    placeholder={t("knowledge.faqQuestion")}
                    value={editor.question}
                    onChange={(e) =>
                      setEditor({ ...editor, question: e.target.value })
                    }
                  />
                  <textarea
                    className="input-field min-h-32 md:col-span-2"
                    placeholder={t("knowledge.standardAnswer")}
                    value={editor.answer}
                    onChange={(e) =>
                      setEditor({ ...editor, answer: e.target.value })
                    }
                  />
                </>
              )}
              {editor.record_type === "project" && (
                <>
                  <textarea
                    className="input-field min-h-32 md:col-span-2"
                    placeholder={t("knowledge.projectSummary")}
                    value={editor.project_summary}
                    onChange={(e) =>
                      setEditor({ ...editor, project_summary: e.target.value })
                    }
                  />
                  <textarea
                    className="input-field md:col-span-2"
                    placeholder={t("knowledge.deliverables")}
                    value={editor.deliverables}
                    onChange={(e) =>
                      setEditor({ ...editor, deliverables: e.target.value })
                    }
                  />
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditor(null)}>
                {t("knowledge.cancel")}
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                disabled={!editor.title.trim()}
                onClick={submitRecord}
              >
                <Save className="h-4 w-4" />
                {t("knowledge.saveDraft")}
              </button>
            </div>
          </div>
        </div>
      )}
      {categoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 dark:bg-gray-900">
            <div className="flex justify-between">
              <h2 className="font-semibold">{t("knowledge.categorySettingsTitle")}</h2>
              <button onClick={() => setCategoryOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="my-4 space-y-2">
              {model.categories.map((item: any) => (
                <div
                  className="flex items-center rounded border p-2 dark:border-gray-700"
                  key={item.id}
                >
                  <span
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span>{item.name}</span>
                  {current.role === "admin" && (
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => {
                          const name = window.prompt(t("knowledge.categoryName"), item.name);
                          if (name)
                            knowledgeApi
                              .updateCategory(item.id, {
                                name,
                                description: item.description,
                                color: item.color,
                              })
                              .then(refresh);
                        }}
                      >
                        <Edit3 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() =>
                          confirm(t("knowledge.confirmDeleteCategory", { name: item.name })) &&
                          knowledgeApi.deleteCategory(item.id).then(refresh)
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <input
              className="input-field mb-2"
              placeholder={t("knowledge.categoryName")}
              value={category.name}
              onChange={(e) =>
                setCategory({ ...category, name: e.target.value })
              }
            />
            <input
              className="input-field mb-2"
              placeholder={t("knowledge.categoryDescription")}
              value={category.description}
              onChange={(e) =>
                setCategory({ ...category, description: e.target.value })
              }
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={category.color}
                onChange={(e) =>
                  setCategory({ ...category, color: e.target.value })
                }
              />
              <button
                className="btn-primary ml-auto"
                disabled={!category.name.trim()}
                onClick={() => saveCategory.mutate()}
              >
                {t("knowledge.addCategory")}
              </button>
            </div>
          </div>
        </div>
      )}
      {expertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 dark:bg-gray-900">
            <div className="flex justify-between">
              <h2 className="font-semibold">{t("knowledge.myExpertProfile")}</h2>
              <button onClick={() => setExpertOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                className="input-field"
                placeholder={t("knowledge.displayName")}
                value={expert.display_name}
                onChange={(e) =>
                  setExpert({ ...expert, display_name: e.target.value })
                }
              />
              <input
                className="input-field"
                placeholder={t("knowledge.expertise")}
                value={expert.expertise}
                onChange={(e) =>
                  setExpert({ ...expert, expertise: e.target.value })
                }
              />
              <textarea
                className="input-field"
                placeholder={t("knowledge.bio")}
                value={expert.bio}
                onChange={(e) => setExpert({ ...expert, bio: e.target.value })}
              />
              <input
                className="input-field"
                placeholder={t("knowledge.contact")}
                value={expert.contact}
                onChange={(e) =>
                  setExpert({ ...expert, contact: e.target.value })
                }
              />
            </div>
            <button
              className="btn-primary mt-4 w-full"
              onClick={() => saveExpert.mutate()}
            >
              {t("knowledge.saveExpertProfile")}
            </button>
          </div>
        </div>
      )}
      {discussion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 dark:bg-gray-900">
            <div className="flex justify-between">
              <div>
                <h2 className="font-semibold">{discussion.title}</h2>
                <p className="text-xs text-gray-500">{t("knowledge.discussionSubtitle")}</p>
              </div>
              <button onClick={() => setDiscussion(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="my-4 flex gap-1">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  onClick={() =>
                    interact.mutate({
                      target_id: discussion.id,
                      interaction_type: "rating",
                      score,
                    })
                  }
                  className="text-amber-500"
                >
                  <Star
                    className="h-6 w-6"
                    fill={
                      model.interactions.find(
                        (x: any) =>
                          x.targetId === discussion.id && x.type === "rating",
                      )?.score >= score
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              ))}
            </div>
            <div className="flex-1 space-y-2 overflow-auto">
              {comments.map((item: any) => (
                <div
                  className={`rounded-lg border p-3 dark:border-gray-700 ${item.isBest ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
                  key={item.id}
                >
                  <div className="flex text-xs text-gray-500">
                    <strong>{item.username}</strong>
                    {item.isBest && (
                      <span className="ml-2 text-emerald-600">{t("knowledge.bestAnswer")}</span>
                    )}
                    {discussion.ownerId === current.id && !item.isBest && (
                      <button
                        className="ml-auto text-primary-600"
                        onClick={() =>
                          knowledgeApi
                            .bestAnswer(discussion.id, item.id)
                            .then(() =>
                              client.invalidateQueries({
                                queryKey: ["knowledge-comments"],
                              }),
                            )
                        }
                      >
                        {t("knowledge.setAsBestAnswer")}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{item.content}</p>
                </div>
              ))}
              {!comments.length && (
                <p className="py-8 text-center text-gray-500">{t("knowledge.noComments")}</p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                className="input-field"
                placeholder={t("knowledge.commentPlaceholder")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && comment.trim() && addComment.mutate()
                }
              />
              <button
                className="btn-primary"
                disabled={!comment.trim()}
                onClick={() => addComment.mutate()}
              >
                {t("knowledge.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
