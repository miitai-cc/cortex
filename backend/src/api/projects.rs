//! Persistent project planning and delivery management.
//!
//! Project records are shared by the project screens, personal workspace, and
//! collaboration channels so each surface reflects the same source of truth.

use crate::api::collaboration::emit_project_event;
use crate::core::state::AppState;
use crate::errors::AppError;
use chrono::NaiveDate;
use cortex_lib::utils::generate_id;
use eiva_be_security::jwt::{verify_token, Claims};
use salvo::prelude::*;
use serde::Deserialize;
use serde_json::Value;
use sqlx::{any::AnyRow, Row};

const PROJECT_STATUSES: &[&str] = &["planning", "active", "on_hold", "completed", "archived"];
const PRIORITIES: &[&str] = &["low", "medium", "high", "critical"];
const RECORD_TYPES: &[&str] = &[
    "milestone",
    "task",
    "budget",
    "member",
    "requirement",
    "audit",
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRequest {
    code: String,
    name: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    manager_id: Option<String>,
    manager_name: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    budget_total: Option<i64>,
    related_links: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRecordRequest {
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    assignee_id: Option<String>,
    assignee_name: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    amount: Option<i64>,
    progress: Option<i64>,
    metadata: Option<Value>,
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

fn path_value(req: &Request, key: &str) -> Result<String, AppError> {
    req.param::<String>(key)
        .ok_or_else(|| AppError::BadRequest(format!("Missing {key}")))
}

fn optional_text(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn validate_date(value: &Option<String>, label: &str) -> Result<(), AppError> {
    if let Some(date) = optional_text(value) {
        NaiveDate::parse_from_str(&date, "%Y-%m-%d")
            .map_err(|_| AppError::BadRequest(format!("{label} must use YYYY-MM-DD")))?;
    }
    Ok(())
}

fn validate_project(body: &ProjectRequest) -> Result<(), AppError> {
    let code = body.code.trim();
    if code.is_empty()
        || code.chars().count() > 40
        || !code
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(AppError::BadRequest(
            "Project code must contain 1 to 40 letters, numbers, '-' or '_'".into(),
        ));
    }
    if body.name.trim().is_empty() || body.name.trim().chars().count() > 200 {
        return Err(AppError::BadRequest(
            "Project name must contain 1 to 200 characters".into(),
        ));
    }
    if body
        .description
        .as_ref()
        .is_some_and(|value| value.chars().count() > 10_000)
    {
        return Err(AppError::BadRequest(
            "Description is limited to 10000 characters".into(),
        ));
    }
    if !PROJECT_STATUSES.contains(&body.status.as_deref().unwrap_or("planning")) {
        return Err(AppError::BadRequest("Invalid project status".into()));
    }
    if !PRIORITIES.contains(&body.priority.as_deref().unwrap_or("medium")) {
        return Err(AppError::BadRequest("Invalid priority".into()));
    }
    if body.budget_total.is_some_and(|value| value < 0) {
        return Err(AppError::BadRequest("Budget cannot be negative".into()));
    }
    validate_date(&body.start_date, "Start date")?;
    validate_date(&body.end_date, "End date")?;
    if let (Some(start), Some(end)) = (
        optional_text(&body.start_date),
        optional_text(&body.end_date),
    ) {
        if start > end {
            return Err(AppError::BadRequest(
                "End date cannot be earlier than start date".into(),
            ));
        }
    }
    if !body
        .related_links
        .as_ref()
        .is_none_or(serde_json::Value::is_array)
    {
        return Err(AppError::BadRequest(
            "Related links must be an array".into(),
        ));
    }
    Ok(())
}

fn statuses_for(record_type: &str) -> Option<&'static [&'static str]> {
    match record_type {
        "task" => Some(&["backlog", "todo", "in_progress", "review", "done"]),
        "milestone" => Some(&["planned", "in_progress", "completed", "delayed"]),
        "budget" => Some(&["planned", "approved", "committed", "spent"]),
        "member" => Some(&["active", "pending", "inactive"]),
        "requirement" => Some(&["draft", "approved", "in_progress", "verified", "rejected"]),
        "audit" => Some(&["planned", "in_review", "passed", "failed", "follow_up"]),
        _ => None,
    }
}

fn default_status(record_type: &str) -> &'static str {
    match record_type {
        "task" => "backlog",
        "member" => "active",
        "requirement" => "draft",
        _ => "planned",
    }
}

fn validate_record(record_type: &str, body: &ProjectRecordRequest) -> Result<(), AppError> {
    let statuses = statuses_for(record_type)
        .ok_or_else(|| AppError::BadRequest("Invalid project record type".into()))?;
    if body.title.trim().is_empty() || body.title.trim().chars().count() > 240 {
        return Err(AppError::BadRequest(
            "Title must contain 1 to 240 characters".into(),
        ));
    }
    if !statuses.contains(
        &body
            .status
            .as_deref()
            .unwrap_or(default_status(record_type)),
    ) {
        return Err(AppError::BadRequest("Invalid record status".into()));
    }
    if !PRIORITIES.contains(&body.priority.as_deref().unwrap_or("medium")) {
        return Err(AppError::BadRequest("Invalid priority".into()));
    }
    if body.amount.is_some_and(|value| value < 0) {
        return Err(AppError::BadRequest("Amount cannot be negative".into()));
    }
    if !(0..=100).contains(&body.progress.unwrap_or(0)) {
        return Err(AppError::BadRequest(
            "Progress must be between 0 and 100".into(),
        ));
    }
    validate_date(&body.start_date, "Start date")?;
    validate_date(&body.end_date, "End date")?;
    if let (Some(start), Some(end)) = (
        optional_text(&body.start_date),
        optional_text(&body.end_date),
    ) {
        if start > end {
            return Err(AppError::BadRequest(
                "End date cannot be earlier than start date".into(),
            ));
        }
    }
    let metadata = serde_json::to_string(body.metadata.as_ref().unwrap_or(&Value::Null))
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    if metadata.len() > 20_000 {
        return Err(AppError::BadRequest(
            "Metadata is limited to 20000 bytes".into(),
        ));
    }
    Ok(())
}

fn project_select() -> &'static str {
    "SELECT id,code,name,description,status,priority,manager_id,manager_name,start_date,end_date,\
     budget_total,collaboration_workspace_id,collaboration_channel_id,related_links,created_by,\
     CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM projects"
}

