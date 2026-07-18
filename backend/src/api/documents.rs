use crate::core::state::AppState;
use crate::db::repository::document_repo::{ChunkRepo, DocumentRepo};
use crate::errors::AppError;
use crate::ingestion::parser::parse_file;
use crate::rag::embeddings::EmbeddingService;
use cortex_lib::utils::generate_id;
use qdrant_client::qdrant::{
    Condition, DeletePointsBuilder, Filter, PointStruct, UpsertPointsBuilder,
};
use qdrant_client::Payload;
use salvo::prelude::*;

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn list(depot: &mut Depot) -> Result<Json<serde_json::Value>, AppError> {
    tracing::debug!("▶ [list] 收到列出文件請求");
    let state = depot.obtain::<AppState>().unwrap();
    tracing::debug!("[list] 從 DB 查詢所有文件...");
    let docs = DocumentRepo::list_all(&state.db.pool).await?;
    tracing::debug!(
        "[list] 查詢完成，共 {} 筆文件，回傳結果: {:?}",
        docs.len(),
        docs
    );
    Ok(Json(serde_json::json!(docs)))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn get(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::debug!("▶ [get] 收到查詢單一文件請求");
    let state = depot.obtain::<AppState>().unwrap();
    let id = req
        .param::<String>("id")
        .ok_or(AppError::BadRequest("Missing document id".into()))?;
    tracing::debug!("[get] 參數 id={}", id);
    tracing::debug!("[get] 從 DB 查詢文件...");
    let doc = DocumentRepo::find_by_id(&state.db.pool, &id).await?;
    tracing::debug!("[get] 查詢完成，回傳結果: {:?}", doc);
    Ok(Json(serde_json::json!(doc)))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn upload(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::debug!("▶ [upload] 收到文件上傳請求");
    let state = depot.obtain::<AppState>().unwrap();
    let embedding_service = EmbeddingService::new(&state.config.embedding_model);
    tracing::debug!(
        "[upload] embedding_model={}, upload_dir={}",
        state.config.embedding_model,
        state.config.upload_dir
    );

    let file = req
        .file("file")
        .await
        .ok_or(AppError::BadRequest("No file provided".into()))?;
    let filename = file.name().unwrap_or("unknown").to_string();
    let content_type = file
        .content_type()
        .unwrap_or(mime::APPLICATION_OCTET_STREAM)
        .to_string();
    let file_size = file.size() as i64;
    tracing::debug!(
        "[upload] 接收到文件: filename={}, content_type={}, file_size={}",
        filename,
        content_type,
        file_size
    );

    let doc_id = generate_id();
    let file_path = format!("{}/{}", state.config.upload_dir, doc_id);
    tracing::debug!(
        "[upload] 生成 doc_id={}, 目標路徑={}",
        doc_id,
        file_path
    );

    tokio::fs::create_dir_all(&state.config.upload_dir)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tracing::debug!("[upload] 上傳目錄已確認存在: {}", state.config.upload_dir);

    let file_bytes = tokio::fs::read(file.path())
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tracing::debug!("[upload] 讀取原始文件完成，byte_len={}", file_bytes.len());

    tokio::fs::write(&file_path, file_bytes)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tracing::debug!("[upload] 寫入文件完成: {}", file_path);

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
    tracing::debug!(
        "[upload] 副檔名副本完成: ext={}, file_path_with_ext={}",
        ext,
        file_path_with_ext
    );

    tracing::debug!("[upload] 寫入 DB 文件記錄...");
    DocumentRepo::create(&state.db.pool, &doc_id, &filename, &content_type, file_size).await?;
    tracing::debug!("[upload] DB 記錄寫入完成，準備啟動背景索引...");

    let state_clone = state.clone();
    let embedding_clone = embedding_service.clone();
    let doc_id_clone = doc_id.clone();
    let file_path_clone = file_path_with_ext.clone();
    let is_pdf = ext == "pdf";
    tracing::debug!(
        "[upload] is_pdf={}, index_method={}",
        is_pdf,
        if is_pdf { "pageindex" } else { "chunker" }
    );
    tokio::spawn(async move {
        if let Err(e) = index_document(
            state_clone,
            embedding_clone,
            &doc_id_clone,
            &file_path_clone,
            is_pdf,
        )
        .await
        {
            tracing::error!("Failed to index document {}: {:?}", doc_id_clone, e);
        }
    });

    let response = serde_json::json!({
        "id": doc_id,
        "filename": filename,
        "status": "pending",
        "index_method": if is_pdf { "pageindex" } else { "chunker" }
    });
    tracing::debug!("[upload] 回傳結果: {}", response);
    Ok(Json(response))
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
    tracing::debug!(
        "▶ [index_document] 開始索引流程 doc_id={}, file_path={}, is_pdf={}",
        doc_id,
        file_path,
        is_pdf
    );

    tracing::debug!("[index_document] 更新文件狀態為 'processing'...");
    DocumentRepo::update_status(&state.db.pool, doc_id, "processing").await?;
    tracing::debug!("[index_document] 狀態更新完成，分派索引方法...");

    if is_pdf {
        tracing::debug!("[index_document] → 分派到 pageindex 方法");
        index_pdf_with_pageindex(&state, &embedding, doc_id, file_path).await
    } else {
        tracing::debug!("[index_document] → 分派到 chunker 方法");
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
    tracing::debug!(
        "[pageindex] 開始 PDF 逐頁索引 file_path={}, doc_id={}",
        file_path,
        doc_id
    );

    // get_page_tokens is synchronous (lopdf backend) — run in spawn_blocking
    let file_path_owned = file_path.to_string();
    tracing::debug!("[pageindex] 呼叫 get_page_tokens（同步，spawn_blocking）...");
    let pages = tokio::task::spawn_blocking(move || get_page_tokens(&file_path_owned, "gpt-4o"))
        .await
        .map_err(|e| anyhow::anyhow!("spawn_blocking error: {:?}", e))?;
    tracing::debug!("[pageindex] spawn_blocking 完成，解析結果中...");
    let pages = pages.map_err(|e| anyhow::anyhow!("pageindex get_page_tokens error: {:?}", e))?;

    let page_count = pages.len();
    tracing::info!(
        "pageindex extracted {} pages from document {}",
        page_count,
        doc_id
    );
    tracing::debug!(
        "[pageindex] 提取完成，共 {} 頁，每頁 tokens 資訊: {:?}",
        page_count,
        pages.iter().map(|p| p.token_count).collect::<Vec<_>>()
    );

    for (i, page) in pages.iter().enumerate() {
        let page_num = i + 1; // 1-based
        let content = &page.text;

        tracing::debug!(
            "[pageindex] 處理第 {} 頁 (index={}): text_len={}, token_count={}",
            page_num,
            i,
            content.len(),
            page.token_count
        );

        if content.trim().is_empty() {
            tracing::debug!("[pageindex] 第 {} 頁為空白，跳過", page_num);
            continue;
        }

        tracing::debug!("[pageindex] 第 {} 頁前 100 字元: {:?}", page_num, &content[..content.len().min(100)]);

        let chunk_id = generate_id();
        tracing::debug!("[pageindex] 第 {} 頁生成 chunk_id={}", page_num, chunk_id);

        tracing::debug!("[pageindex] 第 {} 頁正在產生 embedding...", page_num);
        let embedding_vec = embedding
            .embed(content)
            .await
            .map_err(|e| anyhow::anyhow!("Embedding failed for page {}: {:?}", page_num, e))?;
        tracing::debug!(
            "[pageindex] 第 {} 頁 embedding 完成，vector_dim={}",
            page_num,
            embedding_vec.len()
        );

        tracing::debug!("[pageindex] 第 {} 頁寫入 DB chunk 記錄...", page_num);
        ChunkRepo::create(&state.db.pool, &chunk_id, doc_id, content, i as i32).await?;
        tracing::debug!("[pageindex] 第 {} 頁 DB 記錄寫入完成", page_num);

        let payload = Payload::try_from(serde_json::json!({
            "document_id": doc_id,
            "chunk_index": i,
            "page_number": page_num,
            "token_count": page.token_count,
            "content": content,
            "index_method": "pageindex"
        }))
        .map_err(|e| anyhow::anyhow!("Payload conversion error: {:?}", e))?;

        let point = PointStruct::new(chunk_id.clone(), embedding_vec.clone(), payload);
        tracing::debug!("[pageindex] 第 {} 頁 upsert 到 Qdrant collection='documents'...", page_num);
        state
            .qdrant
            .upsert_points(UpsertPointsBuilder::new("documents", vec![point]))
            .await?;
        tracing::debug!(
            "[pageindex] ✅ 第 {}/{} 頁完成 (doc_id={}, chunk_id={})",
            page_num,
            page_count,
            doc_id,
            chunk_id
        );
    }

    // Persist metadata (page_count, index_method) into the documents table
    let metadata_json = serde_json::json!({
        "page_count": page_count,
        "index_method": "pageindex"
    });
    tracing::debug!(
        "[pageindex] 寫入 metadata 到 documents 表: {}",
        metadata_json
    );
    sqlx::query("UPDATE documents SET metadata = ? WHERE id = ?")
        .bind(metadata_json.to_string())
        .bind(doc_id)
        .execute(&state.db.pool)
        .await?;

    tracing::debug!("[pageindex] 更新文件狀態為 'indexed'...");
    DocumentRepo::update_status(&state.db.pool, doc_id, "indexed").await?;
    tracing::info!(
        "Pageindex indexing complete for doc {} ({} pages)",
        doc_id,
        page_count
    );
    tracing::debug!("[pageindex] ▶ 索引流程完成 doc_id={}", doc_id);
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
    tracing::debug!(
        "[chunker] 開始非 PDF 索引 file_path={}, doc_id={}",
        file_path,
        doc_id
    );

    tracing::debug!("[chunker] 呼叫 parse_file() 解析文件內容...");
    let content = parse_file(file_path).await?;
    tracing::debug!(
        "[chunker] parse_file 完成，content_len={}, 前 100 字元: {:?}",
        content.len(),
        &content[..content.len().min(100)]
    );

    tracing::debug!("[chunker] 呼叫 chunk_text() 分塊 (chunk_size=512, overlap=128)...");
    let chunks = crate::rag::chunker::chunk_text(&content, 512, 128);
    let chunk_count = chunks.len();
    tracing::debug!(
        "[chunker] 分塊完成，共 {} 個 chunks",
        chunk_count
    );

    for (i, chunk_text) in chunks.iter().enumerate() {
        tracing::debug!(
            "[chunker] 處理 chunk {}: len={}, 前 60 字元: {:?}",
            i,
            chunk_text.len(),
            &chunk_text[..chunk_text.len().min(60)]
        );

        let chunk_id = generate_id();
        tracing::debug!("[chunker] chunk {} 生成 chunk_id={}", i, chunk_id);

        tracing::debug!("[chunker] chunk {} 正在產生 embedding...", i);
        let embedding_vec = embedding.embed(chunk_text).await?;
        tracing::debug!(
            "[chunker] chunk {} embedding 完成，vector_dim={}",
            i,
            embedding_vec.len()
        );

        tracing::debug!("[chunker] chunk {} 寫入 DB...", i);
        ChunkRepo::create(&state.db.pool, &chunk_id, doc_id, chunk_text, i as i32).await?;
        tracing::debug!("[chunker] chunk {} DB 寫入完成", i);

        let payload = Payload::try_from(serde_json::json!({
            "document_id": doc_id,
            "chunk_index": i,
            "content": chunk_text,
            "index_method": "chunker"
        }))
        .map_err(|e| anyhow::anyhow!("Payload conversion error: {:?}", e))?;

        let point = PointStruct::new(chunk_id.clone(), embedding_vec.clone(), payload);
        tracing::debug!("[chunker] chunk {} upsert 到 Qdrant...", i);
        state
            .qdrant
            .upsert_points(UpsertPointsBuilder::new("documents", vec![point]))
            .await?;
        tracing::debug!(
            "[chunker] ✅ chunk {}/{} 完成 (chunk_id={})",
            i + 1,
            chunk_count,
            chunk_id
        );
    }

    let metadata_json = serde_json::json!({
        "chunk_count": chunk_count,
        "index_method": "chunker"
    });
    tracing::debug!(
        "[chunker] 寫入 metadata 到 documents 表: {}",
        metadata_json
    );
    sqlx::query("UPDATE documents SET metadata = ? WHERE id = ?")
        .bind(metadata_json.to_string())
        .bind(doc_id)
        .execute(&state.db.pool)
        .await?;

    tracing::debug!("[chunker] 更新文件狀態為 'indexed'...");
    DocumentRepo::update_status(&state.db.pool, doc_id, "indexed").await?;
    tracing::info!(
        "Chunker indexing complete for doc {} ({} chunks)",
        doc_id,
        chunk_count
    );
    tracing::debug!("[chunker] ▶ 索引流程完成 doc_id={}", doc_id);
    Ok(())
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn delete(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::debug!("▶ [delete] 收到刪除文件請求");
    let state = depot.obtain::<AppState>().unwrap();
    let id = req
        .param::<String>("id")
        .ok_or(AppError::BadRequest("Missing document id".into()))?;
    tracing::debug!("[delete] 參數 id={}", id);

    tracing::debug!("[delete] 刪除 document_chunks (document_id={})...", id);
    ChunkRepo::delete_by_document_id(&state.db.pool, &id).await?;
    tracing::debug!("[delete] chunks 刪除完成");

    tracing::debug!("[delete] 刪除 documents 記錄 (id={})...", id);
    DocumentRepo::delete(&state.db.pool, &id).await?;
    tracing::debug!("[delete] documents 記錄刪除完成");

    tracing::debug!("[delete] 刪除 Qdrant 向量 (document_id={})...", id);
    let filter = Filter::must([Condition::matches("document_id", id)]);
    state
        .qdrant
        .delete_points(DeletePointsBuilder::new("documents").points(filter))
        .await
        .ok();
    tracing::debug!("[delete] Qdrant 向量刪除完成");

    tracing::debug!("[delete] 回傳結果: {{\"deleted\": true}}");
    Ok(Json(serde_json::json!({"deleted": true})))
}

pub fn router() -> Router {
    Router::with_path("documents")
        .get(list)
        .push(Router::with_path("upload").post(upload))
        .push(Router::with_path("<id>").get(get).delete(delete))
}
