use crate::core::state::AppState;
use crate::db::repository::document_repo::{ChunkRepo, DocumentRepo};
use crate::errors::AppError;
use crate::ingestion::parser::parse_file;
use crate::rag::embeddings::EmbeddingService;
use cortex_lib::utils::generate_id;
use futures_util::{SinkExt, StreamExt};
use qdrant_client::qdrant::{
    Condition, CreateCollectionBuilder, DeletePointsBuilder, Distance, Filter, PointStruct,
    UpsertPointsBuilder, VectorParamsBuilder,
};
use qdrant_client::Payload;
use salvo::prelude::*;
use salvo::websocket::{Message, WebSocketUpgrade};
use serde::Serialize;
use tokio::sync::mpsc::UnboundedSender;

const DOCUMENTS_COLLECTION: &str = "documents";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentIndexEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    stage: &'static str,
    message: String,
    document_id: Option<String>,
    status: &'static str,
    progress: u8,
    result: Option<serde_json::Value>,
}

impl DocumentIndexEvent {
    fn progress(
        stage: &'static str,
        message: impl Into<String>,
        document_id: Option<&str>,
        progress: u8,
    ) -> Self {
        Self {
            event_type: "PROGRESS",
            stage,
            message: message.into(),
            document_id: document_id.map(str::to_owned),
            status: "processing",
            progress,
            result: None,
        }
    }

    fn terminal(
        event_type: &'static str,
        message: impl Into<String>,
        document_id: &str,
        status: &'static str,
        result: Option<serde_json::Value>,
    ) -> Self {
        Self {
            event_type,
            stage: "complete",
            message: message.into(),
            document_id: Some(document_id.to_string()),
            status,
            progress: if status == "indexed" { 100 } else { 0 },
            result,
        }
    }
}

fn report(sender: Option<&UnboundedSender<DocumentIndexEvent>>, event: DocumentIndexEvent) {
    if let Some(sender) = sender {
        let _ = sender.send(event);
    }
}

async fn ensure_documents_collection(
    state: &AppState,
    vector_size: usize,
) -> Result<(), anyhow::Error> {
    if state.qdrant.collection_exists(DOCUMENTS_COLLECTION).await? {
        return Ok(());
    }

    tracing::info!(
        "Creating Qdrant collection '{}' with vector_size={}",
        DOCUMENTS_COLLECTION,
        vector_size
    );
    let request = CreateCollectionBuilder::new(DOCUMENTS_COLLECTION).vectors_config(
        VectorParamsBuilder::new(vector_size as u64, Distance::Cosine),
    );

    if let Err(create_error) = state.qdrant.create_collection(request).await {
        // Another indexing task may have created it between the exists/create calls.
        if !state.qdrant.collection_exists(DOCUMENTS_COLLECTION).await? {
            return Err(create_error.into());
        }
    }

    Ok(())
}

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
    tracing::debug!("[upload] 生成 doc_id={}, 目標路徑={}", doc_id, file_path);

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
            &state_clone,
            embedding_clone,
            &doc_id_clone,
            &file_path_clone,
            is_pdf,
            None,
        )
        .await
        {
            tracing::error!("Failed to index document {}: {:?}", doc_id_clone, e);
            let _ =
                DocumentRepo::update_status(&state_clone.db.pool, &doc_id_clone, "failed").await;
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

async fn run_document_upload_stream(
    ws: salvo::websocket::WebSocket,
    state: AppState,
    filename: String,
    content_type: String,
) {
    let (mut sink, mut stream) = ws.split();
    let (events, mut event_rx) = tokio::sync::mpsc::unbounded_channel::<DocumentIndexEvent>();
    let forward_events = tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            let Ok(json) = serde_json::to_string(&event) else {
                continue;
            };
            if sink.send(Message::text(json)).await.is_err() {
                break;
            }
        }
    });

    let _ = events.send(DocumentIndexEvent::progress(
        "connected",
        "gRPC-over-WebSocket 連線已建立，等待文件資料",
        None,
        0,
    ));

    let file_bytes = match stream.next().await {
        Some(Ok(message)) if message.is_binary() => message.into_bytes(),
        Some(Ok(_)) => {
            let _ = events.send(DocumentIndexEvent::terminal(
                "ERROR",
                "預期收到 binary 文件資料",
                "",
                "failed",
                None,
            ));
            drop(events);
            let _ = forward_events.await;
            return;
        }
        Some(Err(error)) => {
            let _ = events.send(DocumentIndexEvent::terminal(
                "ERROR",
                format!("接收文件失敗: {error}"),
                "",
                "failed",
                None,
            ));
            drop(events);
            let _ = forward_events.await;
            return;
        }
        None => {
            drop(events);
            let _ = forward_events.await;
            return;
        }
    };

    let doc_id = generate_id();
    let ext = std::path::Path::new(&filename)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_lowercase();
    let is_pdf = ext == "pdf";
    let file_path = format!("{}/{}.{}", state.config.upload_dir, doc_id, ext);

    let result: Result<serde_json::Value, anyhow::Error> = async {
        tokio::fs::create_dir_all(&state.config.upload_dir).await?;
        tokio::fs::write(&file_path, &file_bytes).await?;
        let file_size = i64::try_from(file_bytes.len()).unwrap_or(i64::MAX);
        let document =
            DocumentRepo::create(&state.db.pool, &doc_id, &filename, &content_type, file_size)
                .await?;
        let _ = events.send(DocumentIndexEvent::progress(
            "uploaded",
            format!("文件已接收並建立記錄: {filename}"),
            Some(&doc_id),
            10,
        ));

        let embedding = EmbeddingService::new(&state.config.embedding_model);
        index_document(
            &state,
            embedding,
            &doc_id,
            &file_path,
            is_pdf,
            Some(&events),
        )
        .await?;

        let indexed = DocumentRepo::find_by_id(&state.db.pool, &doc_id).await?;
        Ok(serde_json::json!({
            "document": indexed,
            "initialDocument": document,
            "indexMethod": if is_pdf { "pageindex" } else { "chunker" }
        }))
    }
    .await;

    match result {
        Ok(result) => {
            let _ = events.send(DocumentIndexEvent::terminal(
                "COMPLETE",
                "文件索引完成",
                &doc_id,
                "indexed",
                Some(result),
            ));
        }
        Err(error) => {
            tracing::error!("Failed to index streamed document {}: {error:#}", doc_id);
            let _ = DocumentRepo::update_status(&state.db.pool, &doc_id, "failed").await;
            let _ = events.send(DocumentIndexEvent::terminal(
                "ERROR",
                format!("文件索引失敗: {error:#}"),
                &doc_id,
                "failed",
                None,
            ));
        }
    }

    drop(events);
    let _ = forward_events.await;
}

