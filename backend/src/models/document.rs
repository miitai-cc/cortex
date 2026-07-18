use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DocumentModel {
    pub id: String,
    pub filename: String,
    pub content_type: String,
    pub file_size: i64,
    pub metadata: Option<String>,
    pub status: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DocumentChunkModel {
    pub id: String,
    pub document_id: String,
    pub content: String,
    pub chunk_index: i32,
    pub metadata: Option<String>,
}
