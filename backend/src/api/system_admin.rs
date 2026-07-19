use crate::core::state::AppState;
use crate::errors::AppError;
use cortex_lib::utils::generate_id;
use eiva_be_security::jwt::{verify_token, Claims};
use eiva_be_security::password::hash_password;
use salvo::prelude::*;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{any::AnyRow, Row};
use tokio::sync::OnceCell;

const ENTITY_TYPES: &[&str] = &[
    "users",
    "departments",
    "roles",
    "permissions",
    "menus",
    "enterprise-systems",
    "ai-models",
    "contexts",
    "channels",
    "schedules",
    "ai-providers",
    "auto-approve",
    "auto-complete",
    "notifications",
    "commit-messages",
    "sandboxes",
    "languages",
    "about",
];
static DEFAULTS_READY: OnceCell<()> = OnceCell::const_new();

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminRecordRequest {
    key: String,
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    data: Value,
    #[serde(default = "default_true")]
    is_active: bool,
    #[serde(default)]
    sort_order: i64,
}

fn default_true() -> bool {
    true
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

fn administrator(req: &Request, state: &AppState) -> Result<Claims, AppError> {
    let identity = authentication(req, state)?;
    if identity.role != "admin" {
        return Err(AppError::Unauthorized(
            "Administrator role is required".into(),
        ));
    }
    Ok(identity)
}

fn entity(req: &Request) -> Result<String, AppError> {
    let value = req
        .param::<String>("entity")
        .unwrap_or_default()
        .to_lowercase();
    if !ENTITY_TYPES.contains(&value.as_str()) {
        return Err(AppError::NotFound("Unknown system setting entity".into()));
    }
    Ok(value)
}

fn trim_optional(value: Option<&str>, maximum: usize) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(maximum).collect())
}

