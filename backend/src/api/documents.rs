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

    // Preserve original extension so pageindex-core can detect PDF
    let ext = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let file_path_with_ext = format!("{}.{}", file_path, ext);
    tokio::fs::copy(&file_path, &file_path_with_ext)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    DocumentRepo::create(&state.db.pool, &doc_id, &filename, &content_type, file_size).await?;

    let state_clone = state.clone();
    let embedding_clone = embedding_service.clone();
    let doc_id_clone = doc_id.clone();
    let file_path_clone = file_path_with_ext.clone();
    let is_pdf = ext == "pdf";
    tokio::spawn(async move {
        if let Err(e) = index_document(state_clone, embedding_clone, &doc_id_clone, &file_path_clone, is_pdf).await {
            tracing::error!("Failed to index document {}: {:?}", doc_id_clone, e);
        }
    });

    Ok(Json(serde_json::json!({
        "id": doc_id,
        "filename": filename,
        "status": "pending",
        "index_method": if is_pdf { "pageindex" } else { "chunker" }
    })))
}

// ──────────────────────────────────────────────────────────────
// Core indexing pipeline dispatcher
// ──────────────────────────────────────────────────────────────
async fn index_document(
    state: AppState,
    embedding: EmbeddingService,
    doc_id: &str,
    file_path: &str,
    is_pdf: bool,
) -> Result<(), anyhow::Error> {
    DocumentRepo::update_status(&state.db.pool, doc_id, "processing").await?;

    if is_pdf {
        index_pdf_with_pageindex(&state, &embedding, doc_id, file_path).await
    } else {
        index_with_chunker(&state, &embedding, doc_id, file_path).await
    }
}

// ──────────────────────────────────────────────────────────────
// PDF: Page-by-page indexing via pageindex-core
// ──────────────────────────────────────────────────────────────
async fn index_pdf_with_pageindex(
    state: &AppState,
    embedding: &EmbeddingService,
    doc_id: &str,
    file_path: &str,
) -> Result<(), anyhow::Error> {
    use pageindex_core::pdf::get_page_tokens;

    tracing::info!("Using pageindex-core for PDF: {}", file_path);

    // get_page_tokens is synchronous (lopdf backend) — run in spawn_blocking
    let file_path_owned = file_path.to_string();
    let pages = tokio::task::spawn_blocking(move || {
        get_page_tokens(&file_path_owned, "gpt-4o")
    })
    .await
    .map_err(|e| anyhow::anyhow!("spawn_blocking error: {:?}", e))?
    .map_err(|e| anyhow::anyhow!("pageindex get_page_tokens error: {:?}", e))?;

    let page_count = pages.len();
    tracing::info!("pageindex extracted {} pages from document {}", page_count, doc_id);

    for (i, page) in pages.iter().enumerate() {
        let page_num = i + 1; // 1-based
        let content = &page.text;

        if content.trim().is_empty() {
            tracing::debug!("Skipping empty page {} for doc {}", page_num, doc_id);
            continue;
        }

        let chunk_id = generate_id();
        let embedding_vec = embedding.embed(content).await
            .map_err(|e| anyhow::anyhow!("Embedding failed for page {}: {:?}", page_num, e))?;

        ChunkRepo::create(&state.db.pool, &chunk_id, doc_id, content, i as i32).await?;

        let payload = Payload::try_from(serde_json::json!({
            "document_id": doc_id,
            "chunk_index": i,
            "page_number": page_num,
            "token_count": page.token_count,
            "content": content,
            "index_method": "pageindex"
        }))
        .map_err(|e| anyhow::anyhow!("Payload conversion error: {:?}", e))?;

        let point = PointStruct::new(chunk_id, embedding_vec, payload);
        state.qdrant.upsert_points(UpsertPointsBuilder::new("documents", vec![point])).await?;

        tracing::debug!("Indexed page {}/{} for doc {}", page_num, page_count, doc_id);
    }

    // Persist metadata (page_count, index_method) into the documents table
    sqlx::query("UPDATE documents SET metadata = ? WHERE id = ?")
        .bind(serde_json::json!({
            "page_count": page_count,
            "index_method": "pageindex"
        }).to_string())
        .bind(doc_id)
        .execute(&state.db.pool)
        .await?;

    DocumentRepo::update_status(&state.db.pool, doc_id, "indexed").await?;
    tracing::info!("Pageindex indexing complete for doc {} ({} pages)", doc_id, page_count);
    Ok(())
}

// ──────────────────────────────────────────────────────────────
// Non-PDF: Original chunker-based indexing (txt, md, docx)
// ──────────────────────────────────────────────────────────────
async fn index_with_chunker(
    state: &AppState,
    embedding: &EmbeddingService,
    doc_id: &str,
    file_path: &str,
) -> Result<(), anyhow::Error> {
    tracing::info!("Using chunker for non-PDF: {}", file_path);

    let content = parse_file(file_path).await?;
    let chunks = crate::rag::chunker::chunk_text(&content, 512, 128);
    let chunk_count = chunks.len();

    for (i, chunk_text) in chunks.iter().enumerate() {
        let chunk_id = generate_id();
        let embedding_vec = embedding.embed(chunk_text).await?;

        ChunkRepo::create(&state.db.pool, &chunk_id, doc_id, chunk_text, i as i32).await?;

        let payload = Payload::try_from(serde_json::json!({
            "document_id": doc_id,
            "chunk_index": i,
            "content": chunk_text,
            "index_method": "chunker"
        }))
        .map_err(|e| anyhow::anyhow!("Payload conversion error: {:?}", e))?;

        let point = PointStruct::new(chunk_id, embedding_vec, payload);
        state.qdrant.upsert_points(UpsertPointsBuilder::new("documents", vec![point])).await?;
    }

    sqlx::query("UPDATE documents SET metadata = ? WHERE id = ?")
        .bind(serde_json::json!({
            "chunk_count": chunk_count,
            "index_method": "chunker"
        }).to_string())
        .bind(doc_id)
        .execute(&state.db.pool)
        .await?;

    DocumentRepo::update_status(&state.db.pool, doc_id, "indexed").await?;
    tracing::info!("Chunker indexing complete for doc {} ({} chunks)", doc_id, chunk_count);
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