fn record_select() -> &'static str {
    "SELECT id,project_id,record_type,title,description,status,priority,assignee_id,assignee_name,\
     start_date,end_date,amount,progress,metadata,created_by,\
     CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM project_records"
}

fn project_json(row: &AnyRow, identity: &Claims) -> Value {
    let created_by = row.get::<String, _>("created_by");
    let manager_id = row.try_get::<String, _>("manager_id").ok();
    serde_json::json!({
        "id":row.get::<String,_>("id"), "code":row.get::<String,_>("code"),
        "name":row.get::<String,_>("name"), "description":row.try_get::<String,_>("description").ok(),
        "status":row.get::<String,_>("status"), "priority":row.get::<String,_>("priority"),
        "managerId":manager_id, "managerName":row.get::<String,_>("manager_name"),
        "startDate":row.try_get::<String,_>("start_date").ok(), "endDate":row.try_get::<String,_>("end_date").ok(),
        "budgetTotal":row.get::<i64,_>("budget_total"),
        "collaborationWorkspaceId":row.try_get::<String,_>("collaboration_workspace_id").ok(),
        "collaborationChannelId":row.try_get::<String,_>("collaboration_channel_id").ok(),
        "relatedLinks":row.try_get::<String,_>("related_links").ok()
            .and_then(|value| serde_json::from_str::<Value>(&value).ok()).unwrap_or_else(|| serde_json::json!([])),
        "createdBy":created_by, "createdAt":row.try_get::<String,_>("created_at").ok(),
        "updatedAt":row.try_get::<String,_>("updated_at").ok(),
        "canEdit":identity.role == "admin" || created_by == identity.sub || manager_id.as_deref() == Some(identity.sub.as_str())
    })
}

