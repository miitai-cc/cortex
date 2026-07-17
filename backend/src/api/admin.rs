use salvo::prelude::*;
use crate::core::state::AppState;
use eiva_be_security::repository::UserRepo;
use crate::errors::AppError;
use eiva_be_security::password::hash_password;
use cortex_lib::utils::generate_id;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub role: String,
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn list_users(depot: &mut Depot) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let users = UserRepo::list_all(&state.db.pool).await?;
    Ok(Json(serde_json::json!(users)))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn create_user(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let create_req: CreateUserRequest = req.parse_json().await.map_err(|_| {
        AppError::BadRequest("Invalid request body".into())
    })?;

    let id = generate_id();
    let password_hash = hash_password(&create_req.password);
    let user = UserRepo::create(
        &state.db.pool,
        &id,
        &create_req.username,
        &create_req.email,
        &password_hash,
        &create_req.role,
    ).await?;

    Ok(Json(serde_json::json!(user)))
}

pub fn router() -> Router {
    Router::with_path("admin")
        .push(Router::with_path("users").get(list_users).post(create_user))
}
