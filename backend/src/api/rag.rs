use salvo::prelude::*;
use salvo::http::StatusCode;
use crate::core::state::AppState;
use crate::rag::embeddings::EmbeddingService;
use crate::rag::reranker::RerankerService;
use crate::rag::llm::LLMService;

#[derive(Deserialize, Debug)]
pub struct RagQueryRequest {
    pub query: String,
    pub top_k: Option<u32>,
    pub use_hybrid: Option<bool>,
}

#[handler]
pub async fn query(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let query_req: RagQueryRequest = req.parse_json().await.map_err(|_| {
        StatusError::bad_request().with_detail("Invalid request body")
    })?;

    let embedding = EmbeddingService::new(&state.config.embedding_model);
    let reranker = RerankerService::new(&state.config.reranking_model);
    let llm = LLMService::new(
        state.config.openai_api_key.as_deref(),
        &state.config.openai_base_url,
    );

    let top_k = query_req.top_k.unwrap_or(5);

    // 1. Generate query embedding
    let query_embedding = embedding.embed(&query_req.query).await
        .map_err(|_| StatusError::internal_server_error())?;

    // 2. Search Qdrant
    let search_result = state.qdrant
        .search_points("documents", None, query_embedding, top_k as u64, None, true, None)
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    let mut chunks: Vec<serde_json::Value> = search_result.result.iter().map(|point| {
        let payload = &point.payload;
        serde_json::json!({
            "id": point.id,
            "content": payload.get("content").and_then(|v| v.as_str()).unwrap_or(""),
            "score": point.score,
            "document_id": payload.get("document_id").and_then(|v| v.as_str()).unwrap_or(""),
            "chunk_index": payload.get("chunk_index").and_then(|v| v.as_i64()).unwrap_or(0),
        })
    }).collect();

    // 3. Re-rank if we have results
    if !chunks.is_empty() {
        let texts: Vec<&str> = chunks.iter()
            .map(|c| c["content"].as_str().unwrap_or(""))
            .collect();

        if let Ok(reranked_scores) = reranker.rerank(&query_req.query, &texts).await {
            // Re-sort by reranker scores
            let mut scored: Vec<(usize, f64)> = reranked_scores.iter().enumerate().map(|(i, &s)| (i, s)).collect();
            scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

            let reranked: Vec<serde_json::Value> = scored.iter().map(|(idx, score)| {
                let mut item = chunks[*idx].clone();
                item["score"] = serde_json::Value::from(*score);
                item
            }).collect();
            chunks = reranked;
        }
    }

    // 4. Generate LLM answer
    let context: String = chunks.iter()
        .map(|c| c["content"].as_str().unwrap_or(""))
        .collect::<Vec<&str>>()
        .join("\n\n");

    let answer = llm.generate(&query_req.query, &context).await.ok();

    Ok(Json(serde_json::json!({
        "query": query_req.query,
        "chunks": chunks,
        "answer": answer,
    })))
}

pub fn router() -> Router {
    Router::with_path("rag")
        .push(Router::with_path("query").post(query))
}