fn string_field(data: &Value, key: &str) -> String {
    data.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn validate_payload(body: &AdminRecordRequest) -> Result<(), AppError> {
    let key = body.key.trim();
    let name = body.name.trim();
    if key.is_empty()
        || key.chars().count() > 160
        || key.chars().any(char::is_control)
        || name.is_empty()
        || name.chars().count() > 240
    {
        return Err(AppError::BadRequest(
            "Key and name are required and must be within their length limits".into(),
        ));
    }
    if body
        .description
        .as_deref()
        .is_some_and(|value| value.chars().count() > 2_000)
        || !body.data.is_object()
        || serde_json::to_vec(&body.data)
            .map(|value| value.len() > 65_536)
            .unwrap_or(true)
        || !(-100_000..=100_000).contains(&body.sort_order)
    {
        return Err(AppError::BadRequest("Invalid system setting data".into()));
    }
    Ok(())
}

fn has_plaintext_secret(value: &Value) -> bool {
    match value {
        Value::Object(object) => object.iter().any(|(key, value)| {
            matches!(
                key.to_lowercase().replace(['-', '_'], "").as_str(),
                "apikey" | "password" | "token" | "secret" | "clientsecret"
            ) || has_plaintext_secret(value)
        }),
        Value::Array(values) => values.iter().any(has_plaintext_secret),
        _ => false,
    }
}

fn valid_optional_url(value: &str) -> bool {
    value.is_empty()
        || reqwest::Url::parse(value)
            .ok()
            .is_some_and(|url| matches!(url.scheme(), "http" | "https"))
}

fn validate_entity_payload(entity: &str, body: &AdminRecordRequest) -> Result<(), AppError> {
    if entity != "users" && has_plaintext_secret(&body.data) {
        return Err(AppError::BadRequest(
            "Plaintext passwords, API keys, tokens, and secrets cannot be stored; use a credential reference"
                .into(),
        ));
    }
    let required: &[&str] = match entity {
        "enterprise-systems" => &["companyName", "systemType"],
        "ai-models" => &["provider", "model"],
        "contexts" => &["template"],
        "channels" => &["channelType"],
        "schedules" => &["cron", "handler"],
        "ai-providers" => &["provider", "baseUrl", "credentialRef"],
        "auto-approve" => &["scope", "condition"],
        "auto-complete" => &["scope", "template"],
        "notifications" => &["event", "template"],
        "commit-messages" => &["pattern"],
        "sandboxes" => &["runtime"],
        "languages" => &["locale"],
        "about" => &["companyName", "productName"],
        _ => &[],
    };
    if required
        .iter()
        .any(|key| string_field(&body.data, key).is_empty())
    {
        return Err(AppError::BadRequest(format!(
            "Missing required data for {entity}"
        )));
    }
    if entity == "roles"
        && !body
            .data
            .get("permissionCodes")
            .and_then(Value::as_array)
            .is_some_and(|codes| !codes.is_empty())
    {
        return Err(AppError::BadRequest(
            "A role requires at least one permission code".into(),
        ));
    }
    if entity == "permissions" && string_field(&body.data, "resource").is_empty() {
        return Err(AppError::BadRequest(
            "A permission resource is required".into(),
        ));
    }
    if entity == "menus" && !string_field(&body.data, "path").starts_with("/cortex") {
        return Err(AppError::BadRequest(
            "Menu paths must start with /cortex".into(),
        ));
    }
    for key in ["baseUrl", "endpoint", "website"] {
        if !valid_optional_url(&string_field(&body.data, key)) {
            return Err(AppError::BadRequest(format!(
                "{key} must use http or https"
            )));
        }
    }
    Ok(())
}

async fn validate_user_references(
    state: &AppState,
    body: &AdminRecordRequest,
) -> Result<(), AppError> {
    if string_field(&body.data, "company").is_empty() {
        return Err(AppError::BadRequest("User company is required".into()));
    }
    let role = string_field(&body.data, "role");
    if sqlx::query("SELECT id FROM system_admin_records WHERE entity_type='roles' AND record_key=? AND is_active=1")
        .bind(&role).fetch_optional(&state.db.pool).await?.is_none()
    {
        return Err(AppError::BadRequest("The selected role is not available".into()));
    }
    let department = string_field(&body.data, "departmentKey");
    if !department.is_empty()
        && sqlx::query("SELECT id FROM system_admin_records WHERE entity_type='departments' AND record_key=? AND is_active=1")
            .bind(&department).fetch_optional(&state.db.pool).await?.is_none()
    {
        return Err(AppError::BadRequest(
            "The selected department is not available".into(),
        ));
    }
    Ok(())
}

fn record_json(row: &AnyRow) -> Value {
    json!({
        "id": row.get::<String, _>("id"),
        "key": row.get::<String, _>("record_key"),
        "name": row.get::<String, _>("name"),
        "description": row.try_get::<String, _>("description").ok(),
        "data": serde_json::from_str::<Value>(&row.get::<String, _>("data")).unwrap_or_else(|_| json!({})),
        "isActive": row_bool(row, "is_active"),
        "sortOrder": row.get::<i64, _>("sort_order"),
        "createdBy": row.get::<String, _>("created_by"),
        "createdAt": row.try_get::<String, _>("created_at").ok(),
        "updatedAt": row.try_get::<String, _>("updated_at").ok(),
    })
}

fn user_json(row: &AnyRow) -> Value {
    let username = row.get::<String, _>("username");
    let display_name = row
        .try_get::<String, _>("display_name")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| username.clone());
    json!({
        "id": row.get::<String, _>("id"),
        "key": username,
        "name": display_name,
        "description": row.try_get::<String, _>("permission_summary").ok(),
        "isActive": row_bool(row, "is_active"),
        "sortOrder": 0,
        "createdAt": row.try_get::<String, _>("created_at").ok(),
        "updatedAt": row.try_get::<String, _>("profile_updated_at").ok(),
        "data": {
            "email": row.get::<String, _>("email"),
            "role": row.get::<String, _>("role"),
            "company": row.try_get::<String, _>("company").ok().unwrap_or_default(),
            "departmentKey": row.try_get::<String, _>("department_key").ok(),
            "jobTitle": row.try_get::<String, _>("job_title").ok(),
            "permissionSummary": row.try_get::<String, _>("permission_summary").ok(),
        }
    })
}

fn row_bool(row: &AnyRow, column: &'static str) -> bool {
    row.try_get::<bool, _>(column)
        .unwrap_or_else(|_| row.try_get::<i64, _>(column).unwrap_or_default() != 0)
}

