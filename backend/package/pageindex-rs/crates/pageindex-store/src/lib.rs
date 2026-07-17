//! Document Storage for PageIndex
//!
//! This crate provides storage backends for indexed documents,
//! including SQLite, JSON files, and file watching for sync.
//!
//! # Features
//!
//! - `sqlite` (default) - SQLite database for concurrent-safe storage
//! - `json-store` - Human-readable JSON file storage (single-writer/testing only)
//! - `watcher` - File system watching for automatic sync

mod cache;
mod error;
#[cfg(feature = "json-store")]
mod json_store;
#[cfg(feature = "sqlite")]
mod sqlite_store;
mod store;
#[cfg(feature = "watcher")]
mod watcher;

pub use cache::TokenCache;
pub use error::{StoreError, StoreResult};
#[cfg(feature = "json-store")]
pub use json_store::JsonStore;
#[cfg(feature = "sqlite")]
pub use sqlite_store::SqliteStore;
pub use store::{DocumentMetadata, DocumentStore, DocumentSummary, SearchResult, StaleReason};
#[cfg(feature = "watcher")]
pub use watcher::{FileWatcher, WatchEvent};

use directories::ProjectDirs;
use std::path::PathBuf;

/// Returns the default storage directory.
///
/// Uses XDG directories on Linux, Application Support on macOS.
/// Falls back to `~/.pageindex` if project directories can't be determined.
pub fn default_storage_dir() -> PathBuf {
    ProjectDirs::from("", "", "pageindex")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".pageindex")
        })
}

/// Returns the default config directory.
pub fn default_config_dir() -> PathBuf {
    ProjectDirs::from("", "", "pageindex")
        .map(|dirs| dirs.config_dir().to_path_buf())
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".config")
                .join("pageindex")
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_storage_dir() {
        let dir = default_storage_dir();
        assert!(dir.to_str().is_some());
    }
}
