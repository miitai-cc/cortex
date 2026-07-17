use salvo::prelude::*;
use salvo::http::StatusCode;
use crate::core::state::AppState;
use crate::security::jwt::create_token;
use crate::security::password::{hash_password, verify_password};
use cortex_lib::utils::generate_id;
use eiva_be_sso::{KeycloakClient, SsoConfig, SsoProvider, SsoCallbackRequest};

#[derive(Deserialize, Debug)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize, Debug)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[handler]
pub async fn login(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let login_req: LoginRequest = req.parse_json().await.map_err(|_| {
        StatusError::bad_request().with_detail("Invalid request body")
    })?;

    let row = sqlx::query_as::<_, (String, String, String, String, String)>(
        "SELECT id, username, email, password_hash, role FROM users WHERE username = ?"
    )
    .bind(&login_req.username)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    match row {
        Some((id, username, email, password_hash, role)) => {
            if !verify_password(&login_req.password, &password_hash) {
                return Err(StatusError::unauthorized().with_detail("Invalid credentials"));
            }
            let token = create_token(&id, &username, &role, &state.config.jwt_secret);
            Ok(Json(serde_json::json!({
                "token": token,
                "user": { "id": id, "username": username, "email": email, "role": role }
            })))
        }
        None => Err(StatusError::unauthorized().with_detail("Invalid credentials")),
    }
}

#[handler]
pub async fn register(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let reg_req: RegisterRequest = req.parse_json().await.map_err(|_| {
        StatusError::bad_request().with_detail("Invalid request body")
    })?;

    let id = generate_id();
    let password_hash = hash_password(&reg_req.password);

    sqlx::query("INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, 'user')")
        .bind(&id)
        .bind(&reg_req.username)
        .bind(&reg_req.email)
        .bind(&password_hash)
        .execute(&state.db.pool)
        .await
        .map_err(|_| StatusError::conflict().with_detail("Username or email already exists"))?;

    let token = create_token(&id, &reg_req.username, "user", &state.config.jwt_secret);
    Ok(Json(serde_json::json!({
        "token": token,
        "user": { "id": id, "username": reg_req.username, "email": reg_req.email, "role": "user" }
    })))
}

#[handler]
pub async fn sso_callback(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let callback: SsoCallbackRequest = req.parse_json().await.map_err(|_| {
        StatusError::bad_request().with_detail("Invalid request body")
    })?;

    let sso_config = SsoConfig {
        enabled: true,
        provider: SsoProvider::Keycloak,
        url: state.config.keycloak_url.clone(),
        realm: Some(state.config.keycloak_realm.clone()),
        client_id: state.config.keycloak_client_id.clone(),
        client_secret: state.config.keycloak_client_secret.clone(),
        redirect_uri: callback.redirect_uri.clone(),
        scope: "openid profile email".to_string(),
    };

    let client = KeycloakClient::new(sso_config);
    let auth_result = client.authenticate(&callback.code, &callback.redirect_uri).await
        .map_err(|e| StatusError::internal_server_error().with_detail(e.to_string()))?;

    let user_id = &auth_result.user.sub;
    let username = auth_result.user.preferred_username.as_deref().unwrap_or("sso_user");
    let email = auth_result.user.email.as_deref().unwrap_or("");
    let role = if auth_result.user.roles.contains(&"admin".to_string()) { "admin" } else { "user" };

    // Upsert user in local DB
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, '', ?)
         ON CONFLICT(id) DO UPDATE SET username=?, email=?, role=?"
    )
    .bind(user_id)
    .bind(username)
    .bind(email)
    .bind(role)
    .bind(username)
    .bind(email)
    .bind(role)
    .execute(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    let token = create_token(user_id, username, role, &state.config.jwt_secret);
    Ok(Json(serde_json::json!({
        "token": token,
        "user": { "id": user_id, "username": username, "email": email, "role": role }
    })))
}

#[handler]
pub async fn profile(depot: &mut Depot) -> Result<Json<serde_json::Value>, StatusError> {
    let user_id = depot.obtain::<String>().map_err(|_| StatusError::unauthorized())?;
    let state = depot.obtain::<AppState>().unwrap();

    let row = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, username, email, role FROM users WHERE id = ?"
    )
    .bind(&*user_id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    match row {
        Some((id, username, email, role)) => Ok(Json(serde_json::json!({
            "id": id, "username": username, "email": email, "role": role
        }))),
        None => Err(StatusError::not_found().with_detail("User not found")),
    }
}

pub fn router() -> Router {
    Router::with_path("auth")
        .push(Router::with_path("login").post(login))
        .push(Router::with_path("register").post(register))
        .push(Router::with_path("sso/callback").post(sso_callback))
        .push(Router::with_path("profile").get(profile))
}
