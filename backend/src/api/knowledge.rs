use crate::core::state::AppState;
use crate::errors::AppError;
use cortex_lib::utils::generate_id;
use eiva_be_security::jwt::{verify_token, Claims};
use salvo::prelude::*;
use serde::Deserialize;
use sqlx::Row;

#[derive(Deserialize)]
struct RecordRequest {
    document_id: Option<String>,
    content_id: Option<String>,
    title: String,
    category: Option<String>,
    record_type: Option<String>,
    workflow_status: Option<String>,
    tags: Option<Vec<String>>,
    reviewer_id: Option<String>,
    question: Option<String>,
    answer: Option<String>,
    project_summary: Option<String>,
    deliverables: Option<Vec<String>>,
}
#[derive(Deserialize)]
struct InteractionRequest {
    target_id: String,
    interaction_type: String,
    score: Option<i64>,
    comment: Option<String>,
}
#[derive(Deserialize)]
struct ExpertRequest {
    display_name: String,
    expertise: Vec<String>,
    bio: Option<String>,
    contact: Option<String>,
}
#[derive(Deserialize)]
struct ReviewRequest {
    status: String,
    reviewer_id: Option<String>,
    comment: Option<String>,
}
#[derive(Deserialize)]
struct CategoryRequest {
    name: String,
    description: Option<String>,
    color: Option<String>,
}
#[derive(Deserialize)]
struct CommentRequest {
    content: String,
    parent_id: Option<String>,
}
#[derive(Deserialize)]
struct BestAnswerRequest {
    comment_id: String,
}

