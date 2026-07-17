use salvo::prelude::*;
use crate::core::state::AppState;
use crate::db::repository::document_repo::{DocumentRepo, ChunkRepo};
use crate::errors::AppError;
use crate::ingestion::parser::parse_file;
use crate::rag::embeddings::EmbeddingService;
use cortex_lib::utils::generate_id;
use qdrant_client::qdrant::{Condition, DeletePointsBuilder, Filter, PointStruct, UpsertPointsBuilder};
use qdrant_client::Payload;

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn list(depot: &mut Depot) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let docs = DocumentRepo::list_all(&state.db.pool).await?;
    Ok(Json(serde_json::json!(docs)))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn get(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let id = req.param::<String>("id").ok_or(AppError::BadRequest("Missing document id".into()))?;
    let doc = DocumentRepo::find_by_id(&state.db.pool, &id).await?;
    Ok(Json(serde_json::json!(doc)))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn upload(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let embedding_service = EmbeddingService::new(&state.config.embedding_model);

    let file = req.file("file").await.ok_or(AppError::BadRequest("No file provided".into()))?;
    let filename = file.name().unwrap_or("unknown").to_string();
    let content_type = file.content_type().unwrap_or(mime::APPLICATION_OCTET_STREAM).to_string();
    let file_size = file.size() as i64;

    let doc_id = generate_id();
    let file_path = format!("{}/{}", state.config.upload_dir, doc_id);

    tokio::fs::create_dir_all(&state.config.upload_dir).await.map_err(|e| AppError::Internal(e.to_string()))?;
    let file_bytes = tokio::fs::read(file.path()).await.map_err(|e| AppError::Internal(e.to_string()))?;
    tokio::fs::write(&file_path, file_bytes)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    DocumentRepo::create(&state.db.pool, &doc_id, &filename, &content_type, file_size).await?;

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
    crate::db::repository::document_repo::DocumentRepo::update_status(
        &state.db.pool, doc_id, "processing"
    ).await?;

    let content = parse_file(file_path).await?;
    let chunks = crate::rag::chunker::chunk_text(&content, 512, 128);

    for (i, chunk_text) in chunks.iter().enumerate() {
        let chunk_id = generate_id();
        let embedding_vec = embedding.embed(chunk_text).await?;

        ChunkRepo::create(&state.db.pool, &chunk_id, doc_id, chunk_text, i as i32).await?;

        let payload = Payload::try_from(serde_json::json!({
            "document_id": doc_id,
            "chunk_index": i,
            "content": chunk_text
        })).map_err(|e| anyhow::anyhow!("Payload conversion error: {:?}", e))?;
        let point = PointStruct::new(chunk_id, embedding_vec, payload);
        state.qdrant.upsert_points(UpsertPointsBuilder::new("documents", vec![point])).await?;
    }

    DocumentRepo::update_status(&state.db.pool, doc_id, "indexed").await?;
    Ok(())
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn delete(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let id = req.param::<String>("id").ok_or(AppError::BadRequest("Missing document id".into()))?;

    ChunkRepo::delete_by_document_id(&state.db.pool, &id).await?;
    DocumentRepo::delete(&state.db.pool, &id).await?;

    let filter = Filter::must([Condition::matches("document_id", id)]);
    state.qdrant.delete_points(DeletePointsBuilder::new("documents").points(filter)).await.ok();

    Ok(Json(serde_json::json!({"deleted": true})))
}

pub fn router() -> Router {
    Router::with_path("documents")
        .get(list)
        .push(Router::with_path("upload").post(upload))
        .push(Router::with_path("<id>").get(get).delete(delete))
}
