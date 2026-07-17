//! Storage error types.

use thiserror::Error;

/// Storage operation errors.
#[derive(Debug, Error)]
pub enum StoreError {
    /// Document not found.
    #[error("Document not found: {0}")]
    NotFound(String),

    /// IO operation failed.
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// Serialization/deserialization failed.
    #[error("Serialization error: {0}")]
    SerdeError(#[from] serde_json::Error),

    /// Database operation failed.
    #[error("Database error: {0}")]
    DatabaseError(String),

    /// File watcher error.
    #[error("Watcher error: {0}")]
    WatcherError(String),

    /// Invalid document ID.
    #[error("Invalid document ID: {0}")]
    InvalidId(String),

    /// Storage directory doesn't exist.
    #[error("Storage directory not found: {0}")]
    DirectoryNotFound(String),
}

/// Result type for storage operations.
pub type StoreResult<T> = Result<T, StoreError>;
