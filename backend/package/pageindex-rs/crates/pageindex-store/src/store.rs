//! Document store trait and related types.

use crate::error::StoreResult;
use async_trait::async_trait;
use pageindex_core::model::DocumentStructure;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Reason why a document is stale.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StaleReason {
    /// Source file modification time changed.
    FileModified,
    /// Source file no longer exists.
    FileDeleted,
    /// Content hash doesn't match.
    HashMismatch,
    /// Indexing configuration changed.
    ConfigChanged,
}

/// Summary information about a stored document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSummary {
    /// Unique document identifier (content hash).
    pub id: String,

    /// Document name.
    pub name: String,

    /// Original source file path.
    pub source_path: Option<PathBuf>,

    /// When the document was indexed.
    pub indexed_at: SystemTime,

    /// Number of root sections.
    pub section_count: usize,

    /// Total node count.
    pub node_count: usize,

    /// File size in bytes (if from file).
    pub file_size: Option<u64>,

    /// Whether the source file is stale.
    pub is_stale: bool,

    /// Reason for staleness (if stale).
    pub stale_reason: Option<StaleReason>,
}

/// Search result from document store.
#[derive(Debug, Clone)]
pub struct SearchResult {
    /// Document ID.
    pub document_id: String,

    /// Document name.
    pub document_name: String,

    /// Matching node ID (if searching within document).
    pub node_id: Option<String>,

    /// Matching node title.
    pub node_title: Option<String>,

    /// Snippet of matching content.
    pub snippet: Option<String>,

    /// Search score (higher is better).
    pub score: f64,
}

/// Metadata for a stored document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    /// Original file path.
    pub source_path: Option<PathBuf>,

    /// File modification time when indexed.
    pub source_mtime: Option<SystemTime>,

    /// File size when indexed.
    pub source_size: Option<u64>,

    /// SHA-256 hash of source content.
    pub content_hash: String,

    /// When the document was indexed.
    pub indexed_at: SystemTime,

    /// Configuration used for indexing (serialized).
    pub config_hash: Option<String>,
}

/// Trait for document storage backends.
#[async_trait]
pub trait DocumentStore: Send + Sync {
    /// Saves a document structure.
    ///
    /// # Arguments
    ///
    /// * `doc` - Document structure to save
    /// * `metadata` - Metadata about the document source
    ///
    /// # Returns
    ///
    /// The document ID (content hash).
    async fn save(
        &self,
        doc: &DocumentStructure,
        metadata: DocumentMetadata,
    ) -> StoreResult<String>;

    /// Retrieves a document by ID.
    async fn get(&self, id: &str) -> StoreResult<Option<DocumentStructure>>;

    /// Retrieves document metadata by ID.
    async fn get_metadata(&self, id: &str) -> StoreResult<Option<DocumentMetadata>>;

    /// Lists all stored documents.
    async fn list(&self) -> StoreResult<Vec<DocumentSummary>>;

    /// Deletes a document by ID.
    async fn delete(&self, id: &str) -> StoreResult<()>;

    /// Searches for documents matching a query.
    ///
    /// The query is matched against document names and node titles.
    async fn search(&self, query: &str) -> StoreResult<Vec<SearchResult>>;

    /// Finds a document by its source path.
    async fn find_by_source(&self, path: &Path) -> StoreResult<Option<String>>;

    /// Checks if a document is stale.
    async fn check_stale(&self, id: &str) -> StoreResult<Option<StaleReason>>;

    /// Gets all documents that are stale.
    async fn list_stale(&self) -> StoreResult<Vec<(String, StaleReason)>>;
}
