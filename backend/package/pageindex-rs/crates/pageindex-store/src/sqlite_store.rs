//! SQLite-based document store.
//!
//! Provides a concurrent-safe storage backend with transactional writes.

use crate::error::{StoreError, StoreResult};
use crate::store::{DocumentMetadata, DocumentStore, DocumentSummary, SearchResult, StaleReason};
use async_trait::async_trait;
use pageindex_core::model::DocumentStructure;
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

/// SQLite-backed document store.
pub struct SqliteStore {
    db_path: PathBuf,
}

impl SqliteStore {
    /// Creates a new SQLite store at the specified file path.
    ///
    /// Creates the parent directory and database schema if needed.
    pub fn new<P: AsRef<Path>>(db_path: P) -> StoreResult<Self> {
        let db_path = db_path.as_ref().to_path_buf();
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path).map_err(db_error)?;
        configure_connection(&conn)?;
        init_schema(&conn)?;

        Ok(Self { db_path })
    }

    /// Creates a store at the default location.
    pub fn default_location() -> StoreResult<Self> {
        let path = crate::default_storage_dir().join("pageindex.sqlite");
        Self::new(path)
    }

    async fn with_connection<T, F>(&self, f: F) -> StoreResult<T>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> StoreResult<T> + Send + 'static,
    {
        let db_path = self.db_path.clone();
        tokio::task::spawn_blocking(move || {
            let mut conn = Connection::open(&db_path).map_err(db_error)?;
            configure_connection(&conn)?;
            f(&mut conn)
        })
        .await
        .map_err(|e| StoreError::DatabaseError(e.to_string()))?
    }

    fn compute_content_hash(doc: &DocumentStructure) -> String {
        let content = serde_json::to_string(doc).unwrap_or_default();
        let hash = Sha256::digest(content.as_bytes());
        format!("{:x}", hash)[..16].to_string()
    }
}

#[async_trait]
impl DocumentStore for SqliteStore {
    async fn save(
        &self,
        doc: &DocumentStructure,
        mut metadata: DocumentMetadata,
    ) -> StoreResult<String> {
        let id = Self::compute_content_hash(doc);
        if metadata.content_hash.is_empty() {
            metadata.content_hash = id.clone();
        }

        let name = doc.doc_name.clone();
        let structure_json = serde_json::to_string(doc)?;
        let metadata_json = serde_json::to_string(&metadata)?;
        let id_for_db = id.clone();

        self.with_connection(move |conn| {
            let tx = conn.transaction().map_err(db_error)?;
            tx.execute(
                "INSERT INTO documents (id, name, structure_json, metadata_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   structure_json = excluded.structure_json,
                   metadata_json = excluded.metadata_json",
                params![id_for_db, name, structure_json, metadata_json],
            )
            .map_err(db_error)?;
            tx.commit().map_err(db_error)?;
            Ok(())
        })
        .await?;

        Ok(id)
    }

    async fn get(&self, id: &str) -> StoreResult<Option<DocumentStructure>> {
        let id = id.to_string();
        self.with_connection(move |conn| {
            let mut stmt = conn
                .prepare("SELECT structure_json FROM documents WHERE id = ?1")
                .map_err(db_error)?;
            let mut rows = stmt.query(params![id]).map_err(db_error)?;

            if let Some(row) = rows.next().map_err(db_error)? {
                let structure_json: String = row.get(0).map_err(db_error)?;
                let doc: DocumentStructure = serde_json::from_str(&structure_json)?;
                Ok(Some(doc))
            } else {
                Ok(None)
            }
        })
        .await
    }

    async fn get_metadata(&self, id: &str) -> StoreResult<Option<DocumentMetadata>> {
        let id = id.to_string();
        self.with_connection(move |conn| {
            let mut stmt = conn
                .prepare("SELECT metadata_json FROM documents WHERE id = ?1")
                .map_err(db_error)?;
            let mut rows = stmt.query(params![id]).map_err(db_error)?;

            if let Some(row) = rows.next().map_err(db_error)? {
                let metadata_json: String = row.get(0).map_err(db_error)?;
                let metadata: DocumentMetadata = serde_json::from_str(&metadata_json)?;
                Ok(Some(metadata))
            } else {
                Ok(None)
            }
        })
        .await
    }

