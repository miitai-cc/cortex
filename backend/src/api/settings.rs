use crate::core::state::AppState;
use crate::errors::AppError;
use eiva_be_security::jwt::{verify_token, Claims};
use salvo::prelude::*;
use serde::{Deserialize, Serialize};
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
    #[serde(default)]
    contact_name: Option<String>,
    #[serde(default)]
    contact_email: Option<String>,
    #[serde(default)]
    contact_phone: Option<String>,
    #[serde(default)]
    common_links: Option<Vec<CommonLinkRequest>>,
    #[serde(default)]
    imap_server: Option<String>,
    #[serde(default)]
    imap_port: Option<String>,
    #[serde(default)]
    imap_username: Option<String>,
    #[serde(default)]
    smtp_server: Option<String>,
    #[serde(default)]
    smtp_port: Option<String>,
    #[serde(default)]
    smtp_username: Option<String>,
    #[serde(default)]
    google_mail_api_enabled: Option<bool>,
    #[serde(default)]
    enterprise_systems: Option<Vec<EnterpriseSystemLinkRequest>>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommonLinkRequest {
    label: String,
    url: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EnterpriseSystemLinkRequest {
    label: String,
    url: String,
    category: String,
    area: String,
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
    for (label, value, maximum) in [
        ("Contact name", body.contact_name.as_deref(), 120_usize),
        ("Contact email", body.contact_email.as_deref(), 254_usize),
        ("Contact phone", body.contact_phone.as_deref(), 80_usize),
    ] {
        if value.is_some_and(|value| value.trim().chars().count() > maximum) {
            return Err(AppError::BadRequest(format!("Invalid {label}")));
        }
    }
    if body.contact_email.as_deref().is_some_and(|email| {
        let email = email.trim();
        !email.is_empty() && (!email.contains('@') || email.contains(char::is_whitespace))
    }) {
        return Err(AppError::BadRequest("Invalid contact email".into()));
    }
    if let Some(links) = &body.common_links {
        if links.len() > 20 {
            return Err(AppError::BadRequest(
                "Common links are limited to 20 entries".into(),
            ));
        }
        for link in links {
            if link.label.trim().is_empty()
                || link.label.trim().chars().count() > 80
                || !valid_url(link.url.trim())
            {
                return Err(AppError::BadRequest("Invalid common link".into()));
            }
        }
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
    let common_links = saved
        .get("common_links")
        .and_then(|value| serde_json::from_str::<Vec<CommonLinkRequest>>(value).ok())
        .unwrap_or_default()
        .into_iter()
        .filter(|link| !link.label.trim().is_empty() && valid_url(link.url.trim()))
        .collect::<Vec<_>>();
    let enterprise_systems = saved
        .get("enterprise_systems")
        .and_then(|value| serde_json::from_str::<Vec<EnterpriseSystemLinkRequest>>(value).ok())
        .unwrap_or_default()
        .into_iter()
        .filter(|link| !link.label.trim().is_empty() && valid_url(link.url.trim()))
        .collect::<Vec<_>>();
    serde_json::json!({
        "embeddingModel":embedding_model,"rerankingModel":reranking_model,
        "pageindexModel":pageindex_model,"openaiBaseUrl":openai_base_url,
        "pageindexBaseUrl":pageindex_base_url,"openaiApiKeyConfigured":state.config.openai_api_key.is_some(),
        "pageindexApiKeyConfigured":state.config.pageindex_api_key.is_some(),
        "restartRequired":restart_required,
        "systemVersion":env!("CARGO_PKG_VERSION"),
        "contactName":saved.get("contact_name").cloned().unwrap_or_else(|| "系統管理員".into()),
        "contactEmail":saved.get("contact_email").cloned().unwrap_or_default(),
        "contactPhone":saved.get("contact_phone").cloned().unwrap_or_default(),
        "commonLinks":common_links,
        "imapServer":saved.get("imap_server").cloned().unwrap_or_default(),
        "imapPort":saved.get("imap_port").cloned().unwrap_or_default(),
        "imapUsername":saved.get("imap_username").cloned().unwrap_or_default(),
        "smtpServer":saved.get("smtp_server").cloned().unwrap_or_default(),
        "smtpPort":saved.get("smtp_port").cloned().unwrap_or_default(),
        "smtpUsername":saved.get("smtp_username").cloned().unwrap_or_default(),
        "googleMailApiEnabled":saved.get("google_mail_api_enabled").and_then(|v| v.parse::<bool>().ok()).unwrap_or(false),
        "enterpriseSystems":enterprise_systems
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
    let mut entries = vec![
        ("embedding_model", body.embedding_model.trim().to_string()),
        ("reranking_model", body.reranking_model.trim().to_string()),
        ("pageindex_model", body.pageindex_model.trim().to_string()),
        (
            "openai_base_url",
            body.openai_base_url.trim_end_matches('/').to_string(),
        ),
        (
            "pageindex_base_url",
            body.pageindex_base_url.trim_end_matches('/').to_string(),
        ),
    ];
    for (key, value) in [
        ("contact_name", body.contact_name.as_deref()),
        ("contact_email", body.contact_email.as_deref()),
        ("contact_phone", body.contact_phone.as_deref()),
        ("imap_server", body.imap_server.as_deref()),
        ("imap_port", body.imap_port.as_deref()),
        ("imap_username", body.imap_username.as_deref()),
        ("smtp_server", body.smtp_server.as_deref()),
        ("smtp_port", body.smtp_port.as_deref()),
        ("smtp_username", body.smtp_username.as_deref()),
    ] {
        if let Some(value) = value {
            entries.push((key, value.trim().to_string()));
        }
    }
    if let Some(enabled) = body.google_mail_api_enabled {
        entries.push(("google_mail_api_enabled", enabled.to_string()));
    }
    if let Some(links) = &body.common_links {
        let normalized = links
            .iter()
            .map(|link| CommonLinkRequest {
                label: link.label.trim().to_string(),
                url: link.url.trim().to_string(),
            })
            .collect::<Vec<_>>();
        entries.push((
            "common_links",
            serde_json::to_string(&normalized)
                .map_err(|error| AppError::BadRequest(error.to_string()))?,
        ));
    }
    if let Some(systems) = &body.enterprise_systems {
        let normalized = systems
            .iter()
            .map(|sys| EnterpriseSystemLinkRequest {
                label: sys.label.trim().to_string(),
                url: sys.url.trim().to_string(),
                category: sys.category.trim().to_string(),
                area: sys.area.trim().to_string(),
            })
            .collect::<Vec<_>>();
        entries.push((
            "enterprise_systems",
            serde_json::to_string(&normalized)
                .map_err(|error| AppError::BadRequest(error.to_string()))?,
        ));
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_request() -> SystemSettingsRequest {
        SystemSettingsRequest {
            embedding_model: "embedding-model".into(),
            reranking_model: "reranking-model".into(),
            pageindex_model: "pageindex-model".into(),
            openai_base_url: "http://127.0.0.1:8080/v1".into(),
            pageindex_base_url: "https://pageindex.example.com/v1".into(),
            contact_name: Some("資訊服務台".into()),
            contact_email: Some("help@example.com".into()),
            contact_phone: Some("1234".into()),
            common_links: Some(vec![CommonLinkRequest {
                label: "內部入口".into(),
                url: "https://portal.example.com".into(),
            }]),
        }
    }

    #[test]
    fn validates_footer_settings() {
        assert!(validate(&valid_request()).is_ok());
    }

    #[test]
    fn rejects_unsafe_or_incomplete_footer_settings() {
        let mut request = valid_request();
        request.common_links = Some(vec![CommonLinkRequest {
            label: "Unsafe".into(),
            url: "javascript:alert(1)".into(),
        }]);
        assert!(validate(&request).is_err());
        request.common_links = Some(vec![]);
        request.contact_email = Some("invalid-address".into());
        assert!(validate(&request).is_err());
    }
}
