use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentModel {
    pub id: String,
    pub filename: String,
    pub content_type: String,
    pub file_size: i64,
    pub metadata: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentChunkModel {
    pub id: String,
    pub document_id: String,
    pub content: String,
    pub chunk_index: i32,
    pub metadata: Option<String>,
}
