use crate::config::{AppConfig, DbType};
use sqlx::any::AnyPoolOptions;
use sqlx::{Any, Pool};

pub mod repository;

#[derive(Clone)]
pub struct Database {
    pub pool: Pool<Any>,
    pub db_type: DbType,
}

impl Database {
    pub async fn new(config: &AppConfig) -> Self {
        sqlx::any::install_default_drivers();
        Self::ensure_data_dir(config).await;
        if !AnyPoolOptions::new()
            .connect(&config.database_url)
            .await
            .is_ok()
        {
            AnyPoolOptions::new()
                .connect(&config.database_url)
                .await
                .expect("Failed to connect to database");
        }
        let pool = AnyPoolOptions::new()
            .max_connections(10)
            .connect(&config.database_url)
            .await
            .expect("Failed to create database pool");
        Self {
            pool,
            db_type: config.db_type.clone(),
        }
    }

    async fn ensure_data_dir(config: &AppConfig) {
        if config.db_type != DbType::Sqlite {
            return;
        }
        let path_str = config
            .database_url
            .strip_prefix("sqlite:")
            .unwrap_or(&config.database_url)
            .split('?')
            .next()
            .unwrap_or(&config.database_url);
        if let Some(parent) = std::path::Path::new(path_str).parent() {
            if !parent.exists() {
                let _ = tokio::fs::create_dir_all(parent).await;
                tracing::info!("Created data directory: {:?}", parent);
            }
        }
    }

    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        let text_type = match self.db_type {
            DbType::Postgresql => "TEXT",
            _ => "TEXT",
        };
        let timestamp_default = match self.db_type {
            DbType::Sqlite => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            DbType::Postgresql => "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
            _ => "DATETIME DEFAULT CURRENT_TIMESTAMP",
        };
        let blob_type = match self.db_type {
            DbType::Sqlite | DbType::Postgresql => "BYTEA",
            _ => "BLOB",
        };
        let boolean_type = match self.db_type {
            DbType::Sqlite => "INTEGER",
            _ => "BOOLEAN",
        };

        let id_column = match self.db_type {
            DbType::Postgresql => "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
            _ => "id TEXT PRIMARY KEY",
        };