fn user_select() -> &'static str {
    "SELECT u.id,u.username,u.email,u.role,u.is_active,CAST(u.created_at AS TEXT) AS created_at,\
     p.company,p.department_key,p.display_name,p.job_title,p.permission_summary,\
     CAST(p.updated_at AS TEXT) AS profile_updated_at FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id"
}

async fn ensure_profile(
    state: &AppState,
    user_id: &str,
    body: &AdminRecordRequest,
    identity: &Claims,
) -> Result<(), AppError> {
    let company = string_field(&body.data, "company");
    let department = trim_optional(body.data.get("departmentKey").and_then(Value::as_str), 160);
    let title = trim_optional(body.data.get("jobTitle").and_then(Value::as_str), 200);
    let permission = trim_optional(
        body.data.get("permissionSummary").and_then(Value::as_str),
        500,
    );
    let exists = sqlx::query("SELECT user_id FROM user_profiles WHERE user_id=?")
        .bind(user_id)
        .fetch_optional(&state.db.pool)
        .await?
        .is_some();
    if exists {
        sqlx::query("UPDATE user_profiles SET company=?,department_key=?,display_name=?,job_title=?,permission_summary=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?")
            .bind(company).bind(department).bind(body.name.trim()).bind(title).bind(permission)
            .bind(&identity.sub).bind(user_id).execute(&state.db.pool).await?;
    } else {
        sqlx::query("INSERT INTO user_profiles (user_id,company,department_key,display_name,job_title,permission_summary,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
            .bind(user_id).bind(company).bind(department).bind(body.name.trim()).bind(title)
            .bind(permission).bind(&identity.sub).execute(&state.db.pool).await?;
    }
    Ok(())
}

async fn list_users(
    state: &AppState,
    search: &str,
    page: i64,
    page_size: i64,
) -> Result<(Vec<Value>, i64), AppError> {
    let pattern = format!("%{}%", search.trim().to_lowercase());
    let where_clause = " WHERE LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.role) LIKE ? OR LOWER(COALESCE(p.company,'')) LIKE ? OR LOWER(COALESCE(p.display_name,'')) LIKE ? OR LOWER(COALESCE(p.job_title,'')) LIKE ?";
    let count_sql = format!(
        "SELECT COUNT(*) AS count FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id{where_clause}"
    );
    let mut count = sqlx::query(&count_sql);
    for _ in 0..6 {
        count = count.bind(&pattern);
    }
    let total = count
        .fetch_one(&state.db.pool)
        .await?
        .get::<i64, _>("count");
    let list_sql = format!(
        "{}{where_clause} ORDER BY u.username LIMIT ? OFFSET ?",
        user_select()
    );
    let mut query = sqlx::query(&list_sql);
    for _ in 0..6 {
        query = query.bind(&pattern);
    }
    let rows = query
        .bind(page_size)
        .bind((page - 1) * page_size)
        .fetch_all(&state.db.pool)
        .await?;
    Ok((rows.iter().map(user_json).collect(), total))
}

async fn list_records(
    state: &AppState,
    entity: &str,
    search: &str,
    page: i64,
    page_size: i64,
) -> Result<(Vec<Value>, i64), AppError> {
    let pattern = format!("%{}%", search.trim().to_lowercase());
    let total = sqlx::query("SELECT COUNT(*) AS count FROM system_admin_records WHERE entity_type=? AND (LOWER(record_key) LIKE ? OR LOWER(name) LIKE ? OR LOWER(COALESCE(description,'')) LIKE ? OR LOWER(data) LIKE ?)")
        .bind(entity).bind(&pattern).bind(&pattern).bind(&pattern).bind(&pattern)
        .fetch_one(&state.db.pool).await?.get::<i64,_>("count");
    let rows = sqlx::query("SELECT id,record_key,name,description,data,is_active,sort_order,created_by,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM system_admin_records WHERE entity_type=? AND (LOWER(record_key) LIKE ? OR LOWER(name) LIKE ? OR LOWER(COALESCE(description,'')) LIKE ? OR LOWER(data) LIKE ?) ORDER BY sort_order,name LIMIT ? OFFSET ?")
        .bind(entity).bind(&pattern).bind(&pattern).bind(&pattern).bind(&pattern)
        .bind(page_size).bind((page - 1) * page_size).fetch_all(&state.db.pool).await?;
    Ok((rows.iter().map(record_json).collect(), total))
}

#[handler]
async fn list(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    administrator(req, state)?;
    let entity = entity(req)?;
    ensure_defaults(state).await?;
    let page = req.query::<i64>("page").unwrap_or(1).max(1);
    let page_size = req.query::<i64>("pageSize").unwrap_or(20).clamp(5, 100);
    let search = req.query::<String>("search").unwrap_or_default();
    let (records, total) = if entity == "users" {
        list_users(state, &search, page, page_size).await?
    } else {
        list_records(state, &entity, &search, page, page_size).await?
    };
    Ok(Json(json!({
        "records":records,"page":page,"pageSize":page_size,"total":total,
        "totalPages":if total == 0 { 1 } else { (total + page_size - 1) / page_size }
    })))
}

async fn create_user(
    state: &AppState,
    body: &AdminRecordRequest,
    identity: &Claims,
) -> Result<Value, AppError> {
    validate_user_references(state, body).await?;
    let email = string_field(&body.data, "email");
    let password = string_field(&body.data, "password");
    let role = string_field(&body.data, "role");
    if !email.contains('@') || password.chars().count() < 8 || role.is_empty() {
        return Err(AppError::BadRequest(
            "A valid email, role, and password of at least 8 characters are required".into(),
        ));
    }
    let id = generate_id();
    let result = sqlx::query(
        "INSERT INTO users (id,username,email,password_hash,role,is_active) VALUES (?,?,?,?,?,?)",
    )
    .bind(&id)
    .bind(body.key.trim())
    .bind(email)
    .bind(hash_password(&password))
    .bind(role)
    .bind(body.is_active)
    .execute(&state.db.pool)
    .await;
    if let Err(error) = result {
        return Err(
            if error
                .as_database_error()
                .is_some_and(|error| error.is_unique_violation())
            {
                AppError::Conflict("Username or email already exists".into())
            } else {
                AppError::Database(error)
            },
        );
    }
    ensure_profile(state, &id, body, identity).await?;
    let row = sqlx::query(&format!("{} WHERE u.id=?", user_select()))
        .bind(&id)
        .fetch_one(&state.db.pool)
        .await?;
    Ok(user_json(&row))
}

async fn create_record(
    state: &AppState,
    entity: &str,
    body: &AdminRecordRequest,
    identity: &Claims,
) -> Result<Value, AppError> {
    let id = generate_id();
    let result = sqlx::query("INSERT INTO system_admin_records (id,entity_type,record_key,name,description,data,is_active,sort_order,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&id).bind(entity).bind(body.key.trim()).bind(body.name.trim())
        .bind(trim_optional(body.description.as_deref(), 2_000))
        .bind(serde_json::to_string(&body.data).map_err(|error| AppError::BadRequest(error.to_string()))?)
        .bind(body.is_active).bind(body.sort_order).bind(&identity.sub).execute(&state.db.pool).await;
    if let Err(error) = result {
        return Err(
            if error
                .as_database_error()
                .is_some_and(|error| error.is_unique_violation())
            {
                AppError::Conflict("The setting key already exists".into())
            } else {
                AppError::Database(error)
            },
        );
    }
    find_record(state, entity, &id).await
}

#[handler]
async fn create(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = administrator(req, state)?;
    let entity = entity(req)?;
    ensure_defaults(state).await?;
    let body = req
        .parse_json::<AdminRecordRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate_payload(&body)?;
    validate_entity_payload(&entity, &body)?;
    let value = if entity == "users" {
        create_user(state, &body, &identity).await?
    } else {
        create_record(state, &entity, &body, &identity).await?
    };
    Ok(Json(value))
}

async fn find_record(state: &AppState, entity: &str, id: &str) -> Result<Value, AppError> {
    let row = sqlx::query("SELECT id,record_key,name,description,data,is_active,sort_order,created_by,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM system_admin_records WHERE entity_type=? AND id=?")
        .bind(entity).bind(id).fetch_optional(&state.db.pool).await?
        .ok_or_else(|| AppError::NotFound("System setting record not found".into()))?;
    Ok(record_json(&row))
}

async fn update_user(
    state: &AppState,
    id: &str,
    body: &AdminRecordRequest,
    identity: &Claims,
) -> Result<Value, AppError> {
    validate_user_references(state, body).await?;
    let existing = sqlx::query("SELECT username,role FROM users WHERE id=?")
        .bind(id)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;
    let role = string_field(&body.data, "role");
    let email = string_field(&body.data, "email");
    if !email.contains('@') || role.is_empty() {
        return Err(AppError::BadRequest(
            "A valid email and role are required".into(),
        ));
    }
    if id == identity.sub && (!body.is_active || role != existing.get::<String, _>("role")) {
        return Err(AppError::BadRequest(
            "You cannot deactivate your own account or change its role".into(),
        ));
    }
    let password = string_field(&body.data, "password");
    if !password.is_empty() && password.chars().count() < 8 {
        return Err(AppError::BadRequest(
            "Password must contain at least 8 characters".into(),
        ));
    }
    let result = sqlx::query("UPDATE users SET username=?,email=?,role=?,is_active=? WHERE id=?")
        .bind(body.key.trim())
        .bind(email)
        .bind(role)
        .bind(body.is_active)
        .bind(id)
        .execute(&state.db.pool)
        .await;
    if let Err(error) = result {
        return Err(
            if error
                .as_database_error()
                .is_some_and(|error| error.is_unique_violation())
            {
                AppError::Conflict("Username or email already exists".into())
            } else {
                AppError::Database(error)
            },
        );
    }
    if !password.is_empty() {
        sqlx::query("UPDATE users SET password_hash=? WHERE id=?")
            .bind(hash_password(&password))
            .bind(id)
            .execute(&state.db.pool)
            .await?;
    }
    ensure_profile(state, id, body, identity).await?;
    let row = sqlx::query(&format!("{} WHERE u.id=?", user_select()))
        .bind(id)
        .fetch_one(&state.db.pool)
        .await?;
    Ok(user_json(&row))
}

#[handler]
async fn update(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = administrator(req, state)?;
    let entity = entity(req)?;
    ensure_defaults(state).await?;
    let id = req.param::<String>("id").unwrap_or_default();
    let body = req
        .parse_json::<AdminRecordRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate_payload(&body)?;
    validate_entity_payload(&entity, &body)?;
    if entity == "users" {
        return Ok(Json(update_user(state, &id, &body, &identity).await?));
    }
    let result = sqlx::query("UPDATE system_admin_records SET record_key=?,name=?,description=?,data=?,is_active=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE entity_type=? AND id=?")
        .bind(body.key.trim()).bind(body.name.trim()).bind(trim_optional(body.description.as_deref(),2_000))
        .bind(serde_json::to_string(&body.data).map_err(|error|AppError::BadRequest(error.to_string()))?)
        .bind(body.is_active).bind(body.sort_order).bind(&entity).bind(&id).execute(&state.db.pool).await;
    let result = match result {
        Ok(result) => result,
        Err(error)
            if error
                .as_database_error()
                .is_some_and(|error| error.is_unique_violation()) =>
        {
            return Err(AppError::Conflict("The setting key already exists".into()));
        }
        Err(error) => return Err(AppError::Database(error)),
    };
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("System setting record not found".into()));
    }
    Ok(Json(find_record(state, &entity, &id).await?))
}

