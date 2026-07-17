//! JSON file-based document store.
//!
//! Stores documents as human-readable JSON files in a directory structure.

use crate::error::StoreResult;
use crate::store::{DocumentMetadata, DocumentStore, DocumentSummary, SearchResult, StaleReason};
use async_trait::async_trait;
use pageindex_core::model::DocumentStructure;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// JSON file-based document store.
///
/// NOTE: This backend is intended for single-writer/testing scenarios only.
/// For concurrent-safe storage, prefer `SqliteStore`.
///
/// Directory structure:
/// ```text
/// {base_dir}/
/// ├── index.json              # Master index
/// └── documents/
///     └── {content-hash}/
///         ├── metadata.json   # Document metadata
///         └── structure.json  # Document structure
/// ```
pub struct JsonStore {
    base_dir: PathBuf,
    index: tokio::sync::RwLock<StoreIndex>,
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
struct StoreIndex {
    documents: HashMap<String, IndexEntry>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct IndexEntry {
    name: String,
    source_path: Option<PathBuf>,
    indexed_at: SystemTime,
}

impl JsonStore {
    /// Creates a new JSON store at the specified directory.
    ///
    /// Creates the directory structure if it doesn't exist.
    pub fn new<P: AsRef<Path>>(base_dir: P) -> StoreResult<Self> {
        let base_dir = base_dir.as_ref().to_path_buf();

        // Create directories
        fs::create_dir_all(base_dir.join("documents"))?;

        // Load or create index
        let index_path = base_dir.join("index.json");
        let index = if index_path.exists() {
            let content = fs::read_to_string(&index_path)?;
            serde_json::from_str(&content)?
        } else {
            StoreIndex::default()
        };

        Ok(Self {
            base_dir,
            index: tokio::sync::RwLock::new(index),
        })
    }

    /// Creates a store at the default location.
    pub fn default_location() -> StoreResult<Self> {
        Self::new(crate::default_storage_dir())
    }

    fn doc_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join("documents").join(id)
    }

    fn structure_path(&self, id: &str) -> PathBuf {
        self.doc_dir(id).join("structure.json")
    }

    fn metadata_path(&self, id: &str) -> PathBuf {
        self.doc_dir(id).join("metadata.json")
    }

    fn index_path(&self) -> PathBuf {
        self.base_dir.join("index.json")
    }

    async fn save_index(&self) -> StoreResult<()> {
        let index = self.index.read().await;
        let content = serde_json::to_string_pretty(&*index)?;
        fs::write(self.index_path(), content)?;
        Ok(())
    }

    fn compute_content_hash(doc: &DocumentStructure) -> String {
        let content = serde_json::to_string(doc).unwrap_or_default();
        let hash = Sha256::digest(content.as_bytes());
        format!("{:x}", hash)[..16].to_string()
    }
}

#[async_trait]
impl DocumentStore for JsonStore {
    async fn save(
        &self,
        doc: &DocumentStructure,
        metadata: DocumentMetadata,
    ) -> StoreResult<String> {
        let id = Self::compute_content_hash(doc);
        let doc_dir = self.doc_dir(&id);

        // Create document directory
        fs::create_dir_all(&doc_dir)?;

        // Save structure
        let structure_content = serde_json::to_string_pretty(doc)?;
        fs::write(self.structure_path(&id), structure_content)?;

        // Save metadata
        let metadata_content = serde_json::to_string_pretty(&metadata)?;
        fs::write(self.metadata_path(&id), metadata_content)?;

        // Update index
        {
            let mut index = self.index.write().await;
            index.documents.insert(
                id.clone(),
                IndexEntry {
                    name: doc.doc_name.clone(),
                    source_path: metadata.source_path.clone(),
                    indexed_at: metadata.indexed_at,
                },
            );
        }
        self.save_index().await?;

        tracing::info!("Saved document '{}' with ID {}", doc.doc_name, id);
        Ok(id)
    }

    async fn get(&self, id: &str) -> StoreResult<Option<DocumentStructure>> {
        let path = self.structure_path(id);

        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path)?;
        let doc: DocumentStructure = serde_json::from_str(&content)?;
        Ok(Some(doc))
    }

