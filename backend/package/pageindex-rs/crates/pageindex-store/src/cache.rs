//! Token count caching to avoid re-parsing PDFs.

use crate::error::StoreResult;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Cached token counts for document pages.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct TokenCache {
    /// Map of content hash to page token counts.
    entries: HashMap<String, CacheEntry>,

    /// Path to cache file (if persisted).
    #[serde(skip)]
    cache_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheEntry {
    /// Token counts per page.
    page_tokens: Vec<usize>,
    /// Model used for counting.
    model: String,
}

impl TokenCache {
    /// Creates a new in-memory cache.
    pub fn new() -> Self {
        Self::default()
    }

    /// Creates a cache backed by a file.
    pub fn with_file<P: AsRef<Path>>(path: P) -> StoreResult<Self> {
        let path = path.as_ref().to_path_buf();

        let mut cache = if path.exists() {
            let content = fs::read_to_string(&path)?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Self::default()
        };

        cache.cache_path = Some(path);
        Ok(cache)
    }

    /// Computes a hash for cache key.
    pub fn compute_hash(content: &[u8]) -> String {
        let hash = Sha256::digest(content);
        format!("{:x}", hash)[..16].to_string()
    }

    /// Gets cached token counts for a document.
    pub fn get(&self, content_hash: &str, model: &str) -> Option<&[usize]> {
        self.entries
            .get(content_hash)
            .filter(|e| e.model == model)
            .map(|e| e.page_tokens.as_slice())
    }

    /// Stores token counts for a document.
    pub fn set(&mut self, content_hash: String, model: String, page_tokens: Vec<usize>) {
        self.entries
            .insert(content_hash, CacheEntry { page_tokens, model });
    }

    /// Removes a cached entry.
    pub fn remove(&mut self, content_hash: &str) {
        self.entries.remove(content_hash);
    }

    /// Clears all cache entries.
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// Returns the number of cached entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Returns true if cache is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Persists cache to file (if configured).
    pub fn save(&self) -> StoreResult<()> {
        if let Some(ref path) = self.cache_path {
            let content = serde_json::to_string_pretty(&self)?;
            fs::write(path, content)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_cache_get_set() {
        let mut cache = TokenCache::new();

        let hash = TokenCache::compute_hash(b"test content");
        cache.set(hash.clone(), "gpt-4o".to_string(), vec![100, 200, 300]);

        let tokens = cache.get(&hash, "gpt-4o").unwrap();
        assert_eq!(tokens, &[100, 200, 300]);

        // Different model returns None
        assert!(cache.get(&hash, "gpt-3.5").is_none());
    }

    #[test]
    fn test_cache_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let cache_path = temp_dir.path().join("cache.json");

        // Create and populate cache
        {
            let mut cache = TokenCache::with_file(&cache_path).unwrap();
            cache.set("hash1".to_string(), "gpt-4o".to_string(), vec![100, 200]);
            cache.save().unwrap();
        }

        // Load cache
        {
            let cache = TokenCache::with_file(&cache_path).unwrap();
            assert_eq!(cache.len(), 1);
            assert!(cache.get("hash1", "gpt-4o").is_some());
        }
    }

    #[test]
    fn test_compute_hash() {
        let hash1 = TokenCache::compute_hash(b"content A");
        let hash2 = TokenCache::compute_hash(b"content B");
        let hash3 = TokenCache::compute_hash(b"content A");

        assert_ne!(hash1, hash2);
        assert_eq!(hash1, hash3);
        assert_eq!(hash1.len(), 16);
    }
}