fn record_json(row: &AnyRow, identity: &Claims, project: &AnyRow) -> Value {
    let created_by = row.get::<String, _>("created_by");
    let assignee_id = row.try_get::<String, _>("assignee_id").ok();
    let project_created_by = project.get::<String, _>("created_by");
    let manager_id = project.try_get::<String, _>("manager_id").ok();
    serde_json::json!({
        "id":row.get::<String,_>("id"), "projectId":row.get::<String,_>("project_id"),
        "recordType":row.get::<String,_>("record_type"), "title":row.get::<String,_>("title"),
        "description":row.try_get::<String,_>("description").ok(), "status":row.get::<String,_>("status"),
        "priority":row.get::<String,_>("priority"), "assigneeId":assignee_id,
        "assigneeName":row.try_get::<String,_>("assignee_name").ok(),
        "startDate":row.try_get::<String,_>("start_date").ok(), "endDate":row.try_get::<String,_>("end_date").ok(),
        "amount":row.try_get::<i64,_>("amount").ok(), "progress":row.get::<i64,_>("progress"),
        "metadata":row.try_get::<String,_>("metadata").ok()
            .and_then(|value| serde_json::from_str::<Value>(&value).ok()).unwrap_or_else(|| serde_json::json!({})),
        "createdBy":created_by, "createdAt":row.try_get::<String,_>("created_at").ok(),
        "updatedAt":row.try_get::<String,_>("updated_at").ok(),
        "canEdit":identity.role == "admin" || created_by == identity.sub || project_created_by == identity.sub
            || manager_id.as_deref() == Some(identity.sub.as_str()) || assignee_id.as_deref() == Some(identity.sub.as_str())
    })
}

async fn find_project(state: &AppState, id: &str) -> Result<AnyRow, AppError> {
    sqlx::query(&format!("{} WHERE id=?", project_select()))
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))
}

async fn find_record(state: &AppState, project_id: &str, id: &str) -> Result<AnyRow, AppError> {
    sqlx::query(&format!("{} WHERE project_id=? AND id=?", record_select()))
        .bind(project_id)
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Project record not found".into()))
}

async fn project_records(state: &AppState, project_id: &str) -> Result<Vec<AnyRow>, AppError> {
    Ok(sqlx::query(&format!(
        "{} WHERE project_id=? ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,updated_at DESC",
        record_select()
    ))
    .bind(project_id)
    .fetch_all(&state.db.pool)
    .await?)
}

fn ensure_project_editable(project: &AnyRow, identity: &Claims) -> Result<(), AppError> {
    let manager_id = project.try_get::<String, _>("manager_id").ok();
    if identity.role != "admin"
        && project.get::<String, _>("created_by") != identity.sub
        && manager_id.as_deref() != Some(identity.sub.as_str())
    {
        return Err(AppError::Unauthorized(
            "Only the project owner, manager, or an administrator can change this project".into(),
        ));
    }
    Ok(())
}

async fn ensure_project_access(
    state: &AppState,
    project: &AnyRow,
    identity: &Claims,
) -> Result<(), AppError> {
    if ensure_project_editable(project, identity).is_ok() {
        return Ok(());
    }
    let member = sqlx::query(
        "SELECT id FROM project_records WHERE project_id=? AND assignee_id=? AND record_type='member' AND status='active'",
    )
    .bind(project.get::<String, _>("id"))
    .bind(&identity.sub)
    .fetch_optional(&state.db.pool)
    .await?;
    if member.is_none() {
        return Err(AppError::Unauthorized(
            "Active project membership is required".into(),
        ));
    }
    Ok(())
}

