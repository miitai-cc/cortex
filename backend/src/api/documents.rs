use salvo::prelude::*;
use salvo::http::StatusCode;
use crate::core::state::AppState;
use crate::ingestion::parser::parse_file;
use crate::rag::embeddings::EmbeddingService;
use cortex_lib::utils::generate_id;

#[handler]
pub async fn list(depot: &mut Depot) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();

    let rows = sqlx::query_as::<_, (String, String, String, i64, String, String, String)>(
        "SELECT id, filename, content_type, file_size, metadata, status, created_at FROM documents ORDER BY created_at DESC"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    let docs: Vec<serde_json::Value> = rows.into_iter().map(|(id, filename, content_type, file_size, metadata, status, created_at)| {
        serde_json::json!({
            "id": id,
            "filename": filename,
            "content_type": content_type,
            "file_size": file_size,
            "metadata": metadata,
            "status": status,
            "created_at": created_at,
        })
    }).collect();

    Ok(Json(serde_json::json!(docs)))
}

#[handler]
pub async fn get(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let id = req.param::<String>("id").ok_or(StatusError::bad_request())?;

    let row = sqlx::query_as::<_, (String, String, String, i64, String, String, String)>(
        "SELECT id, filename, content_type, file_size, metadata, status, created_at FROM documents WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    match row {
        Some((id, filename, content_type, file_size, metadata, status, created_at)) => {
            Ok(Json(serde_json::json!({
                "id": id,
                "filename": filename,
                "content_type": content_type,
                "file_size": file_size,
                "metadata": metadata,
                "status": status,
                "created_at": created_at,
            })))
        }
        None => Err(StatusError::not_found().with_detail("Document not found")),
    }
}

#[handler]
pub async fn upload(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let embedding_service = EmbeddingService::new(&state.config.embedding_model);

    let file = req.file("file").await.ok_or(StatusError::bad_request().with_detail("No file provided"))?;
    let filename = file.name().unwrap_or("unknown").to_string();
    let content_type = file.content_type().unwrap_or("application/octet-stream").to_string();
    let file_size = file.size() as i64;

    let doc_id = generate_id();
    let file_path = format!("{}/{}", state.config.upload_dir, doc_id);

    // Save file
    tokio::fs::create_dir_all(&state.config.upload_dir).await.map_err(|_| StatusError::internal_server_error())?;
    tokio::fs::write(&file_path, file.bytes().await.map_err(|_| StatusError::internal_server_error())?)
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    // Insert document record
    sqlx::query(
        "INSERT INTO documents (id, filename, content_type, file_size, status) VALUES (?, ?, ?, ?, 'pending')"
    )
    .bind(&doc_id)
    .bind(&filename)
    .bind(&content_type)
    .bind(file_size)
    .execute(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    // Parse and index in background
    let state_clone = state.clone();
    let embedding_clone = embedding_service.clone();
    let doc_id_clone = doc_id.clone();
    let file_path_clone = file_path.clone();
    tokio::spawn(async move {
        if let Err(e) = index_document(state_clone, embedding_clone, &doc_id_clone, &file_path_clone).await {
            tracing::error!("Failed to index document {}: {:?}", doc_id_clone, e);
        }
    });

    Ok(Json(serde_json::json!({
        "id": doc_id,
        "filename": filename,
        "status": "pending"
    })))
}

async fn index_document(state: AppState, embedding: EmbeddingService, doc_id: &str, file_path: &str) -> Result<(), anyhow::Error> {
    sqlx::query("UPDATE documents SET status = 'processing' WHERE id = ?")
        .bind(doc_id)
        .execute(&state.db.pool)
        .await?;

    let content = parse_file(file_path).await?;
    let chunks = crate::rag::chunker::chunk_text(&content, 512, 128);

    for (i, chunk_text) in chunks.iter().enumerate() {
        let chunk_id = generate_id();
        let embedding_vec = embedding.embed(chunk_text).await?;

        // Store chunk in DB
        sqlx::query(
            "INSERT INTO document_chunks (id, document_id, content, chunk_index) VALUES (?, ?, ?, ?)"
        )
        .bind(&chunk_id)
        .bind(doc_id)
        .bind(chunk_text)
        .bind(i as i32)
        .execute(&state.db.pool)
        .await?;

        // Index in Qdrant
        let point = qdrant_client::client::PointStruct::new(
            chunk_id.clone(),
            embedding_vec,
            serde_json::json!({
                "document_id": doc_id,
                "chunk_index": i,
                "content": chunk_text
            }),
        );
        state.qdrant.upsert_points("documents", None, vec![point], None).await?;
    }

    sqlx::query("UPDATE documents SET status = 'indexed' WHERE id = ?")
        .bind(doc_id)
        .execute(&state.db.pool)
        .await?;

    Ok(())
}

#[handler]
pub async fn delete(depot: &mut Depot, req: &mut Request) -> Result<StatusCode, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let id = req.param::<String>("id").ok_or(StatusError::bad_request())?;

    // Delete from DB
    sqlx::query("DELETE FROM document_chunks WHERE document_id = ?")
        .bind(&id)
        .execute(&state.db.pool)
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    sqlx::query("DELETE FROM documents WHERE id = ?")
        .bind(&id)
        .execute(&state.db.pool)
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    // Delete from Qdrant
    let filter = qdrant_client::client::Filter::all(
        qdrant_client::client::FieldCondition::new_match("document_id", &id)
    );
    state.qdrant.delete_points("documents", None, &filter.into()).await.ok();

    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> Router {
    Router::with_path("documents")
        .get(list)
        .push(Router::with_path("upload").post(upload))
        .push(Router::with_path("<id>").get(get).delete(delete))
}
