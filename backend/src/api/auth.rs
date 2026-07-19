use crate::config::LoginType;
use crate::core::state::AppState;
use crate::errors::AppError;
use cortex_lib::utils::generate_id;
use eiva_be_security::jwt::create_token;
use eiva_be_security::password::{hash_password, verify_password};
use eiva_be_security::repository::UserRepo;
use eiva_be_sso::{KeycloakClient, SsoCallbackRequest, SsoConfig, SsoProvider};
use salvo::prelude::*;
use serde::Deserialize;

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
#[tracing::instrument(level = "debug", skip_all)]
pub async fn login(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let login_req: LoginRequest = req
        .parse_json()
        .await
        .map_err(|_| AppError::BadRequest("Invalid request body".into()))?;

    match state.config.login_type {
        LoginType::Mock => mock_login(&state, &login_req).await,
        LoginType::Normal | LoginType::Sso => db_login(&state, &login_req).await,
    }
}

async fn mock_login(
    state: &AppState,
    req: &LoginRequest,
) -> Result<Json<serde_json::Value>, AppError> {
    let username = req.username.trim();
    if username.is_empty() || username.chars().count() > 128 {
        return Err(AppError::BadRequest("Invalid username".into()));
    }
    let user = match UserRepo::find_by_username(&state.db.pool, username).await? {
        Some(user) => user,
        None => {
            let password = if req.password.is_empty() {
                format!("mock-{}", generate_id())
            } else {
                req.password.clone()
            };
            UserRepo::create(
                &state.db.pool,
                &generate_id(),
                username,
                &format!("{username}@cortex.local"),
                &hash_password(&password),
                "admin",
            )
            .await?
        }
    };
    let token = create_token(
        &user.id,
        &user.username,
        &user.role,
        &state.config.jwt_secret,
    );
    Ok(Json(serde_json::json!({
        "token": token,
        "user": user
    })))
}

async fn db_login(
    state: &AppState,
    req: &LoginRequest,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = UserRepo::find_with_password(&state.db.pool, &req.username).await?;

    match result {
        Some((user, password_hash)) => {
            if !verify_password(&req.password, &password_hash) {
                return Err(AppError::Unauthorized("Invalid credentials".into()));
            }
            let token = create_token(
                &user.id,
                &user.username,
                &user.role,
                &state.config.jwt_secret,
            );
            Ok(Json(serde_json::json!({
                "token": token,
                "user": user
            })))
        }
        None => Err(AppError::Unauthorized("Invalid credentials".into())),
    }
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn register(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let reg_req: RegisterRequest = req
        .parse_json()
        .await
        .map_err(|_| AppError::BadRequest("Invalid request body".into()))?;

    let id = generate_id();
    let password_hash = hash_password(&reg_req.password);
    let user = UserRepo::create(
        &state.db.pool,
        &id,
        &reg_req.username,
        &reg_req.email,
        &password_hash,
        "user",
    )
    .await?;

    let token = create_token(
        &user.id,
        &user.username,
        &user.role,
        &state.config.jwt_secret,
    );
    Ok(Json(serde_json::json!({
        "token": token,
        "user": user
    })))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn sso_callback(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();

    if state.config.login_type != LoginType::Sso {
        return Err(AppError::Unauthorized("SSO login is not enabled".into()));
    }

    let callback: SsoCallbackRequest = req
        .parse_json()
        .await
        .map_err(|_| AppError::BadRequest("Invalid request body".into()))?;

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
    let auth_result = client
        .authenticate(&callback.code, &callback.redirect_uri)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let user_id = &auth_result.user.sub;
    let username = auth_result
        .user
        .preferred_username
        .as_deref()
        .unwrap_or("sso_user");
    let email = auth_result.user.email.as_deref().unwrap_or("");
    let role = if auth_result.user.roles.contains(&"admin".to_string()) {
        "admin"
    } else {
        "user"
    };

    let user = UserRepo::upsert_sso(&state.db.pool, user_id, username, email, role).await?;
    let token = create_token(
        &user.id,
        &user.username,
        &user.role,
        &state.config.jwt_secret,
    );

    Ok(Json(serde_json::json!({
        "token": token,
        "user": user
    })))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn profile(depot: &mut Depot) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = depot
        .obtain::<String>()
        .map_err(|_| AppError::Unauthorized("Not authenticated".into()))?;
    let state = depot.obtain::<AppState>().unwrap();
    let user = UserRepo::find_by_id(&state.db.pool, &user_id).await?;
    Ok(Json(serde_json::json!(user)))
}

pub fn router() -> Router {
    Router::with_path("auth")
        .push(Router::with_path("login").post(login))
        .push(Router::with_path("register").post(register))
        .push(Router::with_path("sso/callback").post(sso_callback))
        .push(Router::with_path("profile").get(profile))
}
