#![allow(dead_code)]
use crate::core::state::AppState;
use crate::db::repository::document_repo::DocumentRepo;
use crate::rag::embeddings::EmbeddingService;
use crate::rag::llm::LLMService;
use crate::rag::reranker::RerankerService;
use qdrant_client::qdrant::point_id::PointIdOptions;
use qdrant_client::qdrant::SearchPointsBuilder;
use qdrant_client::Payload;
use salvo::prelude::*;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashSet;
use std::time::Instant;

#[derive(Deserialize, Debug)]
pub struct RagQueryRequest {
    pub query: String,
    pub top_k: Option<u32>,
    pub use_hybrid: Option<bool>,
    pub document_ids: Option<Vec<String>>,
}

#[derive(Deserialize, Debug)]
pub struct EmbedRequest {
    pub text: String,
}

#[derive(Serialize, Debug)]
pub struct EmbedResponse {
    pub model: String,
    pub dimension: usize,
    pub preview: Vec<f32>,
    pub embedding: Vec<f32>,
}

#[derive(Deserialize, Debug)]
pub struct RerankRequest {
    pub query: String,
    pub documents: Vec<String>,
}

#[derive(Serialize, Debug)]
pub struct RerankResultItem {
    pub index: usize,
    pub document: String,
    pub relevance_score: f64,
}

