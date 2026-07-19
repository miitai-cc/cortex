//! Internal team communication and issue tracking.
//!
//! This module intentionally has no Slack integration. It provides the collaboration
//! capabilities directly from Cortex and keeps all messages and issues in its database.

use crate::core::state::AppState;
use crate::errors::AppError;
use cortex_lib::utils::generate_id;
use eiva_be_security::jwt::{verify_token, Claims};
use futures_util::{SinkExt, StreamExt};
use salvo::prelude::*;
use salvo::websocket::{Message, WebSocketUpgrade};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use sqlx::Row;
use std::collections::{BTreeMap, HashMap};
use std::sync::{Mutex, OnceLock};
use tokio::sync::broadcast;

static CHANNEL_BUSES: OnceLock<Mutex<HashMap<String, broadcast::Sender<String>>>> = OnceLock::new();

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRequest {
    name: String,
    description: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChannelRequest {
    workspace_id: String,
    name: String,
    description: Option<String>,
    is_private: Option<bool>,
    member_ids: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MemberRequest {
    user_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MessageRequest {
    content: String,
    parent_id: Option<String>,
    issue_id: Option<String>,
}

#[derive(Deserialize)]
struct ReactionRequest {
    emoji: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IssueRequest {
    title: String,
    description: Option<String>,
    issue_type: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    assignee_id: Option<String>,
    channel_id: Option<String>,
    due_date: Option<String>,
    labels: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct CommentRequest {
    content: String,
}

fn authentication(req: &Request, state: &AppState) -> Result<Claims, AppError> {
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

fn websocket_authentication(req: &Request, state: &AppState) -> Result<Claims, AppError> {
    let token = req
        .query::<String>("token")
        .ok_or_else(|| AppError::Unauthorized("Missing WebSocket token".into()))?;
    verify_token(&token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired token".into()))
}

async fn request_body<T: DeserializeOwned>(req: &mut Request) -> Result<T, AppError> {
    req.parse_json::<T>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))
}

fn path_id(req: &Request, name: &str) -> Result<String, AppError> {
    req.param::<String>(name)
        .ok_or_else(|| AppError::BadRequest(format!("Missing {name}")))
}

fn channel_bus(channel_id: &str) -> broadcast::Sender<String> {
    let buses = CHANNEL_BUSES.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = buses.lock().expect("collaboration bus lock poisoned");
    guard
        .entry(channel_id.to_string())
        .or_insert_with(|| broadcast::channel(256).0)
        .clone()
}

fn emit(channel_id: &str, event: serde_json::Value) {
    if let Ok(payload) = serde_json::to_string(&event) {
        let _ = channel_bus(channel_id).send(payload);
    }
}

fn clean_name(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || character == '-' || character == '_' {
                character
            } else if character.is_whitespace() {
                '-'
            } else {
                '\0'
            }
        })
        .filter(|character| *character != '\0')
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn mentions(content: &str) -> Vec<String> {
    let mut result = Vec::new();
    for part in content.split_whitespace() {
        if let Some(candidate) = part.strip_prefix('@') {
            let name = candidate
                .trim_matches(|character: char| {
                    !(character.is_alphanumeric()
                        || character == '_'
                        || character == '-'
                        || character == '.')
                })
                .to_string();
            if !name.is_empty() && !result.contains(&name) {
                result.push(name);
            }
        }
    }
    result
}

async fn channel_access(
    state: &AppState,
    identity: &Claims,
    channel_id: &str,
) -> Result<sqlx::any::AnyRow, AppError> {
    let channel = sqlx::query(
        "SELECT id,workspace_id,name,description,is_private,created_by,\
         CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at \
         FROM collaboration_channels WHERE id=?",
    )
    .bind(channel_id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Channel not found".into()))?;
    let is_private = channel.try_get::<i64, _>("is_private").unwrap_or(0) != 0;
    if !is_private
        || identity.role == "admin"
        || channel.get::<String, _>("created_by") == identity.sub
    {
        return Ok(channel);
    }
    let is_member = sqlx::query(
        "SELECT channel_id FROM collaboration_channel_members WHERE channel_id=? AND user_id=?",
    )
    .bind(channel_id)
    .bind(&identity.sub)
    .fetch_optional(&state.db.pool)
    .await?
    .is_some();
    if is_member {
        Ok(channel)
    } else {
        Err(AppError::Unauthorized(
            "You are not a member of this private channel".into(),
        ))
    }
}

async fn channel_management(
    state: &AppState,
    identity: &Claims,
    channel_id: &str,
) -> Result<sqlx::any::AnyRow, AppError> {
    let channel = channel_access(state, identity, channel_id).await?;
    let member_role = sqlx::query(
        "SELECT role FROM collaboration_channel_members WHERE channel_id=? AND user_id=?",
    )
    .bind(channel_id)
    .bind(&identity.sub)
    .fetch_optional(&state.db.pool)
    .await?
    .and_then(|row| row.try_get::<String, _>("role").ok());
    if identity.role == "admin"
        || channel.get::<String, _>("created_by") == identity.sub
        || member_role.as_deref() == Some("owner")
    {
        Ok(channel)
    } else {
        Err(AppError::Unauthorized(
            "Only channel owners can manage this channel".into(),
        ))
    }
}

async fn workspace_management(
    state: &AppState,
    identity: &Claims,
    workspace_id: &str,
) -> Result<sqlx::any::AnyRow, AppError> {
    let workspace = sqlx::query(
        "SELECT id,name,description,created_by,CAST(created_at AS TEXT) AS created_at,\
         CAST(updated_at AS TEXT) AS updated_at \
         FROM collaboration_workspaces WHERE id=?",
    )
    .bind(workspace_id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;
    if identity.role == "admin" || workspace.get::<String, _>("created_by") == identity.sub {
        Ok(workspace)
    } else {
        Err(AppError::Unauthorized(
            "Only workspace owners can manage this workspace".into(),
        ))
    }
}

async fn ensure_default_workspace(state: &AppState, identity: &Claims) -> Result<(), AppError> {
    let exists = sqlx::query("SELECT id FROM collaboration_workspaces LIMIT 1")
        .fetch_optional(&state.db.pool)
        .await?
        .is_some();
    if exists {
        return Ok(());
    }
    let workspace_id = generate_id();
    let channel_id = generate_id();
    sqlx::query(
        "INSERT INTO collaboration_workspaces \
         (id,name,description,created_by,created_at,updated_at) \
         VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
    )
    .bind(&workspace_id)
    .bind("Cortex 團隊")
    .bind("企業內部協作空間")
    .bind(&identity.sub)
    .execute(&state.db.pool)
    .await?;
    sqlx::query(
        "INSERT INTO collaboration_channels \
         (id,workspace_id,name,description,is_private,created_by,created_at,updated_at) \
         VALUES (?,?,?,?,0,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
    )
    .bind(&channel_id)
    .bind(&workspace_id)
    .bind("general")
    .bind("所有成員的公開討論頻道")
    .bind(&identity.sub)
    .execute(&state.db.pool)
    .await?;
    sqlx::query(
        "INSERT INTO collaboration_channel_members (channel_id,user_id,role,last_read_at) \
         VALUES (?,?,?,CURRENT_TIMESTAMP)",
    )
    .bind(&channel_id)
    .bind(&identity.sub)
    .bind("owner")
    .execute(&state.db.pool)
    .await?;
    Ok(())
}

async fn mark_channel_messages_read(
    state: &AppState,
    channel_id: &str,
    user_id: &str,
) -> Result<(), AppError> {
    let messages = sqlx::query(
        "SELECT id FROM collaboration_messages WHERE channel_id=? AND deleted_at IS NULL",
    )
    .bind(channel_id)
    .fetch_all(&state.db.pool)
    .await?;
    for message in messages {
        let message_id = message.get::<String, _>("id");
        let exists = sqlx::query(
            "SELECT message_id FROM collaboration_message_reads WHERE message_id=? AND user_id=?",
        )
        .bind(&message_id)
        .bind(user_id)
        .fetch_optional(&state.db.pool)
        .await?
        .is_some();
        if !exists {
            sqlx::query(
                "INSERT INTO collaboration_message_reads (message_id,user_id,read_at) \
                 VALUES (?,?,CURRENT_TIMESTAMP)",
            )
            .bind(&message_id)
            .bind(user_id)
            .execute(&state.db.pool)
            .await?;
        }
    }
    Ok(())
}

async fn message_json(
    state: &AppState,
    row: &sqlx::any::AnyRow,
    current_user_id: &str,
) -> Result<serde_json::Value, AppError> {
    let id = row.get::<String, _>("id");
    let reaction_rows = sqlx::query(
        "SELECT emoji,user_id FROM collaboration_message_reactions \
         WHERE message_id=? ORDER BY emoji",
    )
    .bind(&id)
    .fetch_all(&state.db.pool)
    .await?;
    let mut grouped: BTreeMap<String, (i64, bool)> = BTreeMap::new();
    for reaction in reaction_rows {
        let emoji = reaction.get::<String, _>("emoji");
        let user_id = reaction.get::<String, _>("user_id");
        let entry = grouped.entry(emoji).or_insert((0, false));
        entry.0 += 1;
        entry.1 |= user_id == current_user_id;
    }
    let reactions = grouped
        .into_iter()
        .map(|(emoji, (count, reacted))| {
            serde_json::json!({"emoji":emoji,"count":count,"reacted":reacted})
        })
        .collect::<Vec<_>>();
    let thread_count = sqlx::query(
        "SELECT COUNT(*) AS count FROM collaboration_messages \
         WHERE parent_id=? AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_one(&state.db.pool)
    .await?
    .get::<i64, _>("count");
    let content = row.get::<String, _>("content");
    Ok(serde_json::json!({
        "id":id,
        "channelId":row.get::<String,_>("channel_id"),
        "userId":row.get::<String,_>("user_id"),
        "username":row.get::<String,_>("username"),
        "content":content,
        "parentId":row.try_get::<String,_>("parent_id").ok(),
        "issueId":row.try_get::<String,_>("issue_id").ok(),
        "mentions":mentions(&content),
        "reactions":reactions,
        "threadCount":thread_count,
        "createdAt":row.try_get::<String,_>("created_at").ok(),
        "updatedAt":row.try_get::<String,_>("updated_at").ok(),
        "edited":row.try_get::<String,_>("updated_at").ok()!=row.try_get::<String,_>("created_at").ok()
    }))
}

async fn fetch_message(
    state: &AppState,
    identity: &Claims,
    message_id: &str,
) -> Result<(sqlx::any::AnyRow, serde_json::Value), AppError> {
    let row = sqlx::query(
        "SELECT id,channel_id,user_id,username,content,parent_id,issue_id,\
         CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at \
         FROM collaboration_messages WHERE id=? AND deleted_at IS NULL",
    )
    .bind(message_id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Message not found".into()))?;
    channel_access(state, identity, &row.get::<String, _>("channel_id")).await?;
    let json = message_json(state, &row, &identity.sub).await?;
    Ok((row, json))
}

async fn issue_json(
    state: &AppState,
    row: &sqlx::any::AnyRow,
) -> Result<serde_json::Value, AppError> {
    let id = row.get::<String, _>("id");
    let comment_count =
        sqlx::query("SELECT COUNT(*) AS count FROM issue_comments WHERE issue_id=?")
            .bind(&id)
            .fetch_one(&state.db.pool)
            .await?
            .get::<i64, _>("count");
    let labels = row
        .try_get::<String, _>("labels")
        .ok()
        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
        .unwrap_or_else(|| serde_json::json!([]));
    Ok(serde_json::json!({
        "id":id,
        "key":row.get::<String,_>("issue_key"),
        "title":row.get::<String,_>("title"),
        "description":row.try_get::<String,_>("description").ok(),
        "type":row.get::<String,_>("issue_type"),
        "status":row.get::<String,_>("status"),
        "priority":row.get::<String,_>("priority"),
        "reporterId":row.get::<String,_>("reporter_id"),
        "reporterName":row.try_get::<String,_>("reporter_name").ok(),
        "assigneeId":row.try_get::<String,_>("assignee_id").ok(),
        "assigneeName":row.try_get::<String,_>("assignee_name").ok(),
        "channelId":row.try_get::<String,_>("channel_id").ok(),
        "channelName":row.try_get::<String,_>("channel_name").ok(),
        "dueDate":row.try_get::<String,_>("due_date").ok(),
        "labels":labels,
        "commentCount":comment_count,
        "createdAt":row.try_get::<String,_>("created_at").ok(),
        "updatedAt":row.try_get::<String,_>("updated_at").ok()
    }))
}

const ISSUE_SELECT: &str =
    "SELECT i.id,i.issue_key,i.title,i.description,i.issue_type,i.status,i.priority,\
     i.reporter_id,i.assignee_id,i.channel_id,i.due_date,i.labels,\
     CAST(i.created_at AS TEXT) AS created_at,CAST(i.updated_at AS TEXT) AS updated_at,\
     reporter.username AS reporter_name,assignee.username AS assignee_name,c.name AS channel_name \
     FROM issues i LEFT JOIN users reporter ON reporter.id=i.reporter_id \
     LEFT JOIN users assignee ON assignee.id=i.assignee_id \
     LEFT JOIN collaboration_channels c ON c.id=i.channel_id";

async fn find_issue(state: &AppState, id: &str) -> Result<sqlx::any::AnyRow, AppError> {
    sqlx::query(&format!("{ISSUE_SELECT} WHERE i.id=?"))
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Issue not found".into()))
}

fn validate_issue(body: &IssueRequest) -> Result<(), AppError> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Issue title is required".into()));
    }
    if let Some(value) = body.issue_type.as_deref() {
        if !["task", "bug", "feature", "improvement"].contains(&value) {
            return Err(AppError::BadRequest("Unsupported issue type".into()));
        }
    }
    if let Some(value) = body.status.as_deref() {
        if !["open", "in_progress", "review", "done", "closed"].contains(&value) {
            return Err(AppError::BadRequest("Unsupported issue status".into()));
        }
    }
    if let Some(value) = body.priority.as_deref() {
        if !["low", "medium", "high", "urgent"].contains(&value) {
            return Err(AppError::BadRequest("Unsupported issue priority".into()));
        }
    }
    Ok(())
}

async fn record_issue_history(
    state: &AppState,
    identity: &Claims,
    issue_id: &str,
    action: &str,
    old_value: Option<&serde_json::Value>,
    new_value: Option<&serde_json::Value>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO issue_history \
         (id,issue_id,user_id,username,action,old_value,new_value,created_at) \
         VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)",
    )
    .bind(generate_id())
    .bind(issue_id)
    .bind(&identity.sub)
    .bind(&identity.username)
    .bind(action)
    .bind(old_value.map(serde_json::Value::to_string))
    .bind(new_value.map(serde_json::Value::to_string))
    .execute(&state.db.pool)
    .await?;
    Ok(())
}

#[handler]
async fn overview(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    ensure_default_workspace(state, &identity).await?;
    let workspace_rows = sqlx::query(
        "SELECT id,name,description,created_by,CAST(created_at AS TEXT) AS created_at,\
         CAST(updated_at AS TEXT) AS updated_at \
         FROM collaboration_workspaces ORDER BY created_at",
    )
    .fetch_all(&state.db.pool)
    .await?;
    let mut workspaces = Vec::new();
    for row in workspace_rows {
        let id = row.get::<String, _>("id");
        let channel_count = sqlx::query(
            "SELECT COUNT(*) AS count FROM collaboration_channels WHERE workspace_id=?",
        )
        .bind(&id)
        .fetch_one(&state.db.pool)
        .await?
        .get::<i64, _>("count");
        workspaces.push(serde_json::json!({
            "id":id,"name":row.get::<String,_>("name"),
            "description":row.try_get::<String,_>("description").ok(),
            "createdBy":row.get::<String,_>("created_by"),"channelCount":channel_count,
            "createdAt":row.try_get::<String,_>("created_at").ok()
        }));
    }
    let channel_rows = sqlx::query(
        "SELECT id,workspace_id,name,description,is_private,created_by,\
         CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at \
         FROM collaboration_channels ORDER BY name",
    )
    .fetch_all(&state.db.pool)
    .await?;
    let mut channels = Vec::new();
    for row in channel_rows {
        let id = row.get::<String, _>("id");
        if channel_access(state, &identity, &id).await.is_err() {
            continue;
        }
        let member_count = sqlx::query(
            "SELECT COUNT(*) AS count FROM collaboration_channel_members WHERE channel_id=?",
        )
        .bind(&id)
        .fetch_one(&state.db.pool)
        .await?
        .get::<i64, _>("count");
        let unread_count = sqlx::query(
            "SELECT COUNT(*) AS count FROM collaboration_messages m WHERE m.channel_id=? \
             AND m.parent_id IS NULL AND m.deleted_at IS NULL AND m.user_id<>? \
             AND NOT EXISTS (SELECT 1 FROM collaboration_message_reads mr \
             WHERE mr.message_id=m.id AND mr.user_id=?)",
        )
        .bind(&id)
        .bind(&identity.sub)
        .bind(&identity.sub)
        .fetch_one(&state.db.pool)
        .await?
        .get::<i64, _>("count");
        channels.push(serde_json::json!({
            "id":id,"workspaceId":row.get::<String,_>("workspace_id"),
            "name":row.get::<String,_>("name"),"description":row.try_get::<String,_>("description").ok(),
            "isPrivate":row.try_get::<i64,_>("is_private").unwrap_or(0)!=0,
            "createdBy":row.get::<String,_>("created_by"),"memberCount":member_count,
            "unreadCount":unread_count,"createdAt":row.try_get::<String,_>("created_at").ok()
        }));
    }
    let mut users =
        sqlx::query("SELECT id,username,email,role FROM users WHERE is_active=1 ORDER BY username")
            .fetch_all(&state.db.pool)
            .await?
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id":row.get::<String,_>("id"),"username":row.get::<String,_>("username"),
                    "email":row.get::<String,_>("email"),"role":row.get::<String,_>("role")
                })
            })
            .collect::<Vec<_>>();
    if !users.iter().any(|user| user["id"] == identity.sub) {
        users.push(serde_json::json!({"id":identity.sub,"username":identity.username,"email":"","role":identity.role}));
    }
    Ok(Json(serde_json::json!({
        "currentUser":{"id":identity.sub,"username":identity.username,"role":identity.role},
        "workspaces":workspaces,"channels":channels,"users":users
    })))
}