#[handler]
async fn remove(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = administrator(req, state)?;
    let entity = entity(req)?;
    let id = req.param::<String>("id").unwrap_or_default();
    if entity == "users" {
        if id == identity.sub {
            return Err(AppError::BadRequest(
                "You cannot delete your own account".into(),
            ));
        }
        let user = sqlx::query("SELECT role FROM users WHERE id=?")
            .bind(&id)
            .fetch_optional(&state.db.pool)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".into()))?;
        if user.get::<String, _>("role") == "admin" {
            let count = sqlx::query(
                "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND is_active=1",
            )
            .fetch_one(&state.db.pool)
            .await?
            .get::<i64, _>("count");
            if count <= 1 {
                return Err(AppError::BadRequest(
                    "The last active administrator cannot be deleted".into(),
                ));
            }
        }
        sqlx::query("DELETE FROM user_profiles WHERE user_id=?")
            .bind(&id)
            .execute(&state.db.pool)
            .await?;
        sqlx::query("DELETE FROM users WHERE id=?")
            .bind(&id)
            .execute(&state.db.pool)
            .await?;
    } else {
        if matches!(entity.as_str(), "roles" | "departments") {
            let record = sqlx::query(
                "SELECT record_key FROM system_admin_records WHERE entity_type=? AND id=?",
            )
            .bind(&entity)
            .bind(&id)
            .fetch_optional(&state.db.pool)
            .await?
            .ok_or_else(|| AppError::NotFound("System setting record not found".into()))?;
            let key = record.get::<String, _>("record_key");
            let references = if entity == "roles" {
                sqlx::query("SELECT COUNT(*) AS count FROM users WHERE role=?")
                    .bind(&key)
                    .fetch_one(&state.db.pool)
                    .await?
                    .get::<i64, _>("count")
            } else {
                sqlx::query("SELECT COUNT(*) AS count FROM user_profiles WHERE department_key=?")
                    .bind(&key)
                    .fetch_one(&state.db.pool)
                    .await?
                    .get::<i64, _>("count")
            };
            if references > 0 {
                return Err(AppError::Conflict(format!(
                    "This {entity} record is still assigned to {references} user(s)"
                )));
            }
        }
        let result = sqlx::query("DELETE FROM system_admin_records WHERE entity_type=? AND id=?")
            .bind(&entity)
            .bind(&id)
            .execute(&state.db.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("System setting record not found".into()));
        }
    }
    Ok(Json(json!({"deleted":true,"id":id})))
}

