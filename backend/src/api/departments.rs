use crate::core::state::AppState;
use crate::errors::AppError;
use chrono::{NaiveDate, Utc};
use cortex_lib::utils::generate_id;
use eiva_be_security::jwt::{verify_token, Claims};
use salvo::prelude::*;
use serde::Deserialize;
use serde_json::Value;
use sqlx::{any::AnyRow, Row};

const STATUSES: &[&str] = &[
    "planned",
    "active",
    "pending_review",
    "blocked",
    "completed",
    "archived",
];
const PRIORITIES: &[&str] = &["low", "medium", "high", "critical"];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DepartmentItemRequest {
    item_type: String,
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    owner_name: Option<String>,
    amount: Option<i64>,
    due_date: Option<String>,
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

fn department_item_types(department: &str) -> Option<&'static [&'static str]> {
    match department {
        "ceo" => Some(&["strategy", "kpi", "decision", "enterprise_risk"]),
        "cfo" => Some(&["budget", "expense", "cashflow", "financial_approval"]),
        "cto" => Some(&["roadmap", "architecture", "innovation", "technical_risk"]),
        "sales" => Some(&["opportunity", "pipeline", "forecast", "customer_action"]),
        "administration" => Some(&["announcement", "facility", "general_request", "asset"]),
        "hr" => Some(&["recruitment", "onboarding", "training", "people_action"]),
        "procurement" => Some(&["purchase_request", "supplier", "contract", "quotation"]),
        "mis" => Some(&["service_request", "incident", "it_asset", "maintenance"]),
        "sales-projects" => Some(&[
            "customer_project",
            "milestone",
            "deliverable",
            "project_risk",
        ]),
        "it-projects" => Some(&["it_project", "sprint", "deployment", "project_risk"]),
        "information-security" => Some(&[
            "security_incident",
            "vulnerability",
            "compliance",
            "security_risk",
        ]),
        _ => None,
    }
}

fn department(req: &Request) -> Result<String, AppError> {
    let department = req
        .param::<String>("department")
        .ok_or_else(|| AppError::BadRequest("Missing department".into()))?;
    if department_item_types(&department).is_none() {
        return Err(AppError::NotFound("Department not found".into()));
    }
    Ok(department)
}

fn item_id(req: &Request) -> Result<String, AppError> {
    req.param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing item id".into()))
}

fn trimmed_optional(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn validate_request(department: &str, body: &DepartmentItemRequest) -> Result<(), AppError> {
    let title = body.title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(AppError::BadRequest(
            "Title must contain 1 to 200 characters".into(),
        ));
    }
    if !department_item_types(department)
        .is_some_and(|types| types.contains(&body.item_type.as_str()))
    {
        return Err(AppError::BadRequest(
            "Item type is not available for this department".into(),
        ));
    }
    let status = body.status.as_deref().unwrap_or("planned");
    if !STATUSES.contains(&status) {
        return Err(AppError::BadRequest("Invalid status".into()));
    }
    let priority = body.priority.as_deref().unwrap_or("medium");
    if !PRIORITIES.contains(&priority) {
        return Err(AppError::BadRequest("Invalid priority".into()));
    }
    if body
        .description
        .as_ref()
        .is_some_and(|value| value.chars().count() > 5000)
    {
        return Err(AppError::BadRequest(
            "Description is limited to 5000 characters".into(),
        ));
    }
    if body
        .owner_name
        .as_ref()
        .is_some_and(|value| value.chars().count() > 120)
    {
        return Err(AppError::BadRequest(
            "Owner name is limited to 120 characters".into(),
        ));
    }
    if let Some(due_date) = trimmed_optional(&body.due_date) {
        NaiveDate::parse_from_str(&due_date, "%Y-%m-%d")
            .map_err(|_| AppError::BadRequest("Due date must use YYYY-MM-DD".into()))?;
    }
    if body.amount.is_some_and(|amount| amount < 0) {
        return Err(AppError::BadRequest("Amount cannot be negative".into()));
    }
    Ok(())
}

