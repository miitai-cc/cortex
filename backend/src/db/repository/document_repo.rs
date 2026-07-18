#![allow(dead_code)]
use crate::errors::AppError;
use crate::models::document::{DocumentChunkModel, DocumentModel};
use sqlx::AnyPool;

pub struct DocumentRepo;

impl DocumentRepo {
    #[tracing::instrument(level = "debug", skip(pool))]
    pub async fn find_by_id(pool: &AnyPool, id: &str) -> Result<DocumentModel, AppError> {
        tracing::debug!("[DocumentRepo::find_by_id] 查詢 id={}", id);
        let result = sqlx::query_as::<_, DocumentModel>(
            "SELECT id, filename, content_type, file_size, metadata, status,
                    CAST(created_at AS TEXT) AS created_at,
                    CAST(updated_at AS TEXT) AS updated_at
             FROM documents WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Document {} not found", id)))?;
        tracing::debug!(
            "[DocumentRepo::find_by_id] 查詢完成，result: id={}, filename={}, status={}",
            result.id,
            result.filename,
            result.status
        );
        Ok(result)
    }

    #[tracing::instrument(level = "debug", skip(pool))]
    pub async fn list_all(pool: &AnyPool) -> Result<Vec<DocumentModel>, AppError> {
        tracing::debug!("[DocumentRepo::list_all] 查詢所有文件...");
        let docs = sqlx::query_as::<_, DocumentModel>(
            "SELECT id, filename, content_type, file_size, metadata, status,
                    CAST(created_at AS TEXT) AS created_at,
                    CAST(updated_at AS TEXT) AS updated_at
             FROM documents ORDER BY created_at DESC",
        )
        .fetch_all(pool)
        .await
        .map_err(AppError::from)?;
        tracing::debug!("[DocumentRepo::list_all] 查詢完成，共 {} 筆", docs.len());
        Ok(docs)
    }

    #[tracing::instrument(level = "debug", skip(pool))]
    pub async fn create(
        pool: &AnyPool,
        id: &str,
        filename: &str,
        content_type: &str,
        file_size: i64,
    ) -> Result<DocumentModel, AppError> {
        tracing::debug!(
            "[DocumentRepo::create] 新增文件 id={}, filename={}, content_type={}, file_size={}",
            id,
            filename,
            content_type,
            file_size
        );
        sqlx::query(
            "INSERT INTO documents (id, filename, content_type, file_size, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        .bind(id)
        .bind(filename)
        .bind(content_type)
        .bind(file_size)
        .execute(pool)
        .await?;
        tracing::debug!("[DocumentRepo::create] INSERT 完成，查詢回傳結果...");

        let result = Self::find_by_id(pool, id).await?;
        tracing::debug!(
            "[DocumentRepo::create] 新增完成，result: id={}, filename={}, status={}",
            result.id,
            result.filename,
            result.status
        );
        Ok(result)
    }

    #[tracing::instrument(level = "debug", skip(pool))]
    pub async fn update_status(
        pool: &AnyPool,
        id: &str,
        status: &str,
    ) -> Result<DocumentModel, AppError> {
        tracing::debug!(
            "[DocumentRepo::update_status] 更新狀態 id={}, status={}",
            id,
            status
        );
        sqlx::query("UPDATE documents SET status = ? WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(pool)
            .await?;
        tracing::debug!("[DocumentRepo::update_status] UPDATE 完成，查詢回傳結果...");

        let result = Self::find_by_id(pool, id).await?;
        tracing::debug!(
            "[DocumentRepo::update_status] 狀態更新完成，result: id={}, status={}",
            result.id,
            result.status
        );
        Ok(result)
    }

    #[tracing::instrument(level = "debug", skip(pool))]
    pub async fn delete(pool: &AnyPool, id: &str) -> Result<(), AppError> {
        tracing::debug!("[DocumentRepo::delete] 刪除文件 id={}", id);
        let affected = sqlx::query("DELETE FROM documents WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?
            .rows_affected();
        tracing::debug!(
            "[DocumentRepo::delete] DELETE 完成，affected_rows={}",
            affected
        );

        if affected == 0 {
            tracing::debug!("[DocumentRepo::delete] 找不到文件 id={}", id);
            return Err(AppError::NotFound(format!("Document {} not found", id)));
        }
        tracing::debug!("[DocumentRepo::delete] 刪除成功 id={}", id);
        Ok(())
    }
}

pub struct ChunkRepo;

impl ChunkRepo {
    #[tracing::instrument(level = "debug", skip(pool))]
    pub async fn find_by_document_id(
        pool: &AnyPool,
        document_id: &str,
    ) -> Result<Vec<DocumentChunkModel>, AppError> {
        tracing::debug!(
            "[ChunkRepo::find_by_document_id] 查詢 chunks document_id={}",
            document_id
        );
        let chunks = sqlx::query_as::<_, DocumentChunkModel>(
            "SELECT id, document_id, content, chunk_index, metadata
             FROM document_chunks WHERE document_id = ? ORDER BY chunk_index",
        )
        .bind(document_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::from)?;
        tracing::debug!(
            "[ChunkRepo::find_by_document_id] 查詢完成，共 {} 個 chunks",
            chunks.len()
        );
        Ok(chunks)
    }

    #[tracing::instrument(level = "debug", skip(pool, content))]
    pub async fn create(
        pool: &AnyPool,
        id: &str,
        document_id: &str,
        content: &str,
        chunk_index: i32,
    ) -> Result<DocumentChunkModel, AppError> {
        tracing::debug!(
            "[ChunkRepo::create] 新增 chunk id={}, document_id={}, chunk_index={}, content_len={}",
            id,
            document_id,
            chunk_index,
            content.len()
        );
        sqlx::query(
            "INSERT INTO document_chunks (id, document_id, content, chunk_index) VALUES (?, ?, ?, ?)"
        )
        .bind(id)
        .bind(document_id)
        .bind(content)
        .bind(chunk_index)
        .execute(pool)
        .await?;
        tracing::debug!("[ChunkRepo::create] INSERT 完成");

        let result = DocumentChunkModel {
            id: id.to_string(),
            document_id: document_id.to_string(),
            content: content.to_string(),
            chunk_index,
            metadata: None,
        };
        tracing::debug!(
            "[ChunkRepo::create] 新增完成，result: id={}, chunk_index={}",
            result.id,
            result.chunk_index
        );
        Ok(result)
    }

    #[tracing::instrument(level = "debug", skip(pool))]
    pub async fn delete_by_document_id(pool: &AnyPool, document_id: &str) -> Result<(), AppError> {
        tracing::debug!(
            "[ChunkRepo::delete_by_document_id] 刪除 chunks document_id={}",
            document_id
        );
        let result = sqlx::query("DELETE FROM document_chunks WHERE document_id = ?")
            .bind(document_id)
            .execute(pool)
            .await?;
        tracing::debug!(
            "[ChunkRepo::delete_by_document_id] 刪除完成，affected_rows={}",
            result.rows_affected()
        );
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
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
            )",
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

        let list = DocumentRepo::list_all(&pool)
            .await
            .expect("List should succeed");
        assert_eq!(list.len(), 1);

        DocumentRepo::delete(&pool, "doc-1")
            .await
            .expect("Delete should succeed");

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
        DocumentRepo::create(&pool, "doc-chunk", "doc.txt", "text/plain", 100)
            .await
            .unwrap();

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