fn permission_codes(value: Option<&str>) -> Vec<String> {
    value
        .and_then(|value| serde_json::from_str::<Value>(value).ok())
        .and_then(|value| value.get("permissionCodes").cloned())
        .and_then(|value| serde_json::from_value::<Vec<String>>(value).ok())
        .unwrap_or_default()
}

#[handler]
async fn context(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    ensure_defaults(state).await?;
    let user = sqlx::query(&format!("{} WHERE u.id=?", user_select()))
        .bind(&identity.sub)
        .fetch_optional(&state.db.pool)
        .await?;
    let role_key = user
        .as_ref()
        .map(|row| row.get::<String, _>("role"))
        .unwrap_or_else(|| identity.role.clone());
    let role = sqlx::query("SELECT name,data FROM system_admin_records WHERE entity_type='roles' AND record_key=? AND is_active=1")
        .bind(&role_key).fetch_optional(&state.db.pool).await?;
    let department_key = user
        .as_ref()
        .and_then(|row| row.try_get::<String, _>("department_key").ok())
        .filter(|value| !value.trim().is_empty());
    let department_name = if let Some(key) = &department_key {
        sqlx::query("SELECT name FROM system_admin_records WHERE entity_type='departments' AND record_key=? AND is_active=1")
            .bind(key).fetch_optional(&state.db.pool).await?.map(|row|row.get::<String,_>("name"))
    } else {
        None
    };
    let about = sqlx::query("SELECT data FROM system_admin_records WHERE entity_type='about' AND is_active=1 ORDER BY sort_order,name LIMIT 1")
        .fetch_optional(&state.db.pool).await?;
    let about_data = about
        .and_then(|row| serde_json::from_str::<Value>(&row.get::<String, _>("data")).ok())
        .unwrap_or_else(|| json!({}));
    let default_company = about_data
        .get("companyName")
        .and_then(Value::as_str)
        .map(str::to_string);
    let profile_company = user
        .as_ref()
        .and_then(|row| row.try_get::<String, _>("company").ok())
        .filter(|value| !value.trim().is_empty());
    let menu_rows = sqlx::query("SELECT record_key,name,data,is_active,sort_order FROM system_admin_records WHERE entity_type='menus' ORDER BY sort_order,name")
        .fetch_all(&state.db.pool).await?;
    let menus = menu_rows
        .into_iter()
        .map(|row| {
            let data = serde_json::from_str::<Value>(&row.get::<String, _>("data"))
                .unwrap_or_else(|_| json!({}));
            json!({"key":row.get::<String,_>("record_key"),"name":row.get::<String,_>("name"),
            "path":data.get("path").and_then(Value::as_str).unwrap_or_default(),
            "enabled":row_bool(&row,"is_active"),"sortOrder":row.get::<i64,_>("sort_order")})
        })
        .collect::<Vec<_>>();
    let role_name = role
        .as_ref()
        .map(|row| row.get::<String, _>("name"))
        .unwrap_or_else(|| role_key.clone());
    let permissions = permission_codes(
        role.as_ref()
            .and_then(|row| row.try_get::<String, _>("data").ok())
            .as_deref(),
    );
    let username = user
        .as_ref()
        .map(|row| row.get::<String, _>("username"))
        .unwrap_or_else(|| identity.username.clone());
    let display_name = user
        .as_ref()
        .and_then(|row| row.try_get::<String, _>("display_name").ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| username.clone());
    let job_title = user
        .as_ref()
        .and_then(|row| row.try_get::<String, _>("job_title").ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "未設定職稱".into());
    let permission_label = user
        .as_ref()
        .and_then(|row| row.try_get::<String, _>("permission_summary").ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| role_name.clone());
    Ok(Json(json!({
        "currentUser":{
            "id":identity.sub,"username":username,"company":profile_company.or(default_company).unwrap_or_else(||"未設定公司".into()),
            "departmentKey":department_key,"departmentName":department_name.unwrap_or_else(||"未設定部門".into()),
            "displayName":display_name,"jobTitle":job_title,"roleKey":role_key,"roleName":role_name,
            "permissionLabel":permission_label,"permissions":permissions,"canAdmin":identity.role=="admin"
        },
        "menus":menus,"about":about_data
    })))
}