    async fn get_metadata(&self, id: &str) -> StoreResult<Option<DocumentMetadata>> {
        let path = self.metadata_path(id);

        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path)?;
        let metadata: DocumentMetadata = serde_json::from_str(&content)?;
        Ok(Some(metadata))
    }

    async fn list(&self) -> StoreResult<Vec<DocumentSummary>> {
        let index = self.index.read().await;
        let mut summaries = Vec::new();

        for (id, entry) in &index.documents {
            // Try to load structure for node count
            let node_count = if let Ok(Some(doc)) = self.get(id).await {
                doc.node_count()
            } else {
                0
            };

            // Check staleness
            let (is_stale, stale_reason) = if let Ok(Some(reason)) = self.check_stale(id).await {
                (true, Some(reason))
            } else {
                (false, None)
            };

            summaries.push(DocumentSummary {
                id: id.clone(),
                name: entry.name.clone(),
                source_path: entry.source_path.clone(),
                indexed_at: entry.indexed_at,
                section_count: 0, // Would need to load doc
                node_count,
                file_size: None,
                is_stale,
                stale_reason,
            });
        }

        Ok(summaries)
    }

    async fn delete(&self, id: &str) -> StoreResult<()> {
        let doc_dir = self.doc_dir(id);

        if doc_dir.exists() {
            fs::remove_dir_all(&doc_dir)?;
        }

        // Update index
        {
            let mut index = self.index.write().await;
            index.documents.remove(id);
        }
        self.save_index().await?;

        tracing::info!("Deleted document {}", id);
        Ok(())
    }

    async fn search(&self, query: &str) -> StoreResult<Vec<SearchResult>> {
        let query_lower = query.to_lowercase();
        let index = self.index.read().await;
        let mut results = Vec::new();

        for (id, entry) in &index.documents {
            // Check document name
            if entry.name.to_lowercase().contains(&query_lower) {
                results.push(SearchResult {
                    document_id: id.clone(),
                    document_name: entry.name.clone(),
                    node_id: None,
                    node_title: None,
                    snippet: None,
                    score: 1.0,
                });
                continue;
            }

            // Search within document structure
            if let Ok(Some(doc)) = self.get(id).await {
                for node in doc.all_nodes() {
                    if node.title.to_lowercase().contains(&query_lower) {
                        results.push(SearchResult {
                            document_id: id.clone(),
                            document_name: entry.name.clone(),
                            node_id: node.node_id.clone(),
                            node_title: Some(node.title.clone()),
                            snippet: node.summary.clone(),
                            score: 0.8,
                        });
                    }
                }
            }
        }

        // Sort by score
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        Ok(results)
    }

    async fn find_by_source(&self, path: &Path) -> StoreResult<Option<String>> {
        let index = self.index.read().await;

        for (id, entry) in &index.documents {
            if entry.source_path.as_deref() == Some(path) {
                return Ok(Some(id.clone()));
            }
        }

        Ok(None)
    }

    async fn check_stale(&self, id: &str) -> StoreResult<Option<StaleReason>> {
        let metadata = match self.get_metadata(id).await? {
            Some(m) => m,
            None => return Ok(None),
        };

        let source_path = match &metadata.source_path {
            Some(p) => p,
            None => return Ok(None),
        };

        // Check if file exists
        if !source_path.exists() {
            return Ok(Some(StaleReason::FileDeleted));
        }

        // Check modification time
        if let Ok(file_meta) = fs::metadata(source_path) {
            if let (Ok(file_mtime), Some(stored_mtime)) =
                (file_meta.modified(), metadata.source_mtime)
            {
                if file_mtime > stored_mtime {
                    return Ok(Some(StaleReason::FileModified));
                }
            }
        }

        Ok(None)
    }

    async fn list_stale(&self) -> StoreResult<Vec<(String, StaleReason)>> {
        let index = self.index.read().await;
        let mut stale = Vec::new();

        for id in index.documents.keys() {
            if let Some(reason) = self.check_stale(id).await? {
                stale.push((id.clone(), reason));
            }
        }

        Ok(stale)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pageindex_core::model::DocumentNode;
    use tempfile::TempDir;

    fn create_test_doc() -> DocumentStructure {
        DocumentStructure::new(
            "test-doc",
            vec![
                DocumentNode::new("Chapter 1", 1, 10),
                DocumentNode::new("Chapter 2", 11, 20),
            ],
        )
    }

    fn create_test_metadata() -> DocumentMetadata {
        DocumentMetadata {
            source_path: None,
            source_mtime: None,
            source_size: None,
            content_hash: "test-hash".to_string(),
            indexed_at: SystemTime::now(),
            config_hash: None,
        }
    }

    #[tokio::test]
    async fn test_save_and_get() {
        let temp_dir = TempDir::new().unwrap();
        let store = JsonStore::new(temp_dir.path()).unwrap();

        let doc = create_test_doc();
        let metadata = create_test_metadata();

        let id = store.save(&doc, metadata).await.unwrap();
        assert!(!id.is_empty());

        let retrieved = store.get(&id).await.unwrap().unwrap();
        assert_eq!(retrieved.doc_name, "test-doc");
        assert_eq!(retrieved.structure.len(), 2);
    }

    #[tokio::test]
    async fn test_list() {
        let temp_dir = TempDir::new().unwrap();
        let store = JsonStore::new(temp_dir.path()).unwrap();

        let doc = create_test_doc();
        let metadata = create_test_metadata();
        store.save(&doc, metadata).await.unwrap();

        let list = store.list().await.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "test-doc");
    }

    #[tokio::test]
    async fn test_delete() {
        let temp_dir = TempDir::new().unwrap();
        let store = JsonStore::new(temp_dir.path()).unwrap();

        let doc = create_test_doc();
        let metadata = create_test_metadata();
        let id = store.save(&doc, metadata).await.unwrap();

        store.delete(&id).await.unwrap();

        let retrieved = store.get(&id).await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_search() {
        let temp_dir = TempDir::new().unwrap();
        let store = JsonStore::new(temp_dir.path()).unwrap();

        let doc = create_test_doc();
        let metadata = create_test_metadata();
        store.save(&doc, metadata).await.unwrap();

        let results = store.search("chapter").await.unwrap();
        assert!(!results.is_empty());
    }
}
