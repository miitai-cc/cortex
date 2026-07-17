use crate::config::AppConfig;
use crate::db::Database;
use qdrant_client::Qdrant;

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
            .build()
            .expect("Failed to connect to Qdrant");
        Self { config, db, qdrant }
    }
}
