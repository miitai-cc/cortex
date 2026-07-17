use sqlx::any::{AnyPool, AnyPoolOptions};
use crate::config::{AppConfig, DbType};

pub struct Database {
    pub pool: AnyPool,
    pub db_type: DbType,
}

impl Database {
    pub async fn new(config: &AppConfig) -> Self {
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
        Self { pool, db_type: config.db_type.clone() }
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
            id_col = id_column, text = text_type, ts = timestamp_default
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
            text = text_type, blob = blob_type
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
            id_col = id_column, text = text_type, ts = timestamp_default, bool = boolean_type
        );

        sqlx::query(&create_documents).execute(&self.pool).await?;
        sqlx::query(&create_chunks).execute(&self.pool).await?;
        sqlx::query(&create_users).execute(&self.pool).await?;

        Ok(())
    }
}