fn item_json(row: &AnyRow, identity: &Claims) -> Value {
    let created_by = row.get::<String, _>("created_by");
    serde_json::json!({
        "id": row.get::<String,_>("id"),
        "department": row.get::<String,_>("department"),
        "itemType": row.get::<String,_>("item_type"),
        "title": row.get::<String,_>("title"),
        "description": row.try_get::<String,_>("description").ok(),
        "status": row.get::<String,_>("status"),
        "priority": row.get::<String,_>("priority"),
        "ownerName": row.get::<String,_>("owner_name"),
        "amount": row.try_get::<i64,_>("amount").ok(),
        "dueDate": row.try_get::<String,_>("due_date").ok(),
        "metadata": row.try_get::<String,_>("metadata").ok()
            .and_then(|value| serde_json::from_str::<Value>(&value).ok())
            .unwrap_or_else(|| serde_json::json!({})),
        "createdBy": created_by,
        "createdAt": row.try_get::<String,_>("created_at").ok(),
        "updatedAt": row.try_get::<String,_>("updated_at").ok(),
        "canEdit": identity.role == "admin" || row.get::<String,_>("created_by") == identity.sub,
    })
}

async fn find_item(state: &AppState, department: &str, id: &str) -> Result<AnyRow, AppError> {
    sqlx::query(
        "SELECT id,department,item_type,title,description,status,priority,owner_name,amount,due_date,metadata,created_by,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM department_items WHERE department=? AND id=?",
    )
    .bind(department)
    .bind(id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Department item not found".into()))
}

#[handler]
async fn overview(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let department = department(req)?;
    let rows = sqlx::query(
        "SELECT id,department,item_type,title,description,status,priority,owner_name,amount,due_date,metadata,created_by,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM department_items WHERE department=? ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,updated_at DESC",
    )
    .bind(&department)
    .fetch_all(&state.db.pool)
    .await?;

    let today = Utc::now().date_naive().format("%Y-%m-%d").to_string();
    let mut active = 0_i64;
    let mut completed = 0_i64;
    let mut blocked = 0_i64;
    let mut high_priority = 0_i64;
    let mut overdue = 0_i64;
    let mut amount_total = 0_i64;
    for row in &rows {
        let status = row.get::<String, _>("status");
        match status.as_str() {
            "active" | "pending_review" => active += 1,
            "completed" => completed += 1,
            "blocked" => blocked += 1,
            _ => {}
        }
        if matches!(
            row.get::<String, _>("priority").as_str(),
            "high" | "critical"
        ) {
            high_priority += 1;
        }
        if status != "completed"
            && status != "archived"
            && row
                .try_get::<String, _>("due_date")
                .ok()
                .is_some_and(|date| date < today)
        {
            overdue += 1;
        }
        amount_total += row.try_get::<i64, _>("amount").unwrap_or(0);
    }
    let items = rows
        .iter()
        .map(|row| item_json(row, &identity))
        .collect::<Vec<_>>();
    Ok(Json(serde_json::json!({
        "department": department,
        "allowedItemTypes": department_item_types(&department).unwrap_or_default(),
        "stats": {
            "total": items.len(), "active": active, "completed": completed,
            "blocked": blocked, "highPriority": high_priority,
            "overdue": overdue, "amountTotal": amount_total
        },
        "items": items,
        "currentUser": {"id":identity.sub,"username":identity.username,"role":identity.role}
    })))
}

#[handler]
async fn create_item(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let department = department(req)?;
    let body = req
        .parse_json::<DepartmentItemRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate_request(&department, &body)?;
    let id = generate_id();
    let owner_name =
        trimmed_optional(&body.owner_name).unwrap_or_else(|| identity.username.clone());
    let metadata = serde_json::to_string(&body.metadata.unwrap_or_else(|| serde_json::json!({})))
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    sqlx::query("INSERT INTO department_items (id,department,item_type,title,description,status,priority,owner_name,amount,due_date,metadata,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&id).bind(&department).bind(&body.item_type).bind(body.title.trim())
        .bind(trimmed_optional(&body.description)).bind(body.status.as_deref().unwrap_or("planned"))
        .bind(body.priority.as_deref().unwrap_or("medium")).bind(owner_name).bind(body.amount)
        .bind(trimmed_optional(&body.due_date)).bind(metadata).bind(&identity.sub)
        .execute(&state.db.pool).await?;
    let row = find_item(state, &department, &id).await?;
    Ok(Json(item_json(&row, &identity)))
}

fn ensure_editable(row: &AnyRow, identity: &Claims) -> Result<(), AppError> {
    if identity.role != "admin" && row.get::<String, _>("created_by") != identity.sub {
        return Err(AppError::Unauthorized(
            "Only the creator or an administrator can change this item".into(),
        ));
    }
    Ok(())
}

#[handler]
async fn update_item(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let department = department(req)?;
    let id = item_id(req)?;
    let existing = find_item(state, &department, &id).await?;
    ensure_editable(&existing, &identity)?;
    let body = req
        .parse_json::<DepartmentItemRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate_request(&department, &body)?;
    let owner_name =
        trimmed_optional(&body.owner_name).unwrap_or_else(|| identity.username.clone());
    let metadata = serde_json::to_string(&body.metadata.unwrap_or_else(|| serde_json::json!({})))
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    sqlx::query("UPDATE department_items SET item_type=?,title=?,description=?,status=?,priority=?,owner_name=?,amount=?,due_date=?,metadata=?,updated_at=CURRENT_TIMESTAMP WHERE department=? AND id=?")
        .bind(&body.item_type).bind(body.title.trim()).bind(trimmed_optional(&body.description))
        .bind(body.status.as_deref().unwrap_or("planned")).bind(body.priority.as_deref().unwrap_or("medium"))
        .bind(owner_name).bind(body.amount).bind(trimmed_optional(&body.due_date)).bind(metadata)
        .bind(&department).bind(&id).execute(&state.db.pool).await?;
    let row = find_item(state, &department, &id).await?;
    Ok(Json(item_json(&row, &identity)))
}

#[handler]
async fn delete_item(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let department = department(req)?;
    let id = item_id(req)?;
    let existing = find_item(state, &department, &id).await?;
    ensure_editable(&existing, &identity)?;
    sqlx::query("DELETE FROM department_items WHERE department=? AND id=?")
        .bind(department)
        .bind(id)
        .execute(&state.db.pool)
        .await?;
    Ok(Json(serde_json::json!({"deleted":true})))
}

pub fn router() -> Router {
    Router::with_path("departments").push(
        Router::with_path("<department>")
            .get(overview)
            .push(Router::with_path("items").post(create_item))
            .push(
                Router::with_path("items/<id>")
                    .put(update_item)
                    .delete(delete_item),
            ),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_request(item_type: &str) -> DepartmentItemRequest {
        DepartmentItemRequest {
            item_type: item_type.into(),
            title: "Quarterly objective".into(),
            description: None,
            status: Some("active".into()),
            priority: Some("high".into()),
            owner_name: None,
            amount: None,
            due_date: Some("2026-12-31".into()),
            metadata: None,
        }
    }

    #[test]
    fn accepts_department_specific_item_type() {
        assert!(validate_request("ceo", &valid_request("strategy")).is_ok());
        assert!(validate_request("information-security", &valid_request("vulnerability")).is_ok());
    }

    #[test]
    fn rejects_cross_department_item_type_and_bad_date() {
        assert!(validate_request("cfo", &valid_request("strategy")).is_err());
        let mut request = valid_request("budget");
        request.due_date = Some("12/31/2026".into());
        assert!(validate_request("cfo", &request).is_err());
    }
}