#[derive(Serialize, Debug)]
pub struct RerankResponse {
    pub model: String,
    pub query: String,
    pub results: Vec<RerankResultItem>,
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn query(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let query_req: RagQueryRequest = req
        .parse_json()
        .await
        .map_err(|_| StatusError::bad_request().detail("Invalid request body"))?;
    let query_started = Instant::now();

    tracing::debug!("Received RAG query: {:?}", query_req.query);

    let embedding = EmbeddingService::new(&state.config.embedding_model);
    let reranker = RerankerService::new(&state.config.reranking_model);
    let llm = LLMService::new(
        state.config.openai_api_key.as_deref(),
        &state.config.openai_base_url,
    );

    let top_k = query_req.top_k.unwrap_or(5);
    let requested_document_ids = query_req.document_ids.clone().unwrap_or_default();
    let version_rows = sqlx::query("SELECT v.document_id, i.current_version, v.version_number FROM content_versions v JOIN content_items i ON i.id = v.content_id")
        .fetch_all(&state.db.pool).await.map_err(|_| StatusError::internal_server_error())?;
    let stale_document_ids = version_rows
        .into_iter()
        .filter(|row| row.get::<i64, _>("version_number") != row.get::<i64, _>("current_version"))
        .map(|row| row.get::<String, _>("document_id"))
        .collect::<HashSet<_>>();
    let search_limit = if requested_document_ids.is_empty() {
        top_k
    } else {
        (top_k * 10).max(50)
    };

    // 1. Generate query embedding
    tracing::debug!("Generating embedding for query...");
    let query_embedding = embedding
        .embed(&query_req.query)
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    // 2. Search Qdrant
    tracing::debug!("Searching Qdrant for top {} results...", top_k);
    let search_result = state
        .qdrant
        .search_points(
            SearchPointsBuilder::new("documents", query_embedding, search_limit as u64)
                .with_payload(true),
        )
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    tracing::debug!(
        "Found {} initial results from Qdrant",
        search_result.result.len()
    );

    let mut chunks: Vec<serde_json::Value> = search_result.result.iter().map(|point| {
        let payload: Payload = point.payload.clone().into();
        let payload_json: serde_json::Value = payload.into();
        let id_str = point.id.as_ref().map(|pid| match &pid.point_id_options {
            Some(PointIdOptions::Num(n)) => n.to_string(),
            Some(PointIdOptions::Uuid(u)) => u.clone(),
            None => String::new(),
        }).unwrap_or_default();
        serde_json::json!({
            "id": id_str,
            "content": payload_json.get("content").and_then(|v| v.as_str()).unwrap_or(""),
            "score": point.score,
            "document_id": payload_json.get("document_id").and_then(|v| v.as_str()).unwrap_or(""),
            "chunk_index": payload_json.get("chunk_index").and_then(|v| v.as_i64()).unwrap_or(0),
        })
    }).filter(|chunk| {
        let document_id = chunk["document_id"].as_str().unwrap_or("");
        if requested_document_ids.is_empty() { !stale_document_ids.contains(document_id) }
        else { requested_document_ids.iter().any(|id| id == document_id) }
    })
      .take(top_k as usize)
      .collect();

    let documents = DocumentRepo::list_all(&state.db.pool)
        .await
        .map_err(|_| StatusError::internal_server_error())?;
    for chunk in &mut chunks {
        let document_id = chunk["document_id"].as_str().unwrap_or("");
        if let Some(document) = documents.iter().find(|document| document.id == document_id) {
            let directory = document
                .metadata
                .as_deref()
                .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
                .and_then(|metadata| {
                    metadata
                        .get("relative_directory")
                        .and_then(|value| value.as_str())
                        .map(str::to_owned)
                })
                .unwrap_or_else(|| "/".to_string());
            chunk["filename"] = serde_json::json!(document.filename);
            chunk["directory"] = serde_json::json!(directory);
            chunk["content_type"] = serde_json::json!(document.content_type);
        }
    }

    // 3. Re-rank if we have results
    if !chunks.is_empty() {
        let texts: Vec<&str> = chunks
            .iter()
            .map(|c| c["content"].as_str().unwrap_or(""))
            .collect();

        if let Ok(reranked_scores) = reranker.rerank(&query_req.query, &texts).await {
            // Re-sort by reranker scores
            let mut scored: Vec<(usize, f64)> = reranked_scores
                .iter()
                .enumerate()
                .map(|(i, &s)| (i, s))
                .collect();
            scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

            let reranked: Vec<serde_json::Value> = scored
                .iter()
                .map(|(idx, score)| {
                    let mut item = chunks[*idx].clone();
                    item["score"] = serde_json::Value::from(*score);
                    item
                })
                .collect();
            chunks = reranked;
        }
    }

    // 4. Generate LLM answer
    let context: String = chunks
        .iter()
        .map(|c| c["content"].as_str().unwrap_or(""))
        .collect::<Vec<&str>>()
        .join("\n\n");

    let answer = llm.generate(&query_req.query, &context).await.ok();

    let _ = sqlx::query(
        "INSERT INTO rag_query_events (id,query_text,duration_ms,result_count,created_at) \
         VALUES (?,?,?,?,CURRENT_TIMESTAMP)",
    )
    .bind(cortex_lib::utils::generate_id())
    .bind(&query_req.query)
    .bind(i64::try_from(query_started.elapsed().as_millis()).unwrap_or(i64::MAX))
    .bind(i64::try_from(chunks.len()).unwrap_or(i64::MAX))
    .execute(&state.db.pool)
    .await;

    Ok(Json(serde_json::json!({
        "query": query_req.query,
        "chunks": chunks,
        "answer": answer,
    })))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn embed(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<EmbedResponse>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let embed_req: EmbedRequest = req
        .parse_json()
        .await
        .map_err(|_| StatusError::bad_request().detail("Invalid request body"))?;

    let embedding_service = EmbeddingService::new(&state.config.embedding_model);

    tracing::debug!("Embed request for text (len={})", embed_req.text.len());

    let embedding = embedding_service
        .embed(&embed_req.text)
        .await
        .map_err(|e| {
            tracing::warn!("Embedding failed: {:?}", e);
            StatusError::internal_server_error().detail("Embedding model call failed")
        })?;

    let dimension = embedding.len();
    let preview = embedding.iter().take(20).cloned().collect();

    Ok(Json(EmbedResponse {
        model: state.config.embedding_model.clone(),
        dimension,
        preview,
        embedding,
    }))
}

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn rerank_docs(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<RerankResponse>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let rerank_req: RerankRequest = req
        .parse_json()
        .await
        .map_err(|_| StatusError::bad_request().detail("Invalid request body"))?;

    if rerank_req.documents.is_empty() {
        return Err(StatusError::bad_request().detail("documents must not be empty"));
    }

    let reranker = RerankerService::new(&state.config.reranking_model);

    tracing::debug!(
        "Rerank request: query='{}', {} documents",
        rerank_req.query,
        rerank_req.documents.len()
    );

    let texts: Vec<&str> = rerank_req.documents.iter().map(|s| s.as_str()).collect();
    let scores = reranker
        .rerank(&rerank_req.query, &texts)
        .await
        .map_err(|e| {
            tracing::warn!("Reranking failed: {:?}", e);
            StatusError::internal_server_error().detail("Reranking model call failed")
        })?;

    let mut results: Vec<RerankResultItem> = scores
        .iter()
        .enumerate()
        .map(|(i, &score)| RerankResultItem {
            index: i,
            document: rerank_req.documents[i].clone(),
            relevance_score: score,
        })
        .collect();

    // Sort by relevance_score descending
    results.sort_by(|a, b| {
        b.relevance_score
            .partial_cmp(&a.relevance_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(Json(RerankResponse {
        model: state.config.reranking_model.clone(),
        query: rerank_req.query,
        results,
    }))
}

pub fn router() -> Router {
    Router::with_path("rag")
        .push(Router::with_path("query").post(query))
        .push(Router::with_path("embed").post(embed))
        .push(Router::with_path("rerank").post(rerank_docs))
}
