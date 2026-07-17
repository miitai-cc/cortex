//! File system watcher for automatic document sync.

use crate::error::{StoreError, StoreResult};
use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebouncedEvent};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use std::time::Duration;

/// Event from the file watcher.
#[derive(Debug, Clone)]
pub enum WatchEvent {
    /// A file was created.
    Created(PathBuf),
    /// A file was modified.
    Modified(PathBuf),
    /// A file was deleted.
    Deleted(PathBuf),
    /// A file was renamed (old path, new path).
    Renamed(PathBuf, PathBuf),
    /// Watcher error.
    Error(String),
}

/// File system watcher for PDF/Markdown files.
pub struct FileWatcher {
    _watcher: notify_debouncer_mini::Debouncer<RecommendedWatcher>,
    receiver: Receiver<Result<Vec<DebouncedEvent>, notify::Error>>,
    watched_paths: Vec<PathBuf>,
}

impl FileWatcher {
    /// Creates a new file watcher.
    ///
    /// # Arguments
    ///
    /// * `debounce_ms` - Debounce duration in milliseconds
    pub fn new(debounce_ms: u64) -> StoreResult<Self> {
        let (tx, rx) = channel();

        let debouncer = new_debouncer(Duration::from_millis(debounce_ms), tx)
            .map_err(|e| StoreError::WatcherError(e.to_string()))?;

        Ok(Self {
            _watcher: debouncer,
            receiver: rx,
            watched_paths: Vec::new(),
        })
    }

    /// Creates a watcher with default debounce of 500ms.
    pub fn with_defaults() -> StoreResult<Self> {
        Self::new(500)
    }

    /// Adds a directory to watch.
    ///
    /// Watches recursively for PDF and Markdown files.
    pub fn watch(&mut self, path: impl AsRef<Path>) -> StoreResult<()> {
        let path = path.as_ref().to_path_buf();

        self._watcher
            .watcher()
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| StoreError::WatcherError(e.to_string()))?;

        self.watched_paths.push(path);
        Ok(())
    }

    /// Stops watching a directory.
    pub fn unwatch(&mut self, path: impl AsRef<Path>) -> StoreResult<()> {
        let path = path.as_ref();

        self._watcher
            .watcher()
            .unwatch(path)
            .map_err(|e| StoreError::WatcherError(e.to_string()))?;

        self.watched_paths.retain(|p| p != path);
        Ok(())
    }

    /// Returns the list of watched paths.
    pub fn watched_paths(&self) -> &[PathBuf] {
        &self.watched_paths
    }

    /// Polls for watch events (non-blocking).
    pub fn poll(&self) -> Vec<WatchEvent> {
        let mut events = Vec::new();

        while let Ok(result) = self.receiver.try_recv() {
            match result {
                Ok(debounced_events) => {
                    for event in debounced_events {
                        if let Some(watch_event) = self.convert_event(&event) {
                            events.push(watch_event);
                        }
                    }
                }
                Err(e) => {
                    events.push(WatchEvent::Error(e.to_string()));
                }
            }
        }

        events
    }

    /// Waits for the next batch of events (blocking).
    pub fn wait(&self) -> Vec<WatchEvent> {
        match self.receiver.recv() {
            Ok(Ok(debounced_events)) => debounced_events
                .iter()
                .filter_map(|e| self.convert_event(e))
                .collect(),
            Ok(Err(e)) => vec![WatchEvent::Error(e.to_string())],
            Err(e) => vec![WatchEvent::Error(e.to_string())],
        }
    }

    fn convert_event(&self, event: &DebouncedEvent) -> Option<WatchEvent> {
        let path = &event.path;

        // Only watch PDF and Markdown files
        if !is_supported_file(path) {
            return None;
        }

        // DebouncedEvent only has path, we need to determine the kind
        // by checking if the file exists
        if path.exists() {
            Some(WatchEvent::Modified(path.clone()))
        } else {
            Some(WatchEvent::Deleted(path.clone()))
        }
    }
}

/// Checks if a file is a supported document type.
fn is_supported_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lower = ext.to_lowercase();
            lower == "pdf" || lower == "md" || lower == "markdown"
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_supported_file() {
        assert!(is_supported_file(Path::new("doc.pdf")));
        assert!(is_supported_file(Path::new("doc.PDF")));
        assert!(is_supported_file(Path::new("readme.md")));
        assert!(is_supported_file(Path::new("readme.markdown")));
        assert!(!is_supported_file(Path::new("image.png")));
        assert!(!is_supported_file(Path::new("data.json")));
    }
}
