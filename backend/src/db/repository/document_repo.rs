use sqlx::AnyPool;
use crate::errors::AppError;
use crate::models::document::{DocumentModel, DocumentChunkModel};

pub struct DocumentRepo;

impl DocumentRepo {
    pub async fn find_by_id(pool: &AnyPool, id: &str) -> Result<DocumentModel, AppError> {
        sqlx::query_as::<_, DocumentModel>(
            "SELECT id, filename, content_type, file_size, metadata, status, created_at, updated_at
             FROM documents WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Document {} not found", id)))
    }

    pub async fn list_all(pool: &AnyPool) -> Result<Vec<DocumentModel>, AppError> {
        sqlx::query_as::<_, DocumentModel>(
            "SELECT id, filename, content_type, file_size, metadata, status, created_at, updated_at
             FROM documents ORDER BY created_at DESC"
        )
        .fetch_all(pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn create(
        pool: &AnyPool,
        id: &str,
        filename: &str,
        content_type: &str,
        file_size: i64,
    ) -> Result<DocumentModel, AppError> {
        sqlx::query(
            "INSERT INTO documents (id, filename, content_type, file_size, status) VALUES (?, ?, ?, ?, 'pending')"
        )
        .bind(id)
        .bind(filename)
        .bind(content_type)
        .bind(file_size)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id).await
    }

    pub async fn update_status(
        pool: &AnyPool,
        id: &str,
        status: &str,
    ) -> Result<DocumentModel, AppError> {
        sqlx::query("UPDATE documents SET status = ? WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(pool)
            .await?;

        Self::find_by_id(pool, id).await
    }

    pub async fn delete(pool: &AnyPool, id: &str) -> Result<(), AppError> {
        let affected = sqlx::query("DELETE FROM documents WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?
            .rows_affected();

        if affected == 0 {
            return Err(AppError::NotFound(format!("Document {} not found", id)));
        }
        Ok(())
    }
}

pub struct ChunkRepo;

impl ChunkRepo {
    pub async fn find_by_document_id(
        pool: &AnyPool,
        document_id: &str,
    ) -> Result<Vec<DocumentChunkModel>, AppError> {
        sqlx::query_as::<_, DocumentChunkModel>(
            "SELECT id, document_id, content, chunk_index, metadata
             FROM document_chunks WHERE document_id = ? ORDER BY chunk_index"
        )
        .bind(document_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn create(
        pool: &AnyPool,
        id: &str,
        document_id: &str,
        content: &str,
        chunk_index: i32,
    ) -> Result<DocumentChunkModel, AppError> {
        sqlx::query(
            "INSERT INTO document_chunks (id, document_id, content, chunk_index) VALUES (?, ?, ?, ?)"
        )
        .bind(id)
        .bind(document_id)
        .bind(content)
        .bind(chunk_index)
        .execute(pool)
        .await?;

        Ok(DocumentChunkModel {
            id: id.to_string(),
            document_id: document_id.to_string(),
            content: content.to_string(),
            chunk_index,
            metadata: None,
        })
    }

    pub async fn delete_by_document_id(pool: &AnyPool, document_id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM document_chunks WHERE document_id = ?")
            .bind(document_id)
            .execute(pool)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn setup_pool() -> AnyPool {
        sqlx::any::install_default_drivers();
        let pool = sqlx::any::AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create test pool");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                content_type TEXT NOT NULL,
                file_size BIGINT NOT NULL,
                metadata TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create documents table");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS document_chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BYTEA,
                metadata TEXT,
                chunk_index INTEGER NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id)
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create document_chunks table");

        pool
    }

    #[tokio::test]
    async fn test_document_crud() {
        let pool = setup_pool().await;

        let doc = DocumentRepo::create(&pool, "doc-1", "test.pdf", "application/pdf", 1024)
            .await
            .expect("Create should succeed");
        assert_eq!(doc.filename, "test.pdf");
        assert_eq!(doc.status, "pending");

        let found = DocumentRepo::find_by_id(&pool, "doc-1")
            .await
            .expect("Find should succeed");
        assert_eq!(found.filename, "test.pdf");

        let updated = DocumentRepo::update_status(&pool, "doc-1", "indexed")
            .await
            .expect("Update should succeed");
        assert_eq!(updated.status, "indexed");

        let list = DocumentRepo::list_all(&pool).await.expect("List should succeed");
        assert_eq!(list.len(), 1);

        DocumentRepo::delete(&pool, "doc-1").await.expect("Delete should succeed");

        let not_found = DocumentRepo::find_by_id(&pool, "doc-1").await;
        assert!(not_found.is_err());
        match not_found.unwrap_err() {
            AppError::NotFound(_) => {}
            other => panic!("Expected NotFound, got: {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_chunk_crud() {
        let pool = setup_pool().await;
        DocumentRepo::create(&pool, "doc-chunk", "doc.txt", "text/plain", 100).await.unwrap();

        let chunk = ChunkRepo::create(&pool, "chunk-1", "doc-chunk", "Hello world", 0)
            .await
            .expect("Create chunk should succeed");
        assert_eq!(chunk.content, "Hello world");
        assert_eq!(chunk.chunk_index, 0);

        let chunks = ChunkRepo::find_by_document_id(&pool, "doc-chunk")
            .await
            .expect("Find chunks should succeed");
        assert_eq!(chunks.len(), 1);

        ChunkRepo::delete_by_document_id(&pool, "doc-chunk")
            .await
            .expect("Delete chunks should succeed");

        let empty = ChunkRepo::find_by_document_id(&pool, "doc-chunk")
            .await
            .expect("Find after delete should succeed");
        assert!(empty.is_empty());
    }

    #[tokio::test]
    async fn test_delete_nonexistent_document() {
        let pool = setup_pool().await;
        let result = DocumentRepo::delete(&pool, "no-such-doc").await;
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NotFound(_) => {}
            other => panic!("Expected NotFound, got: {:?}", other),
        }
    }
}