async fn ensure_unique_code(
    state: &AppState,
    code: &str,
    excluding_id: Option<&str>,
) -> Result<(), AppError> {
    let existing = sqlx::query("SELECT id FROM projects WHERE code=?")
        .bind(code)
        .fetch_optional(&state.db.pool)
        .await?;
    if existing.is_some_and(|row| excluding_id != Some(row.get::<String, _>("id").as_str())) {
        return Err(AppError::BadRequest("Project code already exists".into()));
    }
    Ok(())
}

fn channel_name(code: &str) -> String {
    format!(
        "project-{}",
        code.trim().to_ascii_lowercase().replace('_', "-")
    )
}

async fn ensure_collaboration_channel(
    state: &AppState,
    identity: &Claims,
    code: &str,
    name: &str,
) -> Result<(String, String), AppError> {
    let workspace_id = if let Some(row) = sqlx::query(
        "SELECT id FROM collaboration_workspaces WHERE name='專案協作' ORDER BY created_at LIMIT 1",
    )
    .fetch_optional(&state.db.pool)
    .await?
    {
        row.get::<String, _>("id")
    } else {
        let id = generate_id();
        sqlx::query("INSERT INTO collaboration_workspaces (id,name,description,created_by,created_at,updated_at) VALUES (?,?,?, ?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
            .bind(&id).bind("專案協作").bind("由專案管理自動建立的跨部門協作空間").bind(&identity.sub)
            .execute(&state.db.pool).await?;
        id
    };
    let normalized_name = channel_name(code);
    let channel_id = if let Some(row) =
        sqlx::query("SELECT id FROM collaboration_channels WHERE workspace_id=? AND name=?")
            .bind(&workspace_id)
            .bind(&normalized_name)
            .fetch_optional(&state.db.pool)
            .await?
    {
        row.get::<String, _>("id")
    } else {
        let id = generate_id();
        sqlx::query("INSERT INTO collaboration_channels (id,workspace_id,name,description,is_private,created_by,created_at,updated_at) VALUES (?,?,?,?,0,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
            .bind(&id).bind(&workspace_id).bind(&normalized_name)
            .bind(format!("[{code}] {name} 專案協作頻道")).bind(&identity.sub)
            .execute(&state.db.pool).await?;
        id
    };
    add_channel_member(state, &channel_id, &identity.sub, "owner").await?;
    Ok((workspace_id, channel_id))
}

async fn add_channel_member(
    state: &AppState,
    channel_id: &str,
    user_id: &str,
    role: &str,
) -> Result<(), AppError> {
    let exists = sqlx::query(
        "SELECT user_id FROM collaboration_channel_members WHERE channel_id=? AND user_id=?",
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_optional(&state.db.pool)
    .await?;
    if exists.is_none() {
        sqlx::query("INSERT INTO collaboration_channel_members (channel_id,user_id,role,last_read_at) VALUES (?,?,?,CURRENT_TIMESTAMP)")
            .bind(channel_id).bind(user_id).bind(role).execute(&state.db.pool).await?;
    }
    Ok(())
}

async fn notify_project(
    state: &AppState,
    identity: &Claims,
    project: &AnyRow,
    content: String,
) -> Result<(), AppError> {
    let Some(channel_id) = project
        .try_get::<String, _>("collaboration_channel_id")
        .ok()
    else {
        return Ok(());
    };
    let message_id = generate_id();
    sqlx::query("INSERT INTO collaboration_messages (id,channel_id,user_id,username,content,created_at,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&message_id).bind(&channel_id).bind(&identity.sub).bind(&identity.username).bind(content)
        .execute(&state.db.pool).await?;
    emit_project_event(
        &channel_id,
        serde_json::json!({"type":"project.changed","channelId":channel_id,"projectId":project.get::<String,_>("id")}),
    );
    Ok(())
}

fn records_and_stats(rows: &[AnyRow], identity: &Claims, project: &AnyRow) -> (Vec<Value>, Value) {
    let records = rows
        .iter()
        .map(|row| record_json(row, identity, project))
        .collect::<Vec<_>>();
    let tasks = rows
        .iter()
        .filter(|row| row.get::<String, _>("record_type") == "task")
        .collect::<Vec<_>>();
    let task_progress = if tasks.is_empty() {
        0
    } else {
        tasks
            .iter()
            .map(|row| row.get::<i64, _>("progress"))
            .sum::<i64>()
            / tasks.len() as i64
    };
    let spent = rows
        .iter()
        .filter(|row| {
            row.get::<String, _>("record_type") == "budget"
                && row.get::<String, _>("status") == "spent"
        })
        .map(|row| row.try_get::<i64, _>("amount").unwrap_or(0))
        .sum::<i64>();
    let committed = rows
        .iter()
        .filter(|row| {
            row.get::<String, _>("record_type") == "budget"
                && matches!(
                    row.get::<String, _>("status").as_str(),
                    "committed" | "spent"
                )
        })
        .map(|row| row.try_get::<i64, _>("amount").unwrap_or(0))
        .sum::<i64>();
    let stats = serde_json::json!({
        "taskCount":tasks.len(), "taskDone":tasks.iter().filter(|row| row.get::<String,_>("status") == "done").count(),
        "progress":task_progress,
        "milestoneCount":rows.iter().filter(|row| row.get::<String,_>("record_type") == "milestone").count(),
        "milestoneCompleted":rows.iter().filter(|row| row.get::<String,_>("record_type") == "milestone" && row.get::<String,_>("status") == "completed").count(),
        "memberCount":rows.iter().filter(|row| row.get::<String,_>("record_type") == "member" && row.get::<String,_>("status") == "active").count(),
        "openRequirements":rows.iter().filter(|row| row.get::<String,_>("record_type") == "requirement" && !matches!(row.get::<String,_>("status").as_str(), "verified" | "rejected")).count(),
        "pendingAudits":rows.iter().filter(|row| row.get::<String,_>("record_type") == "audit" && !matches!(row.get::<String,_>("status").as_str(), "passed" | "failed")).count(),
        "budgetCommitted":committed, "budgetSpent":spent
    });
    (records, stats)
}

#[handler]
async fn overview(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let rows = sqlx::query(&format!("{} ORDER BY updated_at DESC", project_select()))
        .fetch_all(&state.db.pool)
        .await?;
    let projects = rows
        .iter()
        .map(|row| project_json(row, &identity))
        .collect::<Vec<_>>();
    let requested = req.query::<String>("project_id");
    let selected = requested
        .as_deref()
        .and_then(|id| rows.iter().find(|row| row.get::<String, _>("id") == id))
        .or_else(|| rows.first());
    if requested.is_some() && selected.is_none() {
        return Err(AppError::NotFound("Project not found".into()));
    }
    let (selected_project, records, stats) = if let Some(project) = selected {
        let record_rows = project_records(state, &project.get::<String, _>("id")).await?;
        let (records, stats) = records_and_stats(&record_rows, &identity, project);
        (project_json(project, &identity), records, stats)
    } else {
        (Value::Null, Vec::new(), serde_json::json!({}))
    };
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
        "projects":projects,"selectedProject":selected_project,"records":records,"stats":stats,"users":users
    })))
}