        let create_documents = format!(
            "CREATE TABLE IF NOT EXISTS documents (
                {id_col},
                filename {text} NOT NULL,
                content_type {text} NOT NULL,
                file_size BIGINT NOT NULL,
                metadata {text},
                status {text} NOT NULL DEFAULT 'pending',
                created_at {ts},
                updated_at {ts}
            )",
            id_col = id_column,
            text = text_type,
            ts = timestamp_default
        );

        let create_chunks = format!(
            "CREATE TABLE IF NOT EXISTS document_chunks (
                id TEXT PRIMARY KEY,
                document_id {text} NOT NULL,
                content {text} NOT NULL,
                embedding {blob},
                metadata {text},
                chunk_index INTEGER NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id)
            )",
            text = text_type,
            blob = blob_type
        );

        let create_users = format!(
            "CREATE TABLE IF NOT EXISTS users (
                id {id_col},
                username {text} UNIQUE NOT NULL,
                email {text} UNIQUE NOT NULL,
                password_hash {text} NOT NULL,
                role {text} NOT NULL DEFAULT 'user',
                is_active {bool} NOT NULL DEFAULT 1,
                created_at {ts}
            )",
            id_col = id_column,
            text = text_type,
            ts = timestamp_default,
            bool = boolean_type
        );

        let create_conversations = format!(
            "CREATE TABLE IF NOT EXISTS conversations (
                id {text} PRIMARY KEY,
                title {text} NOT NULL,
                created_at {ts},
                updated_at {ts}
            )",
            text = text_type,
            ts = timestamp_default
        );

        let create_researches = format!(
            "CREATE TABLE IF NOT EXISTS researches (
                id {text} PRIMARY KEY,
                topic {text} NOT NULL,
                synthesis {text},
                created_at {ts}
            )",
            text = text_type,
            ts = timestamp_default
        );

        let create_content_items = format!(
            "CREATE TABLE IF NOT EXISTS content_items (
                id {text} PRIMARY KEY,
                title {text} NOT NULL,
                content_kind {text} NOT NULL,
                relative_directory {text} NOT NULL DEFAULT '/',
                source_url {text},
                current_version INTEGER NOT NULL DEFAULT 1,
                created_at {ts},
                updated_at {ts}
            )",
            text = text_type,
            ts = timestamp_default
        );

        let create_content_versions = format!(
            "CREATE TABLE IF NOT EXISTS content_versions (
                id {text} PRIMARY KEY,
                content_id {text} NOT NULL,
                version_number INTEGER NOT NULL,
                document_id {text} NOT NULL,
                source_kind {text} NOT NULL,
                source_url {text},
                markdown_content {text},
                change_note {text},
                rag_enabled {bool} NOT NULL DEFAULT 1,
                pageindex_enabled {bool} NOT NULL DEFAULT 1,
                created_at {ts},
                UNIQUE(content_id, version_number),
                FOREIGN KEY (content_id) REFERENCES content_items(id),
                FOREIGN KEY (document_id) REFERENCES documents(id)
            )",
            text = text_type,
            bool = boolean_type,
            ts = timestamp_default
        );
        let create_knowledge_records = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_records (
                id {text} PRIMARY KEY, document_id {text}, content_id {text}, title {text} NOT NULL,
                category {text} NOT NULL DEFAULT '未分類', record_type {text} NOT NULL DEFAULT 'document',
                workflow_status {text} NOT NULL DEFAULT 'draft', tags {text}, owner_id {text}, reviewer_id {text},
                created_at {ts}, updated_at {ts}
            )", text = text_type, ts = timestamp_default
        );
        let create_knowledge_interactions = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_interactions (
                id {text} PRIMARY KEY, user_id {text} NOT NULL, target_id {text} NOT NULL,
                interaction_type {text} NOT NULL, score INTEGER, comment {text}, created_at {ts},
                UNIQUE(user_id, target_id, interaction_type)
            )",
            text = text_type,
            ts = timestamp_default
        );
        let create_expert_profiles = format!(
            "CREATE TABLE IF NOT EXISTS expert_profiles (
                user_id {text} PRIMARY KEY, display_name {text} NOT NULL, expertise {text} NOT NULL,
                bio {text}, contact {text}, contribution_points INTEGER NOT NULL DEFAULT 0, updated_at {ts}
            )", text = text_type, ts = timestamp_default
        );
        let create_point_events = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_point_events (
                id {text} PRIMARY KEY, user_id {text} NOT NULL, points INTEGER NOT NULL,
                reason {text} NOT NULL, target_id {text}, created_at {ts}
            )",
            text = text_type,
            ts = timestamp_default
        );
        let create_knowledge_categories = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_categories (
                id {text} PRIMARY KEY, name {text} NOT NULL UNIQUE, description {text}, color {text},
                created_by {text}, created_at {ts}, updated_at {ts}
            )", text = text_type, ts = timestamp_default
        );
        let create_knowledge_details = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_details (
                record_id {text} PRIMARY KEY, question {text}, answer {text}, project_summary {text},
                deliverables {text}, FOREIGN KEY (record_id) REFERENCES knowledge_records(id)
            )", text = text_type
        );
        let create_knowledge_comments = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_comments (
                id {text} PRIMARY KEY, record_id {text} NOT NULL, user_id {text} NOT NULL,
                username {text} NOT NULL, content {text} NOT NULL, parent_id {text}, is_best INTEGER NOT NULL DEFAULT 0,
                created_at {ts}, updated_at {ts}, FOREIGN KEY (record_id) REFERENCES knowledge_records(id)
            )", text = text_type, ts = timestamp_default
        );

        sqlx::query(&create_documents).execute(&self.pool).await?;
        sqlx::query(&create_chunks).execute(&self.pool).await?;
        sqlx::query(&create_users).execute(&self.pool).await?;
        sqlx::query(&create_conversations)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_researches).execute(&self.pool).await?;
        sqlx::query(&create_content_items)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_content_versions)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_records)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_interactions)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_expert_profiles)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_point_events)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_categories)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_details)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_comments)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}
