use crate::core::state::AppState;
use crate::errors::AppError;
use eiva_be_security::jwt::{verify_token, Claims};
use salvo::prelude::*;
use serde::Deserialize;
use sqlx::Row;
use std::collections::HashMap;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SystemSettingsRequest {
    embedding_model: String,
    reranking_model: String,
    pageindex_model: String,
    openai_base_url: String,
    pageindex_base_url: String,
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

fn valid_url(value: &str) -> bool {
    reqwest::Url::parse(value)
        .ok()
        .is_some_and(|url| matches!(url.scheme(), "http" | "https"))
}

fn validate(body: &SystemSettingsRequest) -> Result<(), AppError> {
    for (label, value) in [
        ("Embedding model", body.embedding_model.as_str()),
        ("Reranking model", body.reranking_model.as_str()),
        ("PageIndex model", body.pageindex_model.as_str()),
    ] {
        if value.trim().is_empty() || value.len() > 200 {
            return Err(AppError::BadRequest(format!("Invalid {label}")));
        }
    }
    if !valid_url(&body.openai_base_url) || !valid_url(&body.pageindex_base_url) {
        return Err(AppError::BadRequest(
            "Model API base URLs must use http or https".into(),
        ));
    }
    Ok(())
}

async fn saved_settings(state: &AppState) -> Result<HashMap<String, String>, AppError> {
    Ok(
        sqlx::query("SELECT setting_key,setting_value FROM system_settings")
            .fetch_all(&state.db.pool)
            .await?
            .into_iter()
            .map(|row| {
                (
                    row.get::<String, _>("setting_key"),
                    row.get::<String, _>("setting_value"),
                )
            })
            .collect(),
    )
}

fn response(state: &AppState, saved: &HashMap<String, String>) -> serde_json::Value {
    let embedding_model = saved
        .get("embedding_model")
        .cloned()
        .unwrap_or_else(|| state.config.embedding_model.clone());
    let reranking_model = saved
        .get("reranking_model")
        .cloned()
        .unwrap_or_else(|| state.config.reranking_model.clone());
    let pageindex_model = saved
        .get("pageindex_model")
        .cloned()
        .unwrap_or_else(|| state.config.pageindex_model.clone());
    let openai_base_url = saved
        .get("openai_base_url")
        .cloned()
        .unwrap_or_else(|| state.config.openai_base_url.clone());
    let pageindex_base_url = saved
        .get("pageindex_base_url")
        .cloned()
        .unwrap_or_else(|| state.config.pageindex_base_url.clone());
    let restart_required = embedding_model != state.config.embedding_model
        || reranking_model != state.config.reranking_model
        || pageindex_model != state.config.pageindex_model
        || openai_base_url != state.config.openai_base_url
        || pageindex_base_url != state.config.pageindex_base_url;
    serde_json::json!({
        "embeddingModel":embedding_model,"rerankingModel":reranking_model,
        "pageindexModel":pageindex_model,"openaiBaseUrl":openai_base_url,
        "pageindexBaseUrl":pageindex_base_url,"openaiApiKeyConfigured":state.config.openai_api_key.is_some(),
        "pageindexApiKeyConfigured":state.config.pageindex_api_key.is_some(),
        "restartRequired":restart_required
    })
}

#[handler]
async fn get_settings(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    authentication(req, state)?;
    let saved = saved_settings(state).await?;
    Ok(Json(response(state, &saved)))
}

#[handler]
async fn update_settings(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    if identity.role != "admin" {
        return Err(AppError::Unauthorized(
            "Administrator role is required".into(),
        ));
    }
    let body = req
        .parse_json::<SystemSettingsRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    validate(&body)?;
    let entries = [
        ("embedding_model", body.embedding_model.trim()),
        ("reranking_model", body.reranking_model.trim()),
        ("pageindex_model", body.pageindex_model.trim()),
        (
            "openai_base_url",
            body.openai_base_url.trim_end_matches('/'),
        ),
        (
            "pageindex_base_url",
            body.pageindex_base_url.trim_end_matches('/'),
        ),
    ];
    for (key, value) in entries {
        let exists = sqlx::query("SELECT setting_key FROM system_settings WHERE setting_key=?")
            .bind(key)
            .fetch_optional(&state.db.pool)
            .await?
            .is_some();
        if exists {
            sqlx::query("UPDATE system_settings SET setting_value=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE setting_key=?")
                .bind(value).bind(&identity.sub).bind(key).execute(&state.db.pool).await?;
        } else {
            sqlx::query("INSERT INTO system_settings (setting_key,setting_value,updated_by,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)")
                .bind(key).bind(value).bind(&identity.sub).execute(&state.db.pool).await?;
        }
    }
    let saved = saved_settings(state).await?;
    Ok(Json(response(state, &saved)))
}

pub fn router() -> Router {
    Router::with_path("settings/system")
        .get(get_settings)
        .put(update_settings)
}
