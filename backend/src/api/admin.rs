use salvo::prelude::*;
use crate::core::state::AppState;

#[derive(Deserialize, Debug)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub role: String,
}

#[handler]
pub async fn list_users(depot: &mut Depot) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let rows = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, username, email, role FROM users"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    let users: Vec<serde_json::Value> = rows.into_iter()
        .map(|(id, username, email, role)| {
            serde_json::json!({ "id": id, "username": username, "email": email, "role": role })
        })
        .collect();

    Ok(Json(serde_json::json!(users)))
}

#[handler]
pub async fn create_user(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let create_req: CreateUserRequest = req.parse_json().await.map_err(|_| {
        StatusError::bad_request()
    })?;

    let id = cortex_lib::utils::generate_id();
    let password_hash = crate::security::password::hash_password(&create_req.password);

    sqlx::query("INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&create_req.username)
        .bind(&create_req.email)
        .bind(&password_hash)
        .bind(&create_req.role)
        .execute(&state.db.pool)
        .await
        .map_err(|_| StatusError::conflict())?;

    Ok(Json(serde_json::json!({ "id": id, "username": create_req.username, "email": create_req.email, "role": create_req.role })))
}

pub fn router() -> Router {
    Router::with_path("admin")
        .push(Router::with_path("users").get(list_users).post(create_user))
}