fn claims(req: &Request, state: &AppState) -> Result<Claims, AppError> {
    let header = req
        .headers()
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".into()))?;
    let token = header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid Authorization header".into()))?;
    verify_token(token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired token".into()))
}

fn record_json(row: &sqlx::any::AnyRow) -> serde_json::Value {
    serde_json::json!({
        "id":row.get::<String,_>("id"), "documentId":row.try_get::<String,_>("document_id").ok(),
        "contentId":row.try_get::<String,_>("content_id").ok(), "title":row.get::<String,_>("title"),
        "category":row.get::<String,_>("category"), "recordType":row.get::<String,_>("record_type"),
        "status":row.get::<String,_>("workflow_status"),
        "tags":row.try_get::<String,_>("tags").ok().and_then(|value|serde_json::from_str::<serde_json::Value>(&value).ok()).unwrap_or(serde_json::json!([])),
        "ownerId":row.try_get::<String,_>("owner_id").ok(), "reviewerId":row.try_get::<String,_>("reviewer_id").ok(),
        "question":row.try_get::<String,_>("question").ok(), "answer":row.try_get::<String,_>("answer").ok(),
        "projectSummary":row.try_get::<String,_>("project_summary").ok(),
        "deliverables":row.try_get::<String,_>("deliverables").ok().and_then(|value|serde_json::from_str::<serde_json::Value>(&value).ok()).unwrap_or(serde_json::json!([])),
        "likes":row.try_get::<i64,_>("likes").unwrap_or(0), "rating":row.try_get::<f64,_>("rating").unwrap_or(0.0),
        "ratingCount":row.try_get::<i64,_>("rating_count").unwrap_or(0), "commentCount":row.try_get::<i64,_>("comment_count").unwrap_or(0),
        "updatedAt":row.try_get::<String,_>("updated_at").ok()
    })
}

async fn query_records(state: &AppState) -> Result<Vec<serde_json::Value>, AppError> {
    let rows=sqlx::query("SELECT r.id,r.document_id,r.content_id,r.title,r.category,r.record_type,r.workflow_status,r.tags,r.owner_id,r.reviewer_id,r.updated_at,d.question,d.answer,d.project_summary,d.deliverables,(SELECT COUNT(*) FROM knowledge_interactions i WHERE i.target_id=r.id AND i.interaction_type='like') likes,(SELECT COALESCE(AVG(i.score),0) FROM knowledge_interactions i WHERE i.target_id=r.id AND i.interaction_type='rating') rating,(SELECT COUNT(*) FROM knowledge_interactions i WHERE i.target_id=r.id AND i.interaction_type='rating') rating_count,(SELECT COUNT(*) FROM knowledge_comments c WHERE c.record_id=r.id) comment_count FROM knowledge_records r LEFT JOIN knowledge_details d ON d.record_id=r.id ORDER BY r.updated_at DESC").fetch_all(&state.db.pool).await?;
    Ok(rows.iter().map(record_json).collect())
}

#[handler]
async fn overview(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let records = query_records(state).await?;
    let categories=sqlx::query("SELECT id,name,description,color FROM knowledge_categories ORDER BY name").fetch_all(&state.db.pool).await?.into_iter().map(|r|serde_json::json!({"id":r.get::<String,_>("id"),"name":r.get::<String,_>("name"),"description":r.try_get::<String,_>("description").ok(),"color":r.try_get::<String,_>("color").ok()})).collect::<Vec<_>>();
    let experts=sqlx::query("SELECT user_id,display_name,expertise,bio,contact,contribution_points FROM expert_profiles ORDER BY contribution_points DESC").fetch_all(&state.db.pool).await?.into_iter().map(|r|serde_json::json!({"userId":r.get::<String,_>("user_id"),"displayName":r.get::<String,_>("display_name"),"expertise":serde_json::from_str::<serde_json::Value>(&r.get::<String,_>("expertise")).unwrap_or(serde_json::json!([])),"bio":r.try_get::<String,_>("bio").ok(),"contact":r.try_get::<String,_>("contact").ok(),"points":r.get::<i64,_>("contribution_points")})).collect::<Vec<_>>();
    let interactions=sqlx::query("SELECT target_id,interaction_type,score,comment FROM knowledge_interactions WHERE user_id=?").bind(&identity.sub).fetch_all(&state.db.pool).await?.into_iter().map(|r|serde_json::json!({"targetId":r.get::<String,_>("target_id"),"type":r.get::<String,_>("interaction_type"),"score":r.try_get::<i64,_>("score").ok(),"comment":r.try_get::<String,_>("comment").ok()})).collect::<Vec<_>>();
    let point_events=sqlx::query("SELECT points,reason,target_id,created_at FROM knowledge_point_events WHERE user_id=? ORDER BY created_at DESC").bind(&identity.sub).fetch_all(&state.db.pool).await?.into_iter().map(|r|serde_json::json!({"points":r.get::<i64,_>("points"),"reason":r.get::<String,_>("reason"),"targetId":r.try_get::<String,_>("target_id").ok(),"createdAt":r.try_get::<String,_>("created_at").ok()})).collect::<Vec<_>>();
    let mut users=sqlx::query("SELECT id,username,email,role FROM users WHERE is_active=1 ORDER BY username").fetch_all(&state.db.pool).await.unwrap_or_default().into_iter().map(|r|serde_json::json!({"id":r.get::<String,_>("id"),"username":r.get::<String,_>("username"),"email":r.get::<String,_>("email"),"role":r.get::<String,_>("role")})).collect::<Vec<_>>();
    if !users
        .iter()
        .any(|user| user["id"].as_str() == Some(identity.sub.as_str()))
    {
        users.push(serde_json::json!({"id":identity.sub.clone(),"username":identity.username.clone(),"email":"","role":identity.role.clone()}));
    }
    let documents=sqlx::query("SELECT id,filename,status FROM documents ORDER BY created_at DESC").fetch_all(&state.db.pool).await?.into_iter().map(|r|serde_json::json!({"id":r.get::<String,_>("id"),"title":r.get::<String,_>("filename"),"status":r.get::<String,_>("status"),"kind":"document"})).collect::<Vec<_>>();
    let contents=sqlx::query("SELECT id,title,content_kind,current_version FROM content_items ORDER BY updated_at DESC").fetch_all(&state.db.pool).await?.into_iter().map(|r|serde_json::json!({"id":r.get::<String,_>("id"),"title":r.get::<String,_>("title"),"status":format!("v{}",r.get::<i64,_>("current_version")),"kind":r.get::<String,_>("content_kind")})).collect::<Vec<_>>();
    Ok(Json(
        serde_json::json!({"currentUser":{"id":identity.sub,"username":identity.username,"role":identity.role},"records":records,"categories":categories,"experts":experts,"interactions":interactions,"pointEvents":point_events,"users":users,"documents":documents,"contents":contents}),
    ))
}

async fn save_details(state: &AppState, id: &str, body: &RecordRequest) -> Result<(), AppError> {
    sqlx::query("DELETE FROM knowledge_details WHERE record_id=?")
        .bind(id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("INSERT INTO knowledge_details (record_id,question,answer,project_summary,deliverables) VALUES (?,?,?,?,?)").bind(id).bind(&body.question).bind(&body.answer).bind(&body.project_summary).bind(serde_json::to_string(&body.deliverables.clone().unwrap_or_default()).unwrap()).execute(&state.db.pool).await?;
    Ok(())
}

#[handler]
async fn create_record(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let body = req
        .parse_json::<RecordRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Title is required".into()));
    }
    if let Some(ref id) = body.document_id {
        crate::db::repository::document_repo::DocumentRepo::find_by_id(&state.db.pool, id).await?;
    }
    if let Some(ref id) = body.content_id {
        if sqlx::query("SELECT id FROM content_items WHERE id=?")
            .bind(id)
            .fetch_optional(&state.db.pool)
            .await?
            .is_none()
        {
            return Err(AppError::NotFound("Content item not found".into()));
        }
    }
    let id = generate_id();
    let reviewer = body.reviewer_id.as_deref().unwrap_or(identity.sub.as_str());
    sqlx::query("INSERT INTO knowledge_records (id,document_id,content_id,title,category,record_type,workflow_status,tags,owner_id,reviewer_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").bind(&id).bind(&body.document_id).bind(&body.content_id).bind(body.title.trim()).bind(body.category.clone().unwrap_or_else(||"未分類".into())).bind(body.record_type.clone().unwrap_or_else(||"document".into())).bind(body.workflow_status.clone().unwrap_or_else(||"draft".into())).bind(serde_json::to_string(&body.tags.clone().unwrap_or_default()).unwrap()).bind(&identity.sub).bind(reviewer).execute(&state.db.pool).await?;
    save_details(state, &id, &body).await?;
    Ok(Json(serde_json::json!({"id":id})))
}

#[handler]
async fn update_record(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing id".into()))?;
    let owner = sqlx::query("SELECT owner_id FROM knowledge_records WHERE id=?")
        .bind(&id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Record not found".into()))?
        .try_get::<String, _>("owner_id")
        .unwrap_or_default();
    if owner != identity.sub && identity.role != "admin" {
        return Err(AppError::Unauthorized("Only owner can edit".into()));
    }
    let body = req
        .parse_json::<RecordRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    sqlx::query("UPDATE knowledge_records SET document_id=?,content_id=?,title=?,category=?,record_type=?,tags=?,reviewer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(&body.document_id).bind(&body.content_id).bind(body.title.trim()).bind(body.category.clone().unwrap_or_else(||"未分類".into())).bind(body.record_type.clone().unwrap_or_else(||"document".into())).bind(serde_json::to_string(&body.tags.clone().unwrap_or_default()).unwrap()).bind(&body.reviewer_id).bind(&id).execute(&state.db.pool).await?;
    save_details(state, &id, &body).await?;
    Ok(Json(serde_json::json!({"updated":true})))
}

#[handler]
async fn review_record(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing id".into()))?;
    let body = req
        .parse_json::<ReviewRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    if !["draft", "pending_review", "approved", "rejected"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest("Invalid status".into()));
    }
    let row = sqlx::query(
        "SELECT owner_id,reviewer_id,workflow_status FROM knowledge_records WHERE id=?",
    )
    .bind(&id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Record not found".into()))?;
    let owner = row.try_get::<String, _>("owner_id").unwrap_or_default();
    let reviewer = row.try_get::<String, _>("reviewer_id").unwrap_or_default();
    if body.status == "pending_review" && owner != identity.sub && identity.role != "admin" {
        return Err(AppError::Unauthorized("Only owner can submit".into()));
    }
    if ["approved", "rejected"].contains(&body.status.as_str())
        && reviewer != identity.sub
        && identity.role != "admin"
    {
        return Err(AppError::Unauthorized(
            "Only assigned reviewer can review".into(),
        ));
    }
    let assigned = body.reviewer_id.as_deref().unwrap_or(&reviewer);
    if body.status == "pending_review" && assigned.is_empty() {
        return Err(AppError::BadRequest("Reviewer is required".into()));
    }
    sqlx::query("UPDATE knowledge_records SET workflow_status=?,reviewer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(&body.status).bind(assigned).bind(&id).execute(&state.db.pool).await?;
    if body.status == "approved" {
        sqlx::query("INSERT INTO knowledge_point_events (id,user_id,points,reason,target_id,created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)").bind(generate_id()).bind(&owner).bind(10i64).bind(body.comment.unwrap_or_else(||"知識審核通過".into())).bind(&id).execute(&state.db.pool).await?;
        sqlx::query(
            "UPDATE expert_profiles SET contribution_points=contribution_points+10 WHERE user_id=?",
        )
        .bind(&owner)
        .execute(&state.db.pool)
        .await?;
    }
    Ok(Json(
        serde_json::json!({"updated":true,"status":body.status}),
    ))
}

#[handler]
async fn interact(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let body = req
        .parse_json::<InteractionRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    if !["follow", "like", "rating"].contains(&body.interaction_type.as_str()) {
        return Err(AppError::BadRequest("Invalid interaction type".into()));
    }
    if body.interaction_type == "rating" && !matches!(body.score, Some(1..=5)) {
        return Err(AppError::BadRequest("Rating must be 1-5".into()));
    }
    let existed = sqlx::query("SELECT id FROM knowledge_interactions WHERE user_id=? AND target_id=? AND interaction_type=?")
        .bind(&identity.sub).bind(&body.target_id).bind(&body.interaction_type)
        .fetch_optional(&state.db.pool).await?.is_some();
    sqlx::query(
        "DELETE FROM knowledge_interactions WHERE user_id=? AND target_id=? AND interaction_type=?",
    )
    .bind(&identity.sub)
    .bind(&body.target_id)
    .bind(&body.interaction_type)
    .execute(&state.db.pool)
    .await?;
    if existed && body.interaction_type != "rating" {
        return Ok(Json(serde_json::json!({"saved":true,"active":false})));
    }
    sqlx::query("INSERT INTO knowledge_interactions (id,user_id,target_id,interaction_type,score,comment,created_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)").bind(generate_id()).bind(&identity.sub).bind(&body.target_id).bind(&body.interaction_type).bind(body.score).bind(body.comment).execute(&state.db.pool).await?;
    Ok(Json(serde_json::json!({"saved":true,"active":true})))
}

#[handler]
async fn delete_record(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing id".into()))?;
    let row = sqlx::query("SELECT owner_id FROM knowledge_records WHERE id=?")
        .bind(&id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Record not found".into()))?;
    let owner = row.try_get::<String, _>("owner_id").unwrap_or_default();
    if owner != identity.sub && identity.role != "admin" {
        return Err(AppError::Unauthorized("Only owner can delete".into()));
    }
    sqlx::query("DELETE FROM knowledge_comments WHERE record_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM knowledge_interactions WHERE target_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM knowledge_details WHERE record_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM knowledge_records WHERE id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    Ok(Json(serde_json::json!({"deleted":true})))
}

#[handler]
async fn comments(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    claims(req, state)?;
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing id".into()))?;
    let rows=sqlx::query("SELECT id,user_id,username,content,parent_id,is_best,created_at FROM knowledge_comments WHERE record_id=? ORDER BY created_at").bind(id).fetch_all(&state.db.pool).await?;
    Ok(Json(serde_json::json!(rows.into_iter().map(|r|serde_json::json!({"id":r.get::<String,_>("id"),"userId":r.get::<String,_>("user_id"),"username":r.get::<String,_>("username"),"content":r.get::<String,_>("content"),"parentId":r.try_get::<String,_>("parent_id").ok(),"isBest":r.get::<i64,_>("is_best")!=0,"createdAt":r.try_get::<String,_>("created_at").ok()})).collect::<Vec<_>>())))
}
#[handler]
async fn add_comment(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing id".into()))?;
    let body = req
        .parse_json::<CommentRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    if body.content.trim().is_empty() {
        return Err(AppError::BadRequest("Comment is empty".into()));
    }
    let cid = generate_id();
    sqlx::query("INSERT INTO knowledge_comments (id,record_id,user_id,username,content,parent_id,is_best,created_at,updated_at) VALUES (?,?,?,?,?,?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").bind(&cid).bind(id).bind(&identity.sub).bind(&identity.username).bind(body.content.trim()).bind(body.parent_id).execute(&state.db.pool).await?;
    Ok(Json(serde_json::json!({"id":cid})))
}
#[handler]
async fn best_answer(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing id".into()))?;
    let body = req
        .parse_json::<BestAnswerRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    let owner = sqlx::query("SELECT owner_id FROM knowledge_records WHERE id=?")
        .bind(&id)
        .fetch_one(&state.db.pool)
        .await?
        .try_get::<String, _>("owner_id")
        .unwrap_or_default();
    if owner != identity.sub && identity.role != "admin" {
        return Err(AppError::Unauthorized(
            "Only owner can choose best answer".into(),
        ));
    }
    sqlx::query("UPDATE knowledge_comments SET is_best=0 WHERE record_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("UPDATE knowledge_comments SET is_best=1 WHERE id=? AND record_id=?")
        .bind(&body.comment_id)
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    if let Some(answer) =
        sqlx::query("SELECT user_id FROM knowledge_comments WHERE id=? AND record_id=?")
            .bind(&body.comment_id)
            .bind(&id)
            .fetch_optional(&state.db.pool)
            .await?
    {
        let answer_user = answer.get::<String, _>("user_id");
        sqlx::query("INSERT INTO knowledge_point_events (id,user_id,points,reason,target_id,created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)").bind(generate_id()).bind(&answer_user).bind(5i64).bind("回答獲選為最佳解").bind(&id).execute(&state.db.pool).await?;
        sqlx::query(
            "UPDATE expert_profiles SET contribution_points=contribution_points+5 WHERE user_id=?",
        )
        .bind(answer_user)
        .execute(&state.db.pool)
        .await?;
    }
    Ok(Json(serde_json::json!({"saved":true})))
}

#[handler]
async fn save_expert(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let body = req
        .parse_json::<ExpertRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    sqlx::query("DELETE FROM expert_profiles WHERE user_id=?")
        .bind(&identity.sub)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("INSERT INTO expert_profiles (user_id,display_name,expertise,bio,contact,contribution_points,updated_at) VALUES (?,?,?,?,?,COALESCE((SELECT SUM(points) FROM knowledge_point_events WHERE user_id=?),0),CURRENT_TIMESTAMP)").bind(&identity.sub).bind(body.display_name).bind(serde_json::to_string(&body.expertise).unwrap()).bind(body.bio).bind(body.contact).bind(&identity.sub).execute(&state.db.pool).await?;
    Ok(Json(serde_json::json!({"saved":true})))
}

#[handler]
async fn create_category(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    let body = req
        .parse_json::<CategoryRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name is required".into()));
    }
    let id = generate_id();
    sqlx::query("INSERT INTO knowledge_categories (id,name,description,color,created_by,created_at,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").bind(&id).bind(body.name.trim()).bind(body.description).bind(body.color).bind(identity.sub).execute(&state.db.pool).await?;
    Ok(Json(serde_json::json!({"id":id})))
}
#[handler]
async fn update_category(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    if identity.role != "admin" {
        return Err(AppError::Unauthorized("Admin required".into()));
    }
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing id".into()))?;
    let body = req
        .parse_json::<CategoryRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    sqlx::query("UPDATE knowledge_categories SET name=?,description=?,color=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.name).bind(body.description).bind(body.color).bind(id).execute(&state.db.pool).await?;
    Ok(Json(serde_json::json!({"updated":true})))
}
#[handler]
async fn delete_category(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = claims(req, state)?;
    if identity.role != "admin" {
        return Err(AppError::Unauthorized("Admin required".into()));
    }
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing id".into()))?;
    let row = sqlx::query("SELECT name FROM knowledge_categories WHERE id=?")
        .bind(&id)
        .fetch_one(&state.db.pool)
        .await?;
    let name = row.get::<String, _>("name");
    let used = sqlx::query("SELECT id FROM knowledge_records WHERE category=?")
        .bind(&name)
        .fetch_optional(&state.db.pool)
        .await?
        .is_some();
    if used {
        return Err(AppError::Conflict("Category is in use".into()));
    }
    sqlx::query("DELETE FROM knowledge_categories WHERE id=?")
        .bind(id)
        .execute(&state.db.pool)
        .await?;
    Ok(Json(serde_json::json!({"deleted":true})))
}

pub fn router() -> Router {
    Router::with_path("knowledge")
        .push(Router::with_path("overview").get(overview))
        .push(Router::with_path("records").post(create_record))
        .push(
            Router::with_path("records/<id>")
                .put(update_record)
                .delete(delete_record),
        )
        .push(Router::with_path("records/<id>/review").put(review_record))
        .push(
            Router::with_path("records/<id>/comments")
                .get(comments)
                .post(add_comment),
        )
        .push(Router::with_path("records/<id>/best-answer").put(best_answer))
        .push(Router::with_path("interactions").post(interact))
        .push(Router::with_path("experts").post(save_expert))
        .push(Router::with_path("categories").post(create_category))
        .push(
            Router::with_path("categories/<id>")
                .put(update_category)
                .delete(delete_category),
        )
}
