use crate::config::AppConfig;
use crate::db::Database;
use qdrant_client::Qdrant;
use sqlx::Row;

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub db: Database,
    pub qdrant: Qdrant,
}

impl AppState {
    pub async fn new() -> Self {
        let config = AppConfig::from_env();
        let db = Database::new(&config).await;
        let qdrant = Qdrant::from_url(&config.qdrant_url)
            .skip_compatibility_check()
            .build()
            .expect("Failed to connect to Qdrant");
        Self { config, db, qdrant }
    }

    pub async fn apply_persisted_settings(&mut self) -> Result<(), sqlx::Error> {
        let rows = sqlx::query("SELECT setting_key,setting_value FROM system_settings")
            .fetch_all(&self.db.pool)
            .await?;
        for row in rows {
            let key = row.get::<String, _>("setting_key");
            let value = row.get::<String, _>("setting_value");
            match key.as_str() {
                "embedding_model" => self.config.embedding_model = value,
                "reranking_model" => self.config.reranking_model = value,
                "pageindex_model" => self.config.pageindex_model = value,
                "openai_base_url" => self.config.openai_base_url = value,
                "pageindex_base_url" => self.config.pageindex_base_url = value,
                "contact_name" | "contact_email" | "contact_phone" | "common_links" => {}
                _ => tracing::warn!("Ignoring unknown persisted setting: {key}"),
            }
        }
        Ok(())
    }
}