#[handler]
pub async fn upload_stream(
    req: &mut Request,
    res: &mut Response,
    depot: &mut Depot,
) -> Result<(), StatusError> {
    let state = depot.obtain::<AppState>().unwrap().clone();
    let filename = req
        .query::<String>("filename")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "upload.bin".to_string());
    let content_type = req
        .query::<String>("content_type")
        .unwrap_or_else(|| "application/octet-stream".to_string());

    WebSocketUpgrade::new()
        .upgrade(req, res, move |ws| async move {
            run_document_upload_stream(ws, state, filename, content_type).await;
        })
        .await
}

// ──────────────────────────────────────────────────────────────
// Core indexing pipeline dispatcher
// ──────────────────────────────────────────────────────────────
async fn index_document(
    state: &AppState,
    embedding: EmbeddingService,
    doc_id: &str,
    file_path: &str,
    is_pdf: bool,
    progress: Option<&UnboundedSender<DocumentIndexEvent>>,
) -> Result<(), anyhow::Error> {
    tracing::debug!(
        "▶ [index_document] 開始索引流程 doc_id={}, file_path={}, is_pdf={}",
        doc_id,
        file_path,
        is_pdf
    );

    tracing::debug!("[index_document] 更新文件狀態為 'processing'...");
    DocumentRepo::update_status(&state.db.pool, doc_id, "processing").await?;
    report(
        progress,
        DocumentIndexEvent::progress(
            "processing",
            "文件狀態已更新為 processing",
            Some(doc_id),
            15,
        ),
    );
    tracing::debug!("[index_document] 狀態更新完成，分派索引方法...");

    if is_pdf {
        tracing::debug!("[index_document] → 分派到 pageindex 方法");
        index_pdf_with_pageindex(state, &embedding, doc_id, file_path, progress).await
    } else {
        tracing::debug!("[index_document] → 分派到 chunker 方法");
        index_with_chunker(state, &embedding, doc_id, file_path, progress).await
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
    progress: Option<&UnboundedSender<DocumentIndexEvent>>,
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
    let mut collection_ready = false;
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
    report(
        progress,
        DocumentIndexEvent::progress(
            "chunking",
            format!("PDF 解析完成，共 {page_count} 頁"),
            Some(doc_id),
            25,
        ),
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

        tracing::debug!(
            "[pageindex] 第 {} 頁前 100 字元: {:?}",
            page_num,
            &content[..content.len().min(100)]
        );

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

        if !collection_ready {
            ensure_documents_collection(state, embedding_vec.len()).await?;
            collection_ready = true;
        }

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
        tracing::debug!(
            "[pageindex] 第 {} 頁 upsert 到 Qdrant collection='documents'...",
            page_num
        );
        state
            .qdrant
            .upsert_points(UpsertPointsBuilder::new("documents", vec![point]))
            .await?;
        let percent = 25 + (((i + 1) * 65 / page_count.max(1)) as u8);
        report(
            progress,
            DocumentIndexEvent::progress(
                "indexing",
                format!("第 {page_num}/{page_count} 頁已寫入向量資料庫"),
                Some(doc_id),
                percent,
            ),
        );
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
    progress: Option<&UnboundedSender<DocumentIndexEvent>>,
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
    let mut collection_ready = false;
    tracing::debug!("[chunker] 分塊完成，共 {} 個 chunks", chunk_count);
    report(
        progress,
        DocumentIndexEvent::progress(
            "chunking",
            format!("文件分塊完成，共 {chunk_count} 個 chunks"),
            Some(doc_id),
            25,
        ),
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

        if !collection_ready {
            ensure_documents_collection(state, embedding_vec.len()).await?;
            collection_ready = true;
        }

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
        let percent = 25 + (((i + 1) * 65 / chunk_count.max(1)) as u8);
        report(
            progress,
            DocumentIndexEvent::progress(
                "indexing",
                format!("chunk {}/{} 已寫入向量資料庫", i + 1, chunk_count),
                Some(doc_id),
                percent,
            ),
        );
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
    tracing::debug!("[chunker] 寫入 metadata 到 documents 表: {}", metadata_json);
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
        .push(Router::with_path("ws/upload").get(upload_stream))
        .push(Router::with_path("<id>").get(get).delete(delete))
}