#[handler]
async fn personal(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let rows = sqlx::query(&format!("{} ORDER BY updated_at DESC", project_select()))
        .fetch_all(&state.db.pool)
        .await?;
    let mut projects = Vec::new();
    let mut tasks = Vec::new();
    let mut milestones = Vec::new();
    let mut audits = Vec::new();
    for project in &rows {
        let record_rows = project_records(state, &project.get::<String, _>("id")).await?;
        let involved = project.get::<String, _>("created_by") == identity.sub
            || project.try_get::<String, _>("manager_id").ok().as_deref()
                == Some(identity.sub.as_str())
            || record_rows.iter().any(|row| {
                row.try_get::<String, _>("assignee_id").ok().as_deref()
                    == Some(identity.sub.as_str())
            });
        if !involved {
            continue;
        }
        projects.push(project_json(project, &identity));
        for row in &record_rows {
            let record_type = row.get::<String, _>("record_type");
            let record = record_json(row, &identity, project);
            match record_type.as_str() {
                "task"
                    if row.try_get::<String, _>("assignee_id").ok().as_deref()
                        == Some(identity.sub.as_str()) =>
                {
                    tasks.push(record)
                }
                "milestone" if row.get::<String, _>("status") != "completed" => {
                    milestones.push(record)
                }
                "audit"
                    if !matches!(row.get::<String, _>("status").as_str(), "passed" | "failed") =>
                {
                    audits.push(record)
                }
                _ => {}
            }
        }
    }
    Ok(Json(
        serde_json::json!({"projects":projects,"tasks":tasks,"milestones":milestones,"audits":audits}),
    ))
}