async fn seed(
    state: &AppState,
    entity: &str,
    key: &str,
    name: &str,
    data: Value,
    sort_order: i64,
) -> Result<(), AppError> {
    let exists =
        sqlx::query("SELECT id FROM system_admin_records WHERE entity_type=? AND record_key=?")
            .bind(entity)
            .bind(key)
            .fetch_optional(&state.db.pool)
            .await?
            .is_some();
    if !exists {
        let _ = sqlx::query("INSERT INTO system_admin_records (id,entity_type,record_key,name,data,is_active,sort_order,created_by,created_at,updated_at) VALUES (?,?,?,?,?,1,?,'system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
            .bind(generate_id()).bind(entity).bind(key).bind(name).bind(data.to_string()).bind(sort_order)
            .execute(&state.db.pool).await;
    }
    Ok(())
}

async fn ensure_defaults(state: &AppState) -> Result<(), AppError> {
    DEFAULTS_READY
        .get_or_try_init(|| ensure_defaults_inner(state))
        .await?;
    Ok(())
}

async fn ensure_defaults_inner(state: &AppState) -> Result<(), AppError> {
    if sqlx::query(
        "SELECT setting_key FROM system_settings WHERE setting_key='system_admin_defaults_v1'",
    )
    .fetch_optional(&state.db.pool)
    .await?
    .is_some()
    {
        return Ok(());
    }
    let departments = [
        ("ceo", "CEO 決策專區"),
        ("cfo", "CFO 財務專區"),
        ("cto", "CTO 技術專區"),
        ("sales", "SALES 業務專區"),
        ("administration", "行政管理專區"),
        ("hr", "人事專區"),
        ("procurement", "採購專區"),
        ("mis", "MIS 維運專區"),
        ("sales-projects", "業務工作專案"),
        ("it-projects", "資訊專案"),
        ("information-security", "資訊安全專區"),
    ];
    for (index, (key, name)) in departments.iter().enumerate() {
        seed(
            state,
            "departments",
            key,
            name,
            json!({"code":key}),
            index as i64 + 1,
        )
        .await?;
    }
    seed(
        state,
        "roles",
        "admin",
        "系統管理員",
        json!({"permissionCodes":["*"]}),
        1,
    )
    .await?;
    seed(
        state,
        "roles",
        "user",
        "一般使用者",
        json!({"permissionCodes":["documents.read","search.use","collaboration.use"]}),
        2,
    )
    .await?;
    for (index, (key, name)) in [
        ("*", "完整系統權限"),
        ("documents.read", "文件讀取"),
        ("search.use", "知識搜尋"),
        ("collaboration.use", "團隊協作"),
        ("settings.manage", "系統設定維護"),
    ]
    .iter()
    .enumerate()
    {
        seed(
            state,
            "permissions",
            key,
            name,
            json!({"resource":key}),
            index as i64 + 1,
        )
        .await?;
    }
    let menus = [
        ("workspace", "一般工作與儀表板", "/cortex"),
        ("departments", "部門專區", "/cortex/departments"),
        ("personal-workspace", "個人化專區", "/cortex/workspace"),
        ("projects", "專案管理", "/cortex/projects"),
        ("workflows", "工作流程管理", "/cortex/workflows"),
        ("chat", "AI 對話", "/cortex/chat"),
        ("collaboration", "團隊協作", "/cortex/collaboration"),
        ("documents", "文件管理", "/cortex/documents"),
        ("search", "智慧檢索", "/cortex/search"),
        ("knowledge", "知識中心", "/cortex/knowledge"),
        ("graph", "知識圖譜", "/cortex/graph"),
        ("org-management", "營運管理", "/cortex/orgManagement"),
        ("ai-models", "AI 模型", "/cortex/ai-models"),
        ("settings", "系統設定", "/cortex/settings"),
    ];
    for (index, (key, name, path)) in menus.iter().enumerate() {
        seed(
            state,
            "menus",
            key,
            name,
            json!({"path":path}),
            index as i64 + 1,
        )
        .await?;
    }
    seed(
        state,
        "languages",
        "zh-TW",
        "繁體中文",
        json!({"locale":"zh-TW","fallback":false}),
        1,
    )
    .await?;
    seed(
        state,
        "languages",
        "en",
        "English",
        json!({"locale":"en","fallback":true}),
        2,
    )
    .await?;
    seed(state,"about","cortex","Cortex",json!({"companyName":"未設定公司","productName":"Cortex","version":env!("CARGO_PKG_VERSION")}),1).await?;
    sqlx::query("INSERT INTO system_settings (setting_key,setting_value,updated_by,updated_at) VALUES ('system_admin_defaults_v1','complete','system',CURRENT_TIMESTAMP)")
        .execute(&state.db.pool).await?;
    Ok(())
}

pub fn router() -> Router {
    Router::new()
        .push(Router::with_path("settings/context").get(context))
        .push(
            Router::with_path("settings/admin/<entity>")
                .get(list)
                .post(create)
                .push(Router::with_path("<id>").put(update).delete(remove)),
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> AdminRecordRequest {
        AdminRecordRequest {
            key: "sample-key".into(),
            name: "Sample".into(),
            description: None,
            data: json!({"value":"ok"}),
            is_active: true,
            sort_order: 1,
        }
    }

    #[test]
    fn validates_admin_record_boundaries() {
        assert!(validate_payload(&request()).is_ok());
        let mut invalid = request();
        invalid.data = json!(["not-an-object"]);
        assert!(validate_payload(&invalid).is_err());
        invalid = request();
        invalid.name.clear();
        assert!(validate_payload(&invalid).is_err());
    }

    #[test]
    fn rejects_plaintext_secrets_and_invalid_menu_paths() {
        let mut provider = request();
        provider.data = json!({"provider":"openai","baseUrl":"https://api.example.com","credentialRef":"vault/cortex","apiKey":"plaintext"});
        assert!(validate_entity_payload("ai-providers", &provider).is_err());

        let mut menu = request();
        menu.data = json!({"path":"https://external.example.com"});
        assert!(validate_entity_payload("menus", &menu).is_err());
        menu.data = json!({"path":"/cortex/documents"});
        assert!(validate_entity_payload("menus", &menu).is_ok());
    }
}