    async fn list(&self) -> StoreResult<Vec<DocumentSummary>> {
        self.with_connection(move |conn| {
            let mut stmt = conn
                .prepare("SELECT id, name, structure_json, metadata_json FROM documents")
                .map_err(db_error)?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                })
                .map_err(db_error)?;

            let mut summaries = Vec::new();
            for row in rows {
                let (id, name, structure_json, metadata_json) = row.map_err(db_error)?;
                let doc: DocumentStructure = serde_json::from_str(&structure_json)?;
                let metadata: DocumentMetadata = serde_json::from_str(&metadata_json)?;

                let stale_reason = compute_stale_reason(&metadata);

                summaries.push(DocumentSummary {
                    id,
                    name,
                    source_path: metadata.source_path.clone(),
                    indexed_at: metadata.indexed_at,
                    section_count: doc.structure.len(),
                    node_count: doc.node_count(),
                    file_size: metadata.source_size,
                    is_stale: stale_reason.is_some(),
                    stale_reason,
                });
            }

            Ok(summaries)
        })
        .await
    }

    async fn delete(&self, id: &str) -> StoreResult<()> {
        let id = id.to_string();
        self.with_connection(move |conn| {
            conn.execute("DELETE FROM documents WHERE id = ?1", params![id])
                .map_err(db_error)?;
            Ok(())
        })
        .await
    }

    async fn search(&self, query: &str) -> StoreResult<Vec<SearchResult>> {
        let query_lower = query.to_lowercase();
        self.with_connection(move |conn| {
            let mut stmt = conn
                .prepare("SELECT id, name, structure_json FROM documents")
                .map_err(db_error)?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                })
                .map_err(db_error)?;

            let mut results = Vec::new();

            for row in rows {
                let (id, name, structure_json) = row.map_err(db_error)?;

                if name.to_lowercase().contains(&query_lower) {
                    results.push(SearchResult {
                        document_id: id.clone(),
                        document_name: name.clone(),
                        node_id: None,
                        node_title: None,
                        snippet: None,
                        score: 1.0,
                    });
                    continue;
                }

                let doc: DocumentStructure = serde_json::from_str(&structure_json)?;
                for node in doc.all_nodes() {
                    if node.title.to_lowercase().contains(&query_lower) {
                        results.push(SearchResult {
                            document_id: id.clone(),
                            document_name: name.clone(),
                            node_id: node.node_id.clone(),
                            node_title: Some(node.title.clone()),
                            snippet: node.summary.clone(),
                            score: 0.8,
                        });
                    }
                }
            }

            results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
            Ok(results)
        })
        .await
    }

    async fn find_by_source(&self, path: &Path) -> StoreResult<Option<String>> {
        let path = path.to_path_buf();
        self.with_connection(move |conn| {
            let mut stmt = conn
                .prepare("SELECT id, metadata_json FROM documents")
                .map_err(db_error)?;
            let rows = stmt
                .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                .map_err(db_error)?;

            for row in rows {
                let (id, metadata_json) = row.map_err(db_error)?;
                let metadata: DocumentMetadata = serde_json::from_str(&metadata_json)?;
                if metadata.source_path.as_deref() == Some(path.as_path()) {
                    return Ok(Some(id));
                }
            }

            Ok(None)
        })
        .await
    }

    async fn check_stale(&self, id: &str) -> StoreResult<Option<StaleReason>> {
        let metadata = self.get_metadata(id).await?;
        Ok(metadata.and_then(|m| compute_stale_reason(&m)))
    }

    async fn list_stale(&self) -> StoreResult<Vec<(String, StaleReason)>> {
        self.with_connection(move |conn| {
            let mut stmt = conn
                .prepare("SELECT id, metadata_json FROM documents")
                .map_err(db_error)?;
            let rows = stmt
                .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                .map_err(db_error)?;

            let mut stale = Vec::new();
            for row in rows {
                let (id, metadata_json) = row.map_err(db_error)?;
                let metadata: DocumentMetadata = serde_json::from_str(&metadata_json)?;
                if let Some(reason) = compute_stale_reason(&metadata) {
                    stale.push((id, reason));
                }
            }

            Ok(stale)
        })
        .await
    }
}

fn compute_stale_reason(metadata: &DocumentMetadata) -> Option<StaleReason> {
    let source_path = metadata.source_path.as_ref()?;

    if !source_path.exists() {
        return Some(StaleReason::FileDeleted);
    }

    if let Ok(file_meta) = fs::metadata(source_path) {
        if let (Ok(file_mtime), Some(stored_mtime)) = (file_meta.modified(), metadata.source_mtime)
        {
            if file_mtime > stored_mtime {
                return Some(StaleReason::FileModified);
            }
        }
    }

    None
}

fn configure_connection(conn: &Connection) -> StoreResult<()> {
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
        .map_err(db_error)?;
    Ok(())
}

fn init_schema(conn: &Connection) -> StoreResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            structure_json TEXT NOT NULL,
            metadata_json TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(name);",
    )
    .map_err(db_error)?;
    Ok(())
}

fn db_error<E: std::fmt::Display>(err: E) -> StoreError {
    StoreError::DatabaseError(err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use pageindex_core::model::DocumentNode;
    use tempfile::TempDir;
    use std::time::SystemTime;

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
            content_hash: "".to_string(),
            indexed_at: SystemTime::now(),
            config_hash: None,
        }
    }

    #[tokio::test]
    async fn test_save_and_get() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("pageindex.sqlite");
        let store = SqliteStore::new(db_path).unwrap();

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
        let db_path = temp_dir.path().join("pageindex.sqlite");
        let store = SqliteStore::new(db_path).unwrap();

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
        let db_path = temp_dir.path().join("pageindex.sqlite");
        let store = SqliteStore::new(db_path).unwrap();

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
        let db_path = temp_dir.path().join("pageindex.sqlite");
        let store = SqliteStore::new(db_path).unwrap();

        let doc = create_test_doc();
        let metadata = create_test_metadata();
        store.save(&doc, metadata).await.unwrap();

        let results = store.search("chapter").await.unwrap();
        assert!(!results.is_empty());
    }
}