#[handler]
async fn create_project(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let body = req
        .parse_json::<ProjectRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate_project(&body)?;
    let code = body.code.trim().to_ascii_uppercase();
    ensure_unique_code(state, &code, None).await?;
    let id = generate_id();
    let manager_id = optional_text(&body.manager_id).or_else(|| Some(identity.sub.clone()));
    let manager_name =
        optional_text(&body.manager_name).unwrap_or_else(|| identity.username.clone());
    let related_links =
        serde_json::to_string(&body.related_links.unwrap_or_else(|| serde_json::json!([])))
            .map_err(|error| AppError::BadRequest(error.to_string()))?;
    let (workspace_id, channel_id) =
        ensure_collaboration_channel(state, &identity, &code, body.name.trim()).await?;
    sqlx::query("INSERT INTO projects (id,code,name,description,status,priority,manager_id,manager_name,start_date,end_date,budget_total,collaboration_workspace_id,collaboration_channel_id,related_links,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&id).bind(&code).bind(body.name.trim()).bind(optional_text(&body.description))
        .bind(body.status.as_deref().unwrap_or("planning")).bind(body.priority.as_deref().unwrap_or("medium"))
        .bind(&manager_id).bind(&manager_name).bind(optional_text(&body.start_date)).bind(optional_text(&body.end_date))
        .bind(body.budget_total.unwrap_or(0)).bind(&workspace_id).bind(&channel_id).bind(related_links).bind(&identity.sub)
        .execute(&state.db.pool).await?;
    if let Some(manager_id) = manager_id.as_deref() {
        add_channel_member(state, &channel_id, manager_id, "owner").await?;
    }
    let project = find_project(state, &id).await?;
    notify_project(
        state,
        &identity,
        &project,
        format!("[專案同步] 建立專案 [{code}] {}", body.name.trim()),
    )
    .await?;
    Ok(Json(project_json(&project, &identity)))
}

#[handler]
async fn update_project(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_value(req, "project_id")?;
    let project = find_project(state, &id).await?;
    ensure_project_editable(&project, &identity)?;
    let body = req
        .parse_json::<ProjectRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate_project(&body)?;
    let code = body.code.trim().to_ascii_uppercase();
    ensure_unique_code(state, &code, Some(&id)).await?;
    let manager_id = optional_text(&body.manager_id);
    let manager_name =
        optional_text(&body.manager_name).unwrap_or_else(|| identity.username.clone());
    let related_links =
        serde_json::to_string(&body.related_links.unwrap_or_else(|| serde_json::json!([])))
            .map_err(|error| AppError::BadRequest(error.to_string()))?;
    sqlx::query("UPDATE projects SET code=?,name=?,description=?,status=?,priority=?,manager_id=?,manager_name=?,start_date=?,end_date=?,budget_total=?,related_links=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(&code).bind(body.name.trim()).bind(optional_text(&body.description))
        .bind(body.status.as_deref().unwrap_or("planning")).bind(body.priority.as_deref().unwrap_or("medium"))
        .bind(&manager_id).bind(&manager_name).bind(optional_text(&body.start_date)).bind(optional_text(&body.end_date))
        .bind(body.budget_total.unwrap_or(0)).bind(related_links).bind(&id).execute(&state.db.pool).await?;
    if let (Some(channel_id), Some(manager_id)) = (
        project
            .try_get::<String, _>("collaboration_channel_id")
            .ok(),
        manager_id.as_deref(),
    ) {
        add_channel_member(state, &channel_id, manager_id, "owner").await?;
    }
    let updated = find_project(state, &id).await?;
    notify_project(
        state,
        &identity,
        &updated,
        format!("[專案同步] 更新專案 [{code}] {}", body.name.trim()),
    )
    .await?;
    Ok(Json(project_json(&updated, &identity)))
}

#[handler]
async fn delete_project(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_value(req, "project_id")?;
    let project = find_project(state, &id).await?;
    ensure_project_editable(&project, &identity)?;
    notify_project(
        state,
        &identity,
        &project,
        format!(
            "[專案同步] 專案 [{}] {} 已從專案管理移除；頻道歷程保留。",
            project.get::<String, _>("code"),
            project.get::<String, _>("name")
        ),
    )
    .await?;
    sqlx::query("DELETE FROM project_records WHERE project_id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    sqlx::query("DELETE FROM projects WHERE id=?")
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    Ok(Json(
        serde_json::json!({"deleted":true,"collaborationHistoryPreserved":true}),
    ))
}

#[handler]
async fn create_record(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let project_id = path_value(req, "project_id")?;
    let record_type = path_value(req, "record_type")?;
    if !RECORD_TYPES.contains(&record_type.as_str()) {
        return Err(AppError::BadRequest("Invalid project record type".into()));
    }
    let project = find_project(state, &project_id).await?;
    ensure_project_access(state, &project, &identity).await?;
    let body = req
        .parse_json::<ProjectRecordRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate_record(&record_type, &body)?;
    let id = generate_id();
    let metadata = serde_json::to_string(&body.metadata.unwrap_or_else(|| serde_json::json!({})))
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    sqlx::query("INSERT INTO project_records (id,project_id,record_type,title,description,status,priority,assignee_id,assignee_name,start_date,end_date,amount,progress,metadata,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&id).bind(&project_id).bind(&record_type).bind(body.title.trim()).bind(optional_text(&body.description))
        .bind(body.status.as_deref().unwrap_or(default_status(&record_type))).bind(body.priority.as_deref().unwrap_or("medium"))
        .bind(optional_text(&body.assignee_id)).bind(optional_text(&body.assignee_name))
        .bind(optional_text(&body.start_date)).bind(optional_text(&body.end_date)).bind(body.amount).bind(body.progress.unwrap_or(0))
        .bind(metadata).bind(&identity.sub).execute(&state.db.pool).await?;
    if let ("member", Some(user_id), Some(channel_id)) = (
        record_type.as_str(),
        optional_text(&body.assignee_id),
        project
            .try_get::<String, _>("collaboration_channel_id")
            .ok(),
    ) {
        add_channel_member(state, &channel_id, &user_id, "member").await?;
    }
    let row = find_record(state, &project_id, &id).await?;
    notify_project(
        state,
        &identity,
        &project,
        format!("[專案同步] 新增 {}：{}", record_type, body.title.trim()),
    )
    .await?;
    Ok(Json(record_json(&row, &identity, &project)))
}

#[handler]
async fn update_record(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let project_id = path_value(req, "project_id")?;
    let record_type = path_value(req, "record_type")?;
    let id = path_value(req, "record_id")?;
    let project = find_project(state, &project_id).await?;
    let existing = find_record(state, &project_id, &id).await?;
    if existing.get::<String, _>("record_type") != record_type {
        return Err(AppError::NotFound("Project record not found".into()));
    }
    let editable = record_json(&existing, &identity, &project)["canEdit"]
        .as_bool()
        .unwrap_or(false);
    if !editable {
        return Err(AppError::Unauthorized(
            "This project record cannot be changed by the current user".into(),
        ));
    }
    let body = req
        .parse_json::<ProjectRecordRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate_record(&record_type, &body)?;
    let metadata = serde_json::to_string(&body.metadata.unwrap_or_else(|| serde_json::json!({})))
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    sqlx::query("UPDATE project_records SET title=?,description=?,status=?,priority=?,assignee_id=?,assignee_name=?,start_date=?,end_date=?,amount=?,progress=?,metadata=?,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND id=?")
        .bind(body.title.trim()).bind(optional_text(&body.description)).bind(body.status.as_deref().unwrap_or(default_status(&record_type)))
        .bind(body.priority.as_deref().unwrap_or("medium")).bind(optional_text(&body.assignee_id)).bind(optional_text(&body.assignee_name))
        .bind(optional_text(&body.start_date)).bind(optional_text(&body.end_date)).bind(body.amount).bind(body.progress.unwrap_or(0)).bind(metadata)
        .bind(&project_id).bind(&id).execute(&state.db.pool).await?;
    if let ("member", Some(user_id), Some(channel_id)) = (
        record_type.as_str(),
        optional_text(&body.assignee_id),
        project
            .try_get::<String, _>("collaboration_channel_id")
            .ok(),
    ) {
        add_channel_member(state, &channel_id, &user_id, "member").await?;
    }
    let row = find_record(state, &project_id, &id).await?;
    notify_project(
        state,
        &identity,
        &project,
        format!("[專案同步] 更新 {}：{}", record_type, body.title.trim()),
    )
    .await?;
    Ok(Json(record_json(&row, &identity, &project)))
}

#[handler]
async fn delete_record(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let project_id = path_value(req, "project_id")?;
    let record_type = path_value(req, "record_type")?;
    let id = path_value(req, "record_id")?;
    let project = find_project(state, &project_id).await?;
    let existing = find_record(state, &project_id, &id).await?;
    if existing.get::<String, _>("record_type") != record_type {
        return Err(AppError::NotFound("Project record not found".into()));
    }
    let editable = record_json(&existing, &identity, &project)["canEdit"]
        .as_bool()
        .unwrap_or(false);
    if !editable {
        return Err(AppError::Unauthorized(
            "This project record cannot be deleted by the current user".into(),
        ));
    }
    let title = existing.get::<String, _>("title");
    sqlx::query("DELETE FROM project_records WHERE project_id=? AND id=?")
        .bind(&project_id)
        .bind(&id)
        .execute(&state.db.pool)
        .await?;
    notify_project(
        state,
        &identity,
        &project,
        format!("[專案同步] 刪除 {}：{}", record_type, title),
    )
    .await?;
    Ok(Json(serde_json::json!({"deleted":true})))
}

pub fn router() -> Router {
    Router::with_path("projects")
        .get(overview)
        .post(create_project)
        .push(Router::with_path("personal").get(personal))
        .push(
            Router::with_path("<project_id>")
                .put(update_project)
                .delete(delete_project)
                .push(
                    Router::with_path("records/<record_type>")
                        .post(create_record)
                        .push(
                            Router::with_path("<record_id>")
                                .put(update_record)
                                .delete(delete_record),
                        ),
                ),
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(status: &str) -> ProjectRecordRequest {
        ProjectRecordRequest {
            title: "Release candidate".into(),
            description: None,
            status: Some(status.into()),
            priority: Some("high".into()),
            assignee_id: None,
            assignee_name: None,
            start_date: Some("2026-07-01".into()),
            end_date: Some("2026-07-31".into()),
            amount: None,
            progress: Some(50),
            metadata: None,
        }
    }

    #[test]
    fn validates_record_status_by_type() {
        assert!(validate_record("task", &record("in_progress")).is_ok());
        assert!(validate_record("milestone", &record("in_progress")).is_ok());
        assert!(validate_record("budget", &record("in_progress")).is_err());
    }

    #[test]
    fn rejects_reversed_dates_and_bad_progress() {
        let mut value = record("todo");
        value.end_date = Some("2026-06-30".into());
        assert!(validate_record("task", &value).is_err());
        value.end_date = Some("2026-07-31".into());
        value.progress = Some(101);
        assert!(validate_record("task", &value).is_err());
    }
}
