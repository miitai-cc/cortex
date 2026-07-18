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
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};
use tokio::sync::mpsc::UnboundedSender;

const DOCUMENTS_COLLECTION: &str = "documents";

pub(crate) fn normalized_directory(value: Option<&str>) -> Result<String, AppError> {
    let value = value.unwrap_or("/").trim();
    let mut parts = Vec::new();
    for component in Path::new(value).components() {
        match component {
            Component::RootDir | Component::CurDir => {}
            Component::Normal(part) => parts.push(part.to_string_lossy().into_owned()),
            _ => return Err(AppError::BadRequest("Invalid document directory".into())),
        }
    }
    if value.contains('\\') || parts.iter().any(|part| part.is_empty()) {
        return Err(AppError::BadRequest("Invalid document directory".into()));
    }
    Ok(if parts.is_empty() {
        "/".into()
    } else {
        format!("/{}", parts.join("/"))
    })
}

pub(crate) fn directory_path(upload_dir: &str, directory: &str) -> PathBuf {
    Path::new(upload_dir).join(directory.trim_start_matches('/'))
}

fn document_directory(metadata: Option<&str>) -> String {
    metadata
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
        .and_then(|value| {
            value
                .get("relative_directory")
                .and_then(|v| v.as_str())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| "/".into())
}

pub(crate) async fn save_document_directory(
    state: &AppState,
    id: &str,
    directory: &str,
) -> Result<(), AppError> {
    sqlx::query("UPDATE documents SET metadata = ? WHERE id = ?")
        .bind(serde_json::json!({"relative_directory": directory}).to_string())
        .bind(id)
        .execute(&state.db.pool)
        .await?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DocumentIndexEvent {
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
pub async fn list(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::debug!("▶ [list] 收到列出文件請求");
    let state = depot.obtain::<AppState>().unwrap();
    tracing::debug!("[list] 從 DB 查詢所有文件...");
    let directory = normalized_directory(req.query::<String>("directory").as_deref())?;
    let search = req
        .query::<String>("search")
        .unwrap_or_default()
        .to_lowercase();
    let docs = DocumentRepo::list_all(&state.db.pool)
        .await?
        .into_iter()
        .filter(|doc| document_directory(doc.metadata.as_deref()) == directory)
        .filter(|doc| search.is_empty() || doc.filename.to_lowercase().contains(&search))
        .collect::<Vec<_>>();
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
pub async fn preview(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let id = req
        .param::<String>("id")
        .ok_or(AppError::BadRequest("Missing document id".into()))?;
    let document = DocumentRepo::find_by_id(&state.db.pool, &id).await?;
    let chunks = ChunkRepo::find_by_document_id(&state.db.pool, &id).await?;
    let content = chunks
        .iter()
        .map(|chunk| chunk.content.as_str())
        .collect::<Vec<_>>()
        .join("\n\n");
    Ok(Json(serde_json::json!({
        "id": document.id,
        "filename": document.filename,
        "contentType": document.content_type,
        "previewType": "markdown",
        "content": content,
        "chunkCount": chunks.len()
    })))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn upload(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    tracing::debug!("▶ [upload] 收到文件上傳請求");
    let state = depot.obtain::<AppState>().unwrap();
    let directory = normalized_directory(req.query::<String>("directory").as_deref())?;
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
    let upload_path = directory_path(&state.config.upload_dir, &directory);
    let file_path = upload_path.join(&doc_id).to_string_lossy().into_owned();
    tracing::debug!("[upload] 生成 doc_id={}, 目標路徑={}", doc_id, file_path);

    tokio::fs::create_dir_all(&upload_path)
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
    save_document_directory(state, &doc_id, &directory).await?;
    tracing::debug!("[upload] DB 記錄寫入完成，準備啟動背景索引...");

    let state_clone = state.clone();
    let embedding_clone = embedding_service.clone();
    let doc_id_clone = doc_id.clone();
    let file_path_clone = file_path_with_ext.clone();
    let ext_clone = ext.clone();
    tracing::debug!(
        "[upload] source_extension={}, index_method=pageindex+chunker",
        ext
    );
    tokio::spawn(async move {
        if let Err(e) = index_document(
            &state_clone,
            embedding_clone,
            &doc_id_clone,
            &file_path_clone,
            &ext_clone,
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
        "index_method": "pageindex+chunker"
    });
    tracing::debug!("[upload] 回傳結果: {}", response);
    Ok(Json(response))
}

async fn run_document_upload_stream(
    ws: salvo::websocket::WebSocket,
    state: AppState,
    filename: String,
    content_type: String,
    directory: String,
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
    let upload_path = directory_path(&state.config.upload_dir, &directory);
    let file_path = upload_path
        .join(format!("{}.{}", doc_id, ext))
        .to_string_lossy()
        .into_owned();

    let result: Result<serde_json::Value, anyhow::Error> = async {
        tokio::fs::create_dir_all(&upload_path).await?;
        tokio::fs::write(&file_path, &file_bytes).await?;
        let file_size = i64::try_from(file_bytes.len()).unwrap_or(i64::MAX);
        let document =
            DocumentRepo::create(&state.db.pool, &doc_id, &filename, &content_type, file_size)
                .await?;
        save_document_directory(&state, &doc_id, &directory).await?;
        let _ = events.send(DocumentIndexEvent::progress(
            "uploaded",
            format!("文件已接收並建立記錄: {filename}"),
            Some(&doc_id),
            10,
        ));

        let embedding = EmbeddingService::new(&state.config.embedding_model);
        let pageindex =
            index_document(&state, embedding, &doc_id, &file_path, &ext, Some(&events)).await?;

        let indexed = DocumentRepo::find_by_id(&state.db.pool, &doc_id).await?;
        Ok(serde_json::json!({
            "document": indexed,
            "initialDocument": document,
            "indexMethod": "pageindex+chunker",
            "pageindex": pageindex
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
    let directory = normalized_directory(req.query::<String>("directory").as_deref())
        .map_err(|_| StatusError::bad_request())?;

    WebSocketUpgrade::new()
        .upgrade(req, res, move |ws| async move {
            run_document_upload_stream(ws, state, filename, content_type, directory).await;
        })
        .await
}

// ──────────────────────────────────────────────────────────────
// Core indexing pipeline dispatcher
// ──────────────────────────────────────────────────────────────
pub(crate) async fn index_document(
    state: &AppState,
    embedding: EmbeddingService,
    doc_id: &str,
    file_path: &str,
    source_extension: &str,
    progress: Option<&UnboundedSender<DocumentIndexEvent>>,
) -> Result<Option<serde_json::Value>, anyhow::Error> {
    index_document_configured(
        state,
        embedding,
        doc_id,
        file_path,
        source_extension,
        progress,
        true,
        true,
    )
    .await
}

pub(crate) async fn index_document_configured(
    state: &AppState,
    embedding: EmbeddingService,
    doc_id: &str,
    file_path: &str,
    source_extension: &str,
    progress: Option<&UnboundedSender<DocumentIndexEvent>>,
    pageindex_enabled: bool,
    rag_enabled: bool,
) -> Result<Option<serde_json::Value>, anyhow::Error> {
    tracing::debug!(
        "▶ [index_document] 開始索引流程 doc_id={}, file_path={}, source_extension={}",
        doc_id,
        file_path,
        source_extension
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

    let document = DocumentRepo::find_by_id(&state.db.pool, doc_id).await?;
    report(
        progress,
        DocumentIndexEvent::progress(
            "conversion",
            format!("開始將 .{source_extension} 轉換為 Markdown"),
            Some(doc_id),
            16,
        ),
    );
    let markdown_path = crate::ingestion::to_markdown::convert_to_markdown(
        file_path,
        source_extension,
        &document.filename,
    )
    .await?;
    report(
        progress,
        DocumentIndexEvent::progress(
            "conversion",
            "Markdown 轉換完成，開始 PageIndex",
            Some(doc_id),
            20,
        ),
    );

    let pageindex_result = if pageindex_enabled {
        run_pageindex_api(state, doc_id, &markdown_path, progress).await?
    } else {
        report(
            progress,
            DocumentIndexEvent::progress(
                "pageindex",
                "此版本已停用 PageIndex，略過頁面索引",
                Some(doc_id),
                35,
            ),
        );
        None
    };
    if rag_enabled {
        tracing::debug!("[index_document] → 對 Markdown 分派到 chunker 方法");
        index_with_chunker(state, &embedding, doc_id, &markdown_path, progress).await?;
    } else {
        report(
            progress,
            DocumentIndexEvent::progress("rag", "此版本已停用 RAG，略過向量索引", Some(doc_id), 85),
        );
        DocumentRepo::update_status(&state.db.pool, doc_id, "indexed").await?;
    }

    if let Some(pageindex) = &pageindex_result {
        let document = DocumentRepo::find_by_id(&state.db.pool, doc_id).await?;
        let mut metadata = document
            .metadata
            .as_deref()
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default();
        metadata.insert("pageindex".to_string(), pageindex.clone());
        metadata.insert(
            "source_format".to_string(),
            serde_json::Value::String(source_extension.to_ascii_lowercase()),
        );
        metadata.insert(
            "converted_to_markdown".to_string(),
            serde_json::Value::Bool(markdown_path != file_path),
        );
        sqlx::query("UPDATE documents SET metadata = ? WHERE id = ?")
            .bind(serde_json::Value::Object(metadata).to_string())
            .bind(doc_id)
            .execute(&state.db.pool)
            .await?;
    }

    Ok(pageindex_result)
}

async fn run_pageindex_api(
    state: &AppState,
    doc_id: &str,
    file_path: &str,
    progress: Option<&UnboundedSender<DocumentIndexEvent>>,
) -> Result<Option<serde_json::Value>, anyhow::Error> {
    use crate::rag::pageindex_client::PageIndexApiClient;
    use pageindex_core::Config;

    let extension = std::path::Path::new(file_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if extension != "pdf" && extension != "md" && extension != "markdown" {
        report(
            progress,
            DocumentIndexEvent::progress(
                "pageindex_skipped",
                format!("PageIndex API 不支援 .{extension}，繼續原索引"),
                Some(doc_id),
                20,
            ),
        );
        return Ok(None);
    }

    let api_key = state.config.pageindex_api_key.clone().unwrap_or_default();
    if extension == "pdf" && api_key.trim().is_empty() {
        return Err(anyhow::anyhow!(
            "PAGEINDEX_API_KEY or OPENAI_API_KEY is required for PDF PageIndex"
        ));
    }
    let model = state.config.pageindex_model.clone();
    let client = pageindex_core::llm::RetryingClient::with_defaults(PageIndexApiClient::new(
        api_key,
        state.config.pageindex_base_url.clone(),
        model.clone(),
    ));
    let config = Config::new()
        .with_env_overrides()
        .with_model(model)
        .with_node_text(false)
        .with_node_summary(false)
        .with_doc_description(false);

    report(
        progress,
        DocumentIndexEvent::progress(
            "pageindex",
            "開始呼叫 PageIndex API 建立階層索引",
            Some(doc_id),
            18,
        ),
    );

    let mut structure = if extension == "pdf" {
        pageindex_core::page_index(file_path, &client, &config).await?
    } else {
        pageindex_core::markdown::md_to_tree(file_path, &client, &config).await?
    };
    let document = DocumentRepo::find_by_id(&state.db.pool, doc_id).await?;
    structure.doc_name = document.filename;
    let result = serde_json::to_value(&structure)?;
    report(
        progress,
        DocumentIndexEvent::progress(
            "pageindex",
            format!(
                "PageIndex API 索引完成，共 {} 個節點",
                structure.node_count()
            ),
            Some(doc_id),
            25,
        ),
    );
    Ok(Some(result))
}

// ──────────────────────────────────────────────────────────────
// Markdown chunker indexing
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

    let document = DocumentRepo::find_by_id(&state.db.pool, doc_id).await?;
    let mut metadata_json = document
        .metadata
        .as_deref()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    metadata_json.insert("chunk_count".into(), serde_json::json!(chunk_count));
    metadata_json.insert("index_method".into(), serde_json::json!("chunker"));
    tracing::debug!(
        "[chunker] 寫入 metadata 到 documents 表: {:?}",
        metadata_json
    );
    sqlx::query("UPDATE documents SET metadata = ? WHERE id = ?")
        .bind(serde_json::Value::Object(metadata_json).to_string())
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

#[derive(Deserialize)]
struct CreateDirectoryRequest {
    parent: Option<String>,
    name: String,
}

#[derive(Deserialize)]
struct CopyDirectoryRequest {
    path: String,
    name: Option<String>,
}

fn valid_directory_name(name: &str) -> Result<&str, AppError> {
    let name = name.trim();
    if name.is_empty() || name == "." || name == ".." || name.contains('/') || name.contains('\\') {
        return Err(AppError::BadRequest(
            "Directory name must be a single path segment".into(),
        ));
    }
    Ok(name)
}

#[handler]
pub async fn list_directories(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let directory = normalized_directory(req.query::<String>("path").as_deref())?;
    let path = directory_path(&state.config.upload_dir, &directory);
    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut reader = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut entries = Vec::new();
    while let Some(entry) = reader
        .next_entry()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
    {
        if entry
            .file_type()
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .is_dir()
        {
            let name = entry.file_name().to_string_lossy().into_owned();
            let relative_path = if directory == "/" {
                format!("/{name}")
            } else {
                format!("{directory}/{name}")
            };
            entries.push(serde_json::json!({"name": name, "path": relative_path}));
        }
    }
    entries.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    Ok(Json(
        serde_json::json!({"path": directory, "directories": entries}),
    ))
}

#[handler]
pub async fn create_directory(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let body = req
        .parse_json::<CreateDirectoryRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    let parent = normalized_directory(body.parent.as_deref())?;
    let name = valid_directory_name(&body.name)?;
    let relative_path = if parent == "/" {
        format!("/{name}")
    } else {
        format!("{parent}/{name}")
    };
    let path = directory_path(&state.config.upload_dir, &relative_path);
    tokio::fs::create_dir(&path).await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::AlreadyExists {
            AppError::Conflict("Directory already exists".into())
        } else {
            AppError::Internal(e.to_string())
        }
    })?;
    Ok(Json(
        serde_json::json!({"created": true, "name": name, "path": relative_path}),
    ))
}

#[handler]
pub async fn copy_directory(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let body = req
        .parse_json::<CopyDirectoryRequest>()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    let source = normalized_directory(Some(&body.path))?;
    if source == "/" {
        return Err(AppError::BadRequest(
            "Root directory cannot be copied".into(),
        ));
    }
    let source_path = directory_path(&state.config.upload_dir, &source);
    let parent = Path::new(&source)
        .parent()
        .and_then(Path::to_str)
        .unwrap_or("/");
    let original = Path::new(&source)
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("directory");
    let suggested_name = format!("{original} - copy");
    let name = valid_directory_name(body.name.as_deref().unwrap_or(&suggested_name))?.to_owned();
    let target = if parent == "/" {
        format!("/{name}")
    } else {
        format!("{parent}/{name}")
    };
    let target_path = directory_path(&state.config.upload_dir, &target);
    if !source_path.is_dir() {
        return Err(AppError::NotFound("Directory not found".into()));
    }
    if target_path.exists() {
        return Err(AppError::Conflict("Target directory already exists".into()));
    }
    // Indexed files cannot safely be duplicated without creating new document/vector IDs.
    let has_content = std::fs::read_dir(&source_path)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .next()
        .is_some();
    if has_content {
        return Err(AppError::Conflict(
            "Only empty directories can be copied; copy documents separately".into(),
        ));
    }
    tokio::fs::create_dir(&target_path)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Json(serde_json::json!({"copied": true, "path": target})))
}

#[handler]
pub async fn delete_directory(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let directory = normalized_directory(req.query::<String>("path").as_deref())?;
    if directory == "/" {
        return Err(AppError::BadRequest(
            "Root directory cannot be deleted".into(),
        ));
    }
    let path = directory_path(&state.config.upload_dir, &directory);
    tokio::fs::remove_dir(&path)
        .await
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound("Directory not found".into()),
            std::io::ErrorKind::DirectoryNotEmpty => {
                AppError::Conflict("Directory is not empty".into())
            }
            _ => AppError::Internal(e.to_string()),
        })?;
    Ok(Json(
        serde_json::json!({"deleted": true, "path": directory}),
    ))
}

pub fn router() -> Router {
    Router::with_path("documents")
        .get(list)
        .push(Router::with_path("upload").post(upload))
        .push(Router::with_path("ws/upload").get(upload_stream))
        .push(
            Router::with_path("directories")
                .get(list_directories)
                .post(create_directory)
                .delete(delete_directory),
        )
        .push(Router::with_path("directories/copy").post(copy_directory))
        .push(Router::with_path("<id>/preview").get(preview))
        .push(Router::with_path("<id>").get(get).delete(delete))
}