#[handler]
async fn create_workspace(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let body = request_body::<WorkspaceRequest>(req).await?;
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Workspace name is required".into()));
    }
    let id = generate_id();
    sqlx::query(
        "INSERT INTO collaboration_workspaces \
         (id,name,description,created_by,created_at,updated_at) \
         VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
    )
    .bind(&id)
    .bind(body.name.trim())
    .bind(body.description.as_deref().map(str::trim))
    .bind(&identity.sub)
    .execute(&state.db.pool)
    .await?;
    Ok(Json(serde_json::json!({"id":id})))
}

#[handler]
async fn update_workspace(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    workspace_management(state, &identity, &id).await?;
    let body = request_body::<WorkspaceRequest>(req).await?;
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Workspace name is required".into()));
    }
    sqlx::query(
        "UPDATE collaboration_workspaces SET name=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(body.name.trim())
    .bind(body.description.as_deref().map(str::trim))
    .bind(&id)
    .execute(&state.db.pool)
    .await?;
    Ok(Json(serde_json::json!({"id":id,"updated":true})))
}

#[handler]
async fn delete_workspace(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    workspace_management(state, &identity, &id).await?;
    let channels = sqlx::query("SELECT id FROM collaboration_channels WHERE workspace_id=?")
        .bind(&id)
        .fetch_all(&state.db.pool)
        .await?;
    for channel in channels {
        let channel_id = channel.get::<String, _>("id");
        sqlx::query("DELETE FROM collaboration_message_reactions WHERE message_id IN (SELECT id FROM collaboration_messages WHERE channel_id=?)").bind(&channel_id).execute(&state.db.pool).await?;
        sqlx::query("DELETE FROM collaboration_message_reads WHERE message_id IN (SELECT id FROM collaboration_messages WHERE channel_id=?)").bind(&channel_id).execute(&state.db.pool).await?;
        sqlx::query("DELETE FROM collaboration_messages WHERE channel_id=?")
            .bind(&channel_id)
            .execute(&state.db.pool)
            .await?;
        sqlx::query("DELETE FROM collaboration_channel_members WHERE channel_id=?")
            .bind(&channel_id)
            .execute(&state.db.pool)
            .await?;
        sqlx::query("UPDATE issues SET channel_id=NULL WHERE channel_id=?")
            .bind(&channel_id)
            .execute(&state.db.pool)
            .await?;
    }
    sqlx::query("DELETE FROM collaboration_channels WHERE workspace_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM collaboration_workspaces WHERE id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    Ok(Json(serde_json::json!({"deleted":true})))
}

#[handler]
async fn create_channel(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let body = request_body::<ChannelRequest>(req).await?;
    sqlx::query("SELECT id FROM collaboration_workspaces WHERE id=?")
        .bind(&body.workspace_id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;
    for member_id in body.member_ids.as_deref().unwrap_or_default() {
        let exists = sqlx::query("SELECT id FROM users WHERE id=?")
            .bind(member_id)
            .fetch_optional(&state.db.pool)
            .await?
            .is_some()
            || member_id == &identity.sub;
        if !exists {
            return Err(AppError::NotFound(format!("User {member_id} not found")));
        }
    }
    let name = clean_name(&body.name);
    if name.is_empty() {
        return Err(AppError::BadRequest("Channel name is required".into()));
    }
    let id = generate_id();
    let inserted = sqlx::query(
        "INSERT INTO collaboration_channels \
         (id,workspace_id,name,description,is_private,created_by,created_at,updated_at) \
         VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
    )
    .bind(&id)
    .bind(&body.workspace_id)
    .bind(&name)
    .bind(body.description.as_deref().map(str::trim))
    .bind(i64::from(body.is_private.unwrap_or(false)))
    .bind(&identity.sub)
    .execute(&state.db.pool)
    .await;
    if let Err(error) = inserted {
        if error.to_string().to_lowercase().contains("unique") {
            return Err(AppError::Conflict("Channel name already exists".into()));
        }
        return Err(error.into());
    }
    let mut member_ids = body.member_ids.unwrap_or_default();
    if !member_ids.contains(&identity.sub) {
        member_ids.push(identity.sub.clone());
    }
    for member_id in member_ids {
        sqlx::query(
            "INSERT INTO collaboration_channel_members (channel_id,user_id,role,last_read_at) \
             VALUES (?,?,?,CURRENT_TIMESTAMP)",
        )
        .bind(&id)
        .bind(&member_id)
        .bind(if member_id == identity.sub {
            "owner"
        } else {
            "member"
        })
        .execute(&state.db.pool)
        .await?;
    }
    Ok(Json(serde_json::json!({"id":id,"name":name})))
}

#[handler]
async fn update_channel(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    channel_management(state, &identity, &id).await?;
    let body = request_body::<ChannelRequest>(req).await?;
    sqlx::query("SELECT id FROM collaboration_workspaces WHERE id=?")
        .bind(&body.workspace_id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;
    let name = clean_name(&body.name);
    if name.is_empty() {
        return Err(AppError::BadRequest("Channel name is required".into()));
    }
    sqlx::query(
        "UPDATE collaboration_channels SET workspace_id=?,name=?,description=?,is_private=?,\
         updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(&body.workspace_id)
    .bind(&name)
    .bind(body.description.as_deref().map(str::trim))
    .bind(i64::from(body.is_private.unwrap_or(false)))
    .bind(&id)
    .execute(&state.db.pool)
    .await?;
    emit(
        &id,
        serde_json::json!({"type":"channel.updated","channelId":id}),
    );
    Ok(Json(serde_json::json!({"id":id,"updated":true})))
}

#[handler]
async fn delete_channel(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    channel_management(state, &identity, &id).await?;
    sqlx::query("DELETE FROM collaboration_message_reactions WHERE message_id IN (SELECT id FROM collaboration_messages WHERE channel_id=?)").bind(&id).execute(&state.db.pool).await?;
    sqlx::query("DELETE FROM collaboration_message_reads WHERE message_id IN (SELECT id FROM collaboration_messages WHERE channel_id=?)").bind(&id).execute(&state.db.pool).await?;
    sqlx::query("DELETE FROM collaboration_messages WHERE channel_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM collaboration_channel_members WHERE channel_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("UPDATE issues SET channel_id=NULL WHERE channel_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM collaboration_channels WHERE id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    emit(
        &id,
        serde_json::json!({"type":"channel.deleted","channelId":id}),
    );
    Ok(Json(serde_json::json!({"deleted":true})))
}

#[handler]
async fn list_members(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    channel_access(state, &identity, &id).await?;
    let members = sqlx::query(
        "SELECT cm.user_id,cm.role,CAST(cm.last_read_at AS TEXT) AS last_read_at,u.username,u.email \
         FROM collaboration_channel_members cm LEFT JOIN users u ON u.id=cm.user_id \
         WHERE cm.channel_id=? ORDER BY u.username",
    )
    .bind(&id).fetch_all(&state.db.pool).await?.into_iter().map(|row|serde_json::json!({
        "userId":row.get::<String,_>("user_id"),"role":row.get::<String,_>("role"),
        "username":row.try_get::<String,_>("username").ok(),"email":row.try_get::<String,_>("email").ok(),
        "lastReadAt":row.try_get::<String,_>("last_read_at").ok()
    })).collect::<Vec<_>>();
    Ok(Json(serde_json::json!({"members":members})))
}

#[handler]
async fn add_members(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    channel_management(state, &identity, &id).await?;
    let body = request_body::<MemberRequest>(req).await?;
    let mut added = 0;
    for user_id in body.user_ids {
        let exists = sqlx::query("SELECT id FROM users WHERE id=?")
            .bind(&user_id)
            .fetch_optional(&state.db.pool)
            .await?
            .is_some()
            || user_id == identity.sub;
        if !exists {
            return Err(AppError::NotFound(format!("User {user_id} not found")));
        }
        if sqlx::query(
            "SELECT user_id FROM collaboration_channel_members WHERE channel_id=? AND user_id=?",
        )
        .bind(&id)
        .bind(&user_id)
        .fetch_optional(&state.db.pool)
        .await?
        .is_none()
        {
            sqlx::query("INSERT INTO collaboration_channel_members (channel_id,user_id,role,last_read_at) VALUES (?,?,'member',CURRENT_TIMESTAMP)")
                .bind(&id).bind(&user_id).execute(&state.db.pool).await?;
            mark_channel_messages_read(state, &id, &user_id).await?;
            added += 1;
        }
    }
    emit(
        &id,
        serde_json::json!({"type":"members.updated","channelId":id}),
    );
    Ok(Json(serde_json::json!({"added":added})))
}

#[handler]
async fn remove_member(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let user_id = path_id(req, "user_id")?;
    let channel = channel_management(state, &identity, &id).await?;
    if channel.get::<String, _>("created_by") == user_id {
        return Err(AppError::BadRequest(
            "The channel owner cannot be removed".into(),
        ));
    }
    sqlx::query("DELETE FROM collaboration_channel_members WHERE channel_id=? AND user_id=?")
        .bind(&id)
        .bind(&user_id)
        .execute(&state.db.pool)
        .await?;
    emit(
        &id,
        serde_json::json!({"type":"members.updated","channelId":id}),
    );
    Ok(Json(serde_json::json!({"removed":true})))
}

#[handler]
async fn mark_read(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    channel_access(state, &identity, &id).await?;
    let updated = sqlx::query("UPDATE collaboration_channel_members SET last_read_at=CURRENT_TIMESTAMP WHERE channel_id=? AND user_id=?")
        .bind(&id).bind(&identity.sub).execute(&state.db.pool).await?;
    if updated.rows_affected() == 0 {
        sqlx::query("INSERT INTO collaboration_channel_members (channel_id,user_id,role,last_read_at) VALUES (?,?,'member',CURRENT_TIMESTAMP)")
            .bind(&id).bind(&identity.sub).execute(&state.db.pool).await?;
    }
    mark_channel_messages_read(state, &id, &identity.sub).await?;
    Ok(Json(serde_json::json!({"read":true})))
}

#[handler]
async fn list_messages(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    channel_access(state, &identity, &id).await?;
    let parent_id = req.query::<String>("parent_id");
    let limit = req.query::<i64>("limit").unwrap_or(100).clamp(1, 200);
    let offset = req.query::<i64>("offset").unwrap_or(0).max(0);
    let rows = if let Some(parent_id) = parent_id {
        sqlx::query("SELECT id,channel_id,user_id,username,content,parent_id,issue_id,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM collaboration_messages WHERE channel_id=? AND parent_id=? AND deleted_at IS NULL ORDER BY created_at LIMIT ? OFFSET ?")
            .bind(&id).bind(parent_id).bind(limit).bind(offset).fetch_all(&state.db.pool).await?
    } else {
        sqlx::query("SELECT id,channel_id,user_id,username,content,parent_id,issue_id,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM collaboration_messages WHERE channel_id=? AND parent_id IS NULL AND deleted_at IS NULL ORDER BY created_at LIMIT ? OFFSET ?")
            .bind(&id).bind(limit).bind(offset).fetch_all(&state.db.pool).await?
    };
    let mut messages = Vec::new();
    for row in rows {
        messages.push(message_json(state, &row, &identity.sub).await?);
    }
    Ok(Json(
        serde_json::json!({"messages":messages,"limit":limit,"offset":offset}),
    ))
}

#[handler]
async fn create_message(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let channel_id = path_id(req, "id")?;
    channel_access(state, &identity, &channel_id).await?;
    let body = request_body::<MessageRequest>(req).await?;
    if body.content.trim().is_empty() {
        return Err(AppError::BadRequest("Message cannot be empty".into()));
    }
    if let Some(parent_id) = body.parent_id.as_deref() {
        let parent = sqlx::query(
            "SELECT channel_id FROM collaboration_messages WHERE id=? AND deleted_at IS NULL",
        )
        .bind(parent_id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Parent message not found".into()))?;
        if parent.get::<String, _>("channel_id") != channel_id {
            return Err(AppError::BadRequest(
                "Thread message belongs to another channel".into(),
            ));
        }
    }
    if let Some(issue_id) = body.issue_id.as_deref() {
        find_issue(state, issue_id).await?;
    }
    let id = generate_id();
    sqlx::query("INSERT INTO collaboration_messages (id,channel_id,user_id,username,content,parent_id,issue_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&id).bind(&channel_id).bind(&identity.sub).bind(&identity.username)
        .bind(body.content.trim()).bind(&body.parent_id).bind(&body.issue_id)
        .execute(&state.db.pool).await?;
    let (_, message) = fetch_message(state, &identity, &id).await?;
    emit(
        &channel_id,
        serde_json::json!({"type":"message.created","channelId":channel_id,"message":message}),
    );
    Ok(Json(message))
}

#[handler]
async fn update_message(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let body = request_body::<MessageRequest>(req).await?;
    if body.content.trim().is_empty() {
        return Err(AppError::BadRequest("Message cannot be empty".into()));
    }
    let (row, _) = fetch_message(state, &identity, &id).await?;
    if row.get::<String, _>("user_id") != identity.sub && identity.role != "admin" {
        return Err(AppError::Unauthorized(
            "Only the author can edit this message".into(),
        ));
    }
    let channel_id = row.get::<String, _>("channel_id");
    sqlx::query(
        "UPDATE collaboration_messages SET content=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(body.content.trim())
    .bind(&id)
    .execute(&state.db.pool)
    .await?;
    let (_, message) = fetch_message(state, &identity, &id).await?;
    emit(
        &channel_id,
        serde_json::json!({"type":"message.updated","channelId":channel_id,"message":message}),
    );
    Ok(Json(message))
}

#[handler]
async fn delete_message(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let (row, _) = fetch_message(state, &identity, &id).await?;
    if row.get::<String, _>("user_id") != identity.sub && identity.role != "admin" {
        return Err(AppError::Unauthorized(
            "Only the author can delete this message".into(),
        ));
    }
    let channel_id = row.get::<String, _>("channel_id");
    sqlx::query(
        "UPDATE collaboration_messages SET deleted_at=CURRENT_TIMESTAMP WHERE id=? OR parent_id=?",
    )
    .bind(&id)
    .bind(&id)
    .execute(&state.db.pool)
    .await?;
    emit(
        &channel_id,
        serde_json::json!({"type":"message.deleted","channelId":channel_id,"messageId":id}),
    );
    Ok(Json(serde_json::json!({"deleted":true})))
}

#[handler]
async fn toggle_reaction(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let body = request_body::<ReactionRequest>(req).await?;
    let emoji = body.emoji.trim();
    if emoji.is_empty() || emoji.chars().count() > 16 {
        return Err(AppError::BadRequest("Invalid reaction".into()));
    }
    let (row, _) = fetch_message(state, &identity, &id).await?;
    let channel_id = row.get::<String, _>("channel_id");
    let exists = sqlx::query("SELECT message_id FROM collaboration_message_reactions WHERE message_id=? AND user_id=? AND emoji=?")
        .bind(&id).bind(&identity.sub).bind(emoji).fetch_optional(&state.db.pool).await?.is_some();
    if exists {
        sqlx::query("DELETE FROM collaboration_message_reactions WHERE message_id=? AND user_id=? AND emoji=?")
            .bind(&id).bind(&identity.sub).bind(emoji).execute(&state.db.pool).await?;
    } else {
        sqlx::query("INSERT INTO collaboration_message_reactions (message_id,user_id,emoji,created_at) VALUES (?,?,?,CURRENT_TIMESTAMP)")
            .bind(&id).bind(&identity.sub).bind(emoji).execute(&state.db.pool).await?;
    }
    let (_, message) = fetch_message(state, &identity, &id).await?;
    emit(
        &channel_id,
        serde_json::json!({"type":"reaction.updated","channelId":channel_id,"message":message}),
    );
    Ok(Json(
        serde_json::json!({"active":!exists,"message":message}),
    ))
}

#[handler]
async fn search_messages(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let query = req.query::<String>("q").unwrap_or_default();
    if query.trim().is_empty() {
        return Ok(Json(serde_json::json!({"messages":[]})));
    }
    let pattern = format!("%{}%", query.trim());
    let rows = if let Some(channel_id) = req.query::<String>("channel_id") {
        channel_access(state, &identity, &channel_id).await?;
        sqlx::query("SELECT id,channel_id,user_id,username,content,parent_id,issue_id,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM collaboration_messages WHERE channel_id=? AND content LIKE ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100")
            .bind(channel_id).bind(&pattern).fetch_all(&state.db.pool).await?
    } else {
        sqlx::query("SELECT id,channel_id,user_id,username,content,parent_id,issue_id,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM collaboration_messages WHERE content LIKE ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100")
            .bind(&pattern).fetch_all(&state.db.pool).await?
    };
    let mut messages = Vec::new();
    for row in rows {
        if channel_access(state, &identity, &row.get::<String, _>("channel_id"))
            .await
            .is_ok()
        {
            messages.push(message_json(state, &row, &identity.sub).await?);
        }
    }
    Ok(Json(serde_json::json!({"messages":messages,"query":query})))
}

async fn websocket_loop(socket: salvo::websocket::WebSocket, channel_id: String) {
    let (mut sink, mut incoming) = socket.split();
    let mut receiver = channel_bus(&channel_id).subscribe();
    let ready = serde_json::json!({"type":"connected","channelId":channel_id}).to_string();
    if sink.send(Message::text(ready)).await.is_err() {
        return;
    }
    loop {
        tokio::select! {
            event = receiver.recv() => match event {
                Ok(payload) => if sink.send(Message::text(payload)).await.is_err() { break; },
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            },
            message = incoming.next() => match message {
                Some(Ok(message)) if message.is_close() => break,
                Some(Err(_)) | None => break,
                _ => {}
            }
        }
    }
}

#[handler]
async fn collaboration_websocket(
    req: &mut Request,
    res: &mut Response,
    depot: &mut Depot,
) -> Result<(), StatusError> {
    let state = depot.obtain::<AppState>().unwrap().clone();
    let identity =
        websocket_authentication(req, &state).map_err(|_| StatusError::unauthorized())?;
    let channel_id = req
        .query::<String>("channel_id")
        .ok_or_else(StatusError::bad_request)?;
    if channel_id != "__issues__" {
        channel_access(&state, &identity, &channel_id)
            .await
            .map_err(|error| match error {
                AppError::NotFound(_) => StatusError::not_found(),
                _ => StatusError::unauthorized(),
            })?;
    }
    WebSocketUpgrade::new()
        .upgrade(req, res, move |socket| async move {
            websocket_loop(socket, channel_id).await;
        })
        .await
}

#[handler]
async fn list_issues(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let query = req.query::<String>("q").unwrap_or_default().to_lowercase();
    let status = req.query::<String>("status");
    let assignee = req.query::<String>("assignee_id");
    let channel = req.query::<String>("channel_id");
    let rows = sqlx::query(&format!("{ISSUE_SELECT} ORDER BY i.updated_at DESC"))
        .fetch_all(&state.db.pool)
        .await?;
    let mut issues = Vec::new();
    for row in rows {
        if !query.is_empty()
            && !row
                .get::<String, _>("title")
                .to_lowercase()
                .contains(&query)
            && !row
                .get::<String, _>("issue_key")
                .to_lowercase()
                .contains(&query)
        {
            continue;
        }
        if status
            .as_deref()
            .is_some_and(|value| value != row.get::<String, _>("status"))
        {
            continue;
        }
        if assignee.as_deref().is_some_and(|value| {
            row.try_get::<String, _>("assignee_id").ok().as_deref() != Some(value)
        }) {
            continue;
        }
        if channel.as_deref().is_some_and(|value| {
            row.try_get::<String, _>("channel_id").ok().as_deref() != Some(value)
        }) {
            continue;
        }
        if let Some(channel_id) = row.try_get::<String, _>("channel_id").ok() {
            if channel_access(state, &identity, &channel_id).await.is_err() {
                continue;
            }
        }
        issues.push(issue_json(state, &row).await?);
    }
    Ok(Json(serde_json::json!({"issues":issues})))
}

#[handler]
async fn get_issue(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let row = find_issue(state, &id).await?;
    if let Some(channel_id) = row.try_get::<String, _>("channel_id").ok() {
        channel_access(state, &identity, &channel_id).await?;
    }
    Ok(Json(issue_json(state, &row).await?))
}

#[handler]
async fn create_issue(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let body = request_body::<IssueRequest>(req).await?;
    validate_issue(&body)?;
    if let Some(channel_id) = body.channel_id.as_deref() {
        channel_access(state, &identity, channel_id).await?;
    }
    if let Some(assignee_id) = body.assignee_id.as_deref() {
        let exists = sqlx::query("SELECT id FROM users WHERE id=?")
            .bind(assignee_id)
            .fetch_optional(&state.db.pool)
            .await?
            .is_some();
        if !exists && assignee_id != identity.sub {
            return Err(AppError::NotFound("Assignee not found".into()));
        }
    }
    let id = generate_id();
    let key = format!(
        "CTX-{}",
        id.chars().take(8).collect::<String>().to_uppercase()
    );
    let labels = serde_json::to_string(&body.labels.clone().unwrap_or_default()).unwrap();
    sqlx::query("INSERT INTO issues (id,issue_key,title,description,issue_type,status,priority,reporter_id,assignee_id,channel_id,due_date,labels,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&id).bind(&key).bind(body.title.trim()).bind(body.description.as_deref().map(str::trim))
        .bind(body.issue_type.as_deref().unwrap_or("task")).bind(body.status.as_deref().unwrap_or("open"))
        .bind(body.priority.as_deref().unwrap_or("medium")).bind(&identity.sub).bind(&body.assignee_id)
        .bind(&body.channel_id).bind(&body.due_date).bind(labels).execute(&state.db.pool).await?;
    let row = find_issue(state, &id).await?;
    let issue = issue_json(state, &row).await?;
    record_issue_history(state, &identity, &id, "created", None, Some(&issue)).await?;
    if let Some(channel_id) = body.channel_id {
        let message_id = generate_id();
        sqlx::query("INSERT INTO collaboration_messages (id,channel_id,user_id,username,content,issue_id,created_at,updated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
            .bind(&message_id).bind(&channel_id).bind(&identity.sub).bind(&identity.username)
            .bind(format!("建立 Issue [{key}] {}",body.title.trim())).bind(&id).execute(&state.db.pool).await?;
        emit(
            &channel_id,
            serde_json::json!({"type":"issue.created","channelId":channel_id,"issue":issue}),
        );
    }
    emit("__issues__", serde_json::json!({"type":"issues.changed"}));
    Ok(Json(issue))
}

#[handler]
async fn update_issue(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let old_row = find_issue(state, &id).await?;
    let reporter_id = old_row.get::<String, _>("reporter_id");
    let assignee_id = old_row.try_get::<String, _>("assignee_id").ok();
    if identity.role != "admin"
        && identity.sub != reporter_id
        && assignee_id.as_deref() != Some(identity.sub.as_str())
    {
        return Err(AppError::Unauthorized(
            "Only the reporter, assignee, or an administrator can update this issue".into(),
        ));
    }
    let old = issue_json(state, &old_row).await?;
    let body = request_body::<IssueRequest>(req).await?;
    validate_issue(&body)?;
    if let Some(channel_id) = body.channel_id.as_deref() {
        channel_access(state, &identity, channel_id).await?;
    }
    if let Some(assignee_id) = body.assignee_id.as_deref() {
        let exists = sqlx::query("SELECT id FROM users WHERE id=?")
            .bind(assignee_id)
            .fetch_optional(&state.db.pool)
            .await?
            .is_some();
        if !exists && assignee_id != identity.sub {
            return Err(AppError::NotFound("Assignee not found".into()));
        }
    }
    sqlx::query("UPDATE issues SET title=?,description=?,issue_type=?,status=?,priority=?,assignee_id=?,channel_id=?,due_date=?,labels=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.title.trim()).bind(body.description.as_deref().map(str::trim))
        .bind(body.issue_type.as_deref().unwrap_or("task")).bind(body.status.as_deref().unwrap_or("open"))
        .bind(body.priority.as_deref().unwrap_or("medium")).bind(&body.assignee_id).bind(&body.channel_id)
        .bind(&body.due_date).bind(serde_json::to_string(&body.labels.clone().unwrap_or_default()).unwrap()).bind(&id)
        .execute(&state.db.pool).await?;
    let row = find_issue(state, &id).await?;
    let issue = issue_json(state, &row).await?;
    record_issue_history(state, &identity, &id, "updated", Some(&old), Some(&issue)).await?;
    if let Some(channel_id) = old["channelId"].as_str() {
        emit(
            channel_id,
            serde_json::json!({"type":"issue.updated","channelId":channel_id,"issue":issue}),
        );
    }
    if let Some(channel_id) = body.channel_id {
        emit(
            &channel_id,
            serde_json::json!({"type":"issue.updated","channelId":channel_id,"issue":issue}),
        );
    }
    emit("__issues__", serde_json::json!({"type":"issues.changed"}));
    Ok(Json(issue))
}

#[handler]
async fn delete_issue(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let row = find_issue(state, &id).await?;
    let reporter_id = row.get::<String, _>("reporter_id");
    if identity.role != "admin" && identity.sub != reporter_id {
        return Err(AppError::Unauthorized(
            "Only the reporter can delete this issue".into(),
        ));
    }
    let channel_id = row.try_get::<String, _>("channel_id").ok();
    sqlx::query("UPDATE collaboration_messages SET issue_id=NULL WHERE issue_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM issue_comments WHERE issue_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM issue_history WHERE issue_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM issues WHERE id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    if let Some(channel_id) = channel_id {
        emit(
            &channel_id,
            serde_json::json!({"type":"issue.deleted","channelId":channel_id,"issueId":id}),
        );
    }
    emit("__issues__", serde_json::json!({"type":"issues.changed"}));
    Ok(Json(serde_json::json!({"deleted":true})))
}

#[handler]
async fn list_issue_comments(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let issue = find_issue(state, &id).await?;
    if let Some(channel_id) = issue.try_get::<String, _>("channel_id").ok() {
        channel_access(state, &identity, &channel_id).await?;
    }
    let comments=sqlx::query("SELECT id,user_id,username,content,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM issue_comments WHERE issue_id=? ORDER BY created_at")
        .bind(&id).fetch_all(&state.db.pool).await?.into_iter().map(|row|serde_json::json!({
            "id":row.get::<String,_>("id"),"userId":row.get::<String,_>("user_id"),
            "username":row.get::<String,_>("username"),"content":row.get::<String,_>("content"),
            "createdAt":row.try_get::<String,_>("created_at").ok(),"updatedAt":row.try_get::<String,_>("updated_at").ok()
        })).collect::<Vec<_>>();
    Ok(Json(serde_json::json!({"comments":comments})))
}

#[handler]
async fn create_issue_comment(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let issue_id = path_id(req, "id")?;
    let issue = find_issue(state, &issue_id).await?;
    if let Some(channel_id) = issue.try_get::<String, _>("channel_id").ok() {
        channel_access(state, &identity, &channel_id).await?;
    }
    let body = request_body::<CommentRequest>(req).await?;
    if body.content.trim().is_empty() {
        return Err(AppError::BadRequest("Comment cannot be empty".into()));
    }
    let id = generate_id();
    sqlx::query("INSERT INTO issue_comments (id,issue_id,user_id,username,content,created_at,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&id).bind(&issue_id).bind(&identity.sub).bind(&identity.username).bind(body.content.trim()).execute(&state.db.pool).await?;
    record_issue_history(
        state,
        &identity,
        &issue_id,
        "commented",
        None,
        Some(&serde_json::json!({"commentId":id})),
    )
    .await?;
    if let Some(channel_id) = issue.try_get::<String, _>("channel_id").ok() {
        emit(
            &channel_id,
            serde_json::json!({"type":"issue.comment.created","channelId":channel_id,"issueId":issue_id}),
        );
    }
    emit("__issues__", serde_json::json!({"type":"issues.changed"}));
    Ok(Json(serde_json::json!({"id":id})))
}

#[handler]
async fn update_issue_comment(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let issue_id = path_id(req, "id")?;
    let comment_id = path_id(req, "comment_id")?;
    let issue = find_issue(state, &issue_id).await?;
    if let Some(channel_id) = issue.try_get::<String, _>("channel_id").ok() {
        channel_access(state, &identity, &channel_id).await?;
    }
    let comment = sqlx::query("SELECT user_id FROM issue_comments WHERE id=? AND issue_id=?")
        .bind(&comment_id)
        .bind(&issue_id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".into()))?;
    if identity.role != "admin" && comment.get::<String, _>("user_id") != identity.sub {
        return Err(AppError::Unauthorized(
            "Only the author can edit this comment".into(),
        ));
    }
    let body = request_body::<CommentRequest>(req).await?;
    if body.content.trim().is_empty() {
        return Err(AppError::BadRequest("Comment cannot be empty".into()));
    }
    sqlx::query("UPDATE issue_comments SET content=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.content.trim())
        .bind(&comment_id)
        .execute(&state.db.pool)
        .await?;
    Ok(Json(serde_json::json!({"id":comment_id,"updated":true})))
}

#[handler]
async fn delete_issue_comment(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let issue_id = path_id(req, "id")?;
    let comment_id = path_id(req, "comment_id")?;
    let issue = find_issue(state, &issue_id).await?;
    if let Some(channel_id) = issue.try_get::<String, _>("channel_id").ok() {
        channel_access(state, &identity, &channel_id).await?;
    }
    let comment = sqlx::query("SELECT user_id FROM issue_comments WHERE id=? AND issue_id=?")
        .bind(&comment_id)
        .bind(&issue_id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".into()))?;
    if identity.role != "admin" && comment.get::<String, _>("user_id") != identity.sub {
        return Err(AppError::Unauthorized(
            "Only the author can delete this comment".into(),
        ));
    }
    sqlx::query("DELETE FROM issue_comments WHERE id=?")
        .bind(&comment_id)
        .execute(&state.db.pool)
        .await?;
    Ok(Json(serde_json::json!({"deleted":true})))
}

#[handler]
async fn issue_history(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_id(req, "id")?;
    let issue = find_issue(state, &id).await?;
    if let Some(channel_id) = issue.try_get::<String, _>("channel_id").ok() {
        channel_access(state, &identity, &channel_id).await?;
    }
    let history=sqlx::query("SELECT id,user_id,username,action,old_value,new_value,CAST(created_at AS TEXT) AS created_at FROM issue_history WHERE issue_id=? ORDER BY created_at DESC")
        .bind(&id).fetch_all(&state.db.pool).await?.into_iter().map(|row|serde_json::json!({
            "id":row.get::<String,_>("id"),"userId":row.get::<String,_>("user_id"),
            "username":row.get::<String,_>("username"),"action":row.get::<String,_>("action"),
            "oldValue":row.try_get::<String,_>("old_value").ok().and_then(|value|serde_json::from_str::<serde_json::Value>(&value).ok()),
            "newValue":row.try_get::<String,_>("new_value").ok().and_then(|value|serde_json::from_str::<serde_json::Value>(&value).ok()),
            "createdAt":row.try_get::<String,_>("created_at").ok()
        })).collect::<Vec<_>>();
    Ok(Json(serde_json::json!({"history":history})))
}

pub fn router() -> Router {
    Router::with_path("collaboration")
        .push(Router::with_path("overview").get(overview))
        .push(Router::with_path("ws").get(collaboration_websocket))
        .push(
            Router::with_path("workspaces").post(create_workspace).push(
                Router::with_path("<id>")
                    .put(update_workspace)
                    .delete(delete_workspace),
            ),
        )
        .push(
            Router::with_path("channels").post(create_channel).push(
                Router::with_path("<id>")
                    .put(update_channel)
                    .delete(delete_channel)
                    .push(
                        Router::with_path("messages")
                            .get(list_messages)
                            .post(create_message),
                    )
                    .push(
                        Router::with_path("members")
                            .get(list_members)
                            .post(add_members),
                    )
                    .push(Router::with_path("members/<user_id>").delete(remove_member))
                    .push(Router::with_path("read").post(mark_read)),
            ),
        )
        .push(Router::with_path("messages/search").get(search_messages))
        .push(
            Router::with_path("messages/<id>")
                .put(update_message)
                .delete(delete_message)
                .push(Router::with_path("reactions").post(toggle_reaction)),
        )
        .push(
            Router::with_path("issues")
                .get(list_issues)
                .post(create_issue)
                .push(
                    Router::with_path("<id>")
                        .get(get_issue)
                        .put(update_issue)
                        .delete(delete_issue)
                        .push(
                            Router::with_path("comments")
                                .get(list_issue_comments)
                                .post(create_issue_comment),
                        )
                        .push(
                            Router::with_path("comments/<comment_id>")
                                .put(update_issue_comment)
                                .delete(delete_issue_comment),
                        )
                        .push(Router::with_path("history").get(issue_history)),
                ),
        )
}
