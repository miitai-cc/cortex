#![allow(dead_code)]
use std::env;

#[derive(Debug, Clone, PartialEq)]
pub enum LoginType {
    Mock,
    Normal,
    Sso,
}

impl LoginType {
    pub fn as_str(&self) -> &'static str {
        match self {
            LoginType::Mock => "mock",
            LoginType::Normal => "normal",
            LoginType::Sso => "sso",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum DbType {
    Sqlite,
    Mariadb,
    Sqlserver,
    Postgresql,
}

impl DbType {
    pub fn as_str(&self) -> &'static str {
        match self {
            DbType::Sqlite => "sqlite",
            DbType::Mariadb => "mariadb",
            DbType::Sqlserver => "sqlserver",
            DbType::Postgresql => "postgresql",
        }
    }

    pub fn default_port(&self) -> u16 {
        match self {
            DbType::Sqlite => 0,
            DbType::Mariadb => 3306,
            DbType::Sqlserver => 1433,
            DbType::Postgresql => 5432,
        }
    }

    pub fn url_scheme(&self) -> &'static str {
        match self {
            DbType::Sqlite => "sqlite",
            DbType::Mariadb => "mysql",
            DbType::Sqlserver => "mssql",
            DbType::Postgresql => "postgres",
        }
    }
}

#[derive(Clone)]
pub struct AppConfig {
    pub login_type: LoginType,
    pub db_type: DbType,
    pub database_url: String,
    pub db_host: String,
    pub db_port: u16,
    pub db_name: String,
    pub db_user: String,
    pub db_password: String,
    pub qdrant_url: String,
    pub jwt_secret: String,
    pub openai_api_key: Option<String>,
    pub openai_base_url: String,
    pub anthropic_api_key: Option<String>,
    pub embedding_model: String,
    pub reranking_model: String,
    pub upload_dir: String,
    pub work_root: String,
    pub log_level: String,
    pub server_host: String,
    pub server_port: u16,
    pub keycloak_url: String,
    pub keycloak_realm: String,
    pub keycloak_client_id: String,
    pub keycloak_client_secret: String,
}

fn qdrant_grpc_url() -> String {
    if let Ok(url) = env::var("QDRANT_GRPC_URL") {
        return url;
    }

    let legacy_url = env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6334".to_string());
    normalize_legacy_qdrant_url(&legacy_url)
}

fn normalize_legacy_qdrant_url(raw_url: &str) -> String {
    let Ok(mut url) = reqwest::Url::parse(raw_url) else {
        return raw_url.to_string();
    };

    // QDRANT_URL historically pointed at the REST port. qdrant-client uses
    // tonic exclusively, so sending it to 6333 produces HTTP/1 parse errors.
    if url.port() == Some(6333) && url.set_port(Some(6334)).is_ok() {
        tracing::warn!(
            "QDRANT_URL points to REST port 6333; using gRPC endpoint {}. Set QDRANT_GRPC_URL to override.",
            url
        );
    }
    url.to_string().trim_end_matches('/').to_string()
}

impl AppConfig {
    pub fn from_env() -> Self {
        let login_type = match env::var("LOGIN_TYPE").as_deref() {
            Ok("normal") => LoginType::Normal,
            Ok("sso") => LoginType::Sso,
            _ => LoginType::Mock,
        };

        let db_type = match env::var("DB_TYPE").as_deref() {
            Ok("mariadb") => DbType::Mariadb,
            Ok("sqlserver") => DbType::Sqlserver,
            Ok("postgresql") | Ok("postgres") => DbType::Postgresql,
            _ => DbType::Sqlite,
        };

        let db_host = env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
        let db_port = env::var("DB_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or_else(|| db_type.default_port());
        let db_name = env::var("DB_NAME").unwrap_or_else(|_| "cortex".to_string());
        let db_user = env::var("DB_USER").unwrap_or_else(|_| "cortex".to_string());
        let db_password = env::var("DB_PASSWORD").unwrap_or_default();

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| match db_type {
            DbType::Sqlite => "sqlite:./data/cortex.db?mode=rwc".to_string(),
            _ => format!(
                "{}://{}:{}@{}:{}/{}",
                db_type.url_scheme(),
                db_user,
                db_password,
                db_host,
                db_port,
                db_name,
            ),
        });

        Self {
            login_type,
            db_type,
            database_url,
            db_host,
            db_port,
            db_name,
            db_user,
            db_password,
            qdrant_url: qdrant_grpc_url(),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "change-me-in-production".to_string()),
            openai_api_key: env::var("OPENAI_API_KEY").ok(),
            openai_base_url: env::var("OPENAI_BASE_URL")
                .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
            anthropic_api_key: env::var("ANTHROPIC_API_KEY").ok(),
            embedding_model: env::var("EMBEDDING_MODEL")
                .unwrap_or_else(|_| "BAAI/bge-small-zh-v1.5".to_string()),
            reranking_model: env::var("RERANKING_MODEL")
                .unwrap_or_else(|_| "BAAI/bge-reranker-v2-m3".to_string()),
            upload_dir: env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string()),
            work_root: env::var("WORK_ROOT").unwrap_or_else(|_| "./".to_string()),
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8080),
            keycloak_url: env::var("KEYCLOAK_URL")
                .unwrap_or_else(|_| "http://localhost:8080".to_string()),
            keycloak_realm: env::var("KEYCLOAK_REALM").unwrap_or_else(|_| "cortex".to_string()),
            keycloak_client_id: env::var("KEYCLOAK_CLIENT_ID")
                .unwrap_or_else(|_| "cortex-backend".to_string()),
            keycloak_client_secret: env::var("KEYCLOAK_CLIENT_SECRET").unwrap_or_default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_legacy_qdrant_url;

    #[test]
    fn converts_qdrant_rest_port_to_grpc_port() {
        assert_eq!(
            normalize_legacy_qdrant_url("http://qdrant:6333"),
            "http://qdrant:6334"
        );
    }

    #[test]
    fn preserves_explicit_qdrant_grpc_endpoint() {
        assert_eq!(
            normalize_legacy_qdrant_url("https://vectors.example.com:7443"),
            "https://vectors.example.com:7443"
        );
    }
}
