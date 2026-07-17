//! Error types for PageIndex operations.
//!
//! This module defines all error types used throughout the library,
//! using `thiserror` for ergonomic error handling.

use thiserror::Error;

/// The main error type for PageIndex operations.
#[derive(Debug, Error)]
pub enum PageIndexError {
    /// PDF parsing or reading failed.
    #[error("PDF error: {0}")]
    PdfError(String),

    /// Configuration is invalid or missing.
    #[error("Configuration error: {0}")]
    ConfigError(String),

    /// LLM API call failed.
    #[error("LLM error: {0}")]
    LlmError(String),

    /// Failed to parse JSON from LLM response.
    #[error("JSON parsing error: {0}")]
    JsonParseError(String),

    /// TOC extraction failed.
    #[error("TOC extraction failed: {0}")]
    TocExtractionError(String),

    /// TOC verification failed.
    #[error("TOC verification failed after {0} attempts")]
    TocVerificationFailed(usize),

    /// Document validation failed.
    #[error("Document validation error: {0}")]
    ValidationError(String),

    /// IO operation failed.
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// Token counting failed.
    #[error("Token counting error: {0}")]
    TokenError(String),

    /// Markdown parsing failed.
    #[error("Markdown parsing error: {0}")]
    MarkdownError(String),

    /// Storage operation failed.
    #[error("Storage error: {0}")]
    StorageError(String),

    /// Operation was cancelled.
    #[error("Operation cancelled")]
    Cancelled,

    /// Generic internal error.
    #[error("Internal error: {0}")]
    Internal(String),
}

impl PageIndexError {
    /// Creates a PDF error.
    pub fn pdf(msg: impl Into<String>) -> Self {
        Self::PdfError(msg.into())
    }

    /// Creates an LLM error.
    pub fn llm(msg: impl Into<String>) -> Self {
        Self::LlmError(msg.into())
    }

    /// Creates a JSON parse error.
    pub fn json_parse(msg: impl Into<String>) -> Self {
        Self::JsonParseError(msg.into())
    }

    /// Creates a TOC extraction error.
    pub fn toc_extraction(msg: impl Into<String>) -> Self {
        Self::TocExtractionError(msg.into())
    }

    /// Creates a validation error.
    pub fn validation(msg: impl Into<String>) -> Self {
        Self::ValidationError(msg.into())
    }

    /// Creates a storage error.
    pub fn storage(msg: impl Into<String>) -> Self {
        Self::StorageError(msg.into())
    }

    /// Creates an internal error.
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    /// Returns true if this is a retryable error.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::LlmError(_) | Self::JsonParseError(_) | Self::IoError(_)
        )
    }

    /// Returns true if this is a configuration error.
    pub fn is_config_error(&self) -> bool {
        matches!(self, Self::ConfigError(_))
    }
}

impl From<serde_json::Error> for PageIndexError {
    fn from(err: serde_json::Error) -> Self {
        Self::JsonParseError(err.to_string())
    }
}

impl From<serde_yaml::Error> for PageIndexError {
    fn from(err: serde_yaml::Error) -> Self {
        Self::ConfigError(err.to_string())
    }
}

#[cfg(feature = "mupdf")]
impl From<mupdf::Error> for PageIndexError {
    fn from(err: mupdf::Error) -> Self {
        Self::PdfError(err.to_string())
    }
}

/// Result type alias for PageIndex operations.
pub type Result<T> = std::result::Result<T, PageIndexError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = PageIndexError::pdf("Failed to open file");
        assert_eq!(err.to_string(), "PDF error: Failed to open file");
    }

    #[test]
    fn test_error_retryable() {
        assert!(PageIndexError::llm("timeout").is_retryable());
        assert!(PageIndexError::json_parse("invalid").is_retryable());
        assert!(!PageIndexError::ConfigError("bad".into()).is_retryable());
    }

    #[test]
    fn test_error_from_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "not found");
        let err: PageIndexError = io_err.into();
        assert!(matches!(err, PageIndexError::IoError(_)));
    }
}
