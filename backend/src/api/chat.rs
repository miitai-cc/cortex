use crate::core::state::AppState;
use crate::rag::embeddings::EmbeddingService;
use crate::rag::llm::LLMService;
use futures_util::StreamExt;
use qdrant_client::qdrant::point_id::PointIdOptions;
use qdrant_client::qdrant::SearchPointsBuilder;
use qdrant_client::Payload;
use salvo::prelude::*;
use salvo::sse::{self, SseEvent};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ChatRequest {
    pub conversation_id: Option<String>,
    pub message: String,
    pub history: Option<Vec<ChatMessage>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub conversation_id: String,
    pub answer: String,
    pub references: Vec<serde_json::Value>,
}

async fn build_context_and_messages(
    state: &AppState,
    message: &str,
    history: &Option<Vec<ChatMessage>>,
) -> Result<(Vec<serde_json::Value>, Vec<serde_json::Value>), StatusError> {
    let embedding = EmbeddingService::new(&state.config.embedding_model);

    let query_embedding = embedding
        .embed(message)
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    let search_result = state
        .qdrant
        .search_points(
            SearchPointsBuilder::new("documents", query_embedding, 5u64).with_payload(true),
        )
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    let references: Vec<serde_json::Value> = search_result.result.iter().map(|point| {
        let payload: Payload = point.payload.clone().into();
        let payload_json: serde_json::Value = payload.into();
        serde_json::json!({
            "id": point.id.as_ref().map(|pid| match &pid.point_id_options {
                Some(PointIdOptions::Num(n)) => n.to_string(),
                Some(PointIdOptions::Uuid(u)) => u.clone(),
                None => String::new(),
            }).unwrap_or_default(),
            "content": payload_json.get("content").and_then(|v| v.as_str()).unwrap_or(""),
            "score": point.score,
            "document_id": payload_json.get("document_id").and_then(|v| v.as_str()).unwrap_or(""),
        })
    }).collect();

    let context: String = references
        .iter()
        .map(|r| r["content"].as_str().unwrap_or(""))
        .collect::<Vec<&str>>()
        .join("\n\n");

    let mut messages = Vec::new();
    messages.push(serde_json::json!({
        "role": "system",
        "content": "你是一個專業的知識庫助手。請根據提供的參考資料回答用戶問題。引用來源時請使用 [1], [2] 等標記。如果資料不足，請明確告知。請使用繁體中文回答。"
    }));

    if let Some(history) = history {
        for msg in history.iter().rev().take(10) {
            messages.push(serde_json::json!({
                "role": msg.role,
                "content": msg.content
            }));
        }
    }

    messages.push(serde_json::json!({
        "role": "user",
        "content": format!("參考資料：\n{}\n\n問題：{}", context, message)
    }));

    Ok((messages, references))
}

#[handler]
pub async fn chat(depot: &mut Depot, req: &mut Request) -> Result<Json<ChatResponse>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let chat_req: ChatRequest = req
        .parse_json()
        .await
        .map_err(|_| StatusError::bad_request().detail("Invalid request body"))?;

    let conversation_id = chat_req
        .conversation_id
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let (messages, references) =
        build_context_and_messages(&state, &chat_req.message, &chat_req.history).await?;

    let llm = LLMService::new(
        state.config.openai_api_key.as_deref(),
        &state.config.openai_base_url,
    );

    let answer = llm
        .generate_with_messages(&messages)
        .await
        .unwrap_or_else(|_| "抱歉，無法生成回答。".to_string());

    sqlx::query(
        "INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
    )
    .bind(&conversation_id)
    .bind(&chat_req.message.chars().take(50).collect::<String>())
    .execute(&state.db.pool)
    .await
    .ok();

    Ok(Json(ChatResponse {
        conversation_id,
        answer,
        references,
    }))
}

#[handler]
pub async fn chat_stream(
    depot: &mut Depot,
    req: &mut Request,
    res: &mut Response,
) -> Result<(), StatusError> {
    let state = depot.obtain::<AppState>().unwrap().clone();
    let chat_req: ChatRequest = req
        .parse_json()
        .await
        .map_err(|_| StatusError::bad_request().detail("Invalid request body"))?;

    let conversation_id = chat_req
        .conversation_id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let (messages, references) =
        build_context_and_messages(&state, &chat_req.message, &chat_req.history).await?;

    let (tx, rx) = mpsc::channel::<SseEvent>(64);

    // Send meta event
    let meta = SseEvent::default()
        .name("meta")
        .json(serde_json::json!({
            "conversation_id": conversation_id
        }))
        .unwrap_or_default();
    let _ = tx.send(meta).await;

    // Send references event
    let ref_event = SseEvent::default()
        .name("references")
        .json(serde_json::json!({
            "references": references
        }))
        .unwrap_or_default();
    let _ = tx.send(ref_event).await;

    let tx_clone = tx.clone();
    tokio::spawn(async move {
        let llm = LLMService::new(
            state.config.openai_api_key.as_deref(),
            &state.config.openai_base_url,
        );

        match llm
            .generate_streaming_sse(&messages, tx_clone.clone())
            .await
        {
            Ok(()) => {
                let done = SseEvent::default()
                    .name("done")
                    .json(serde_json::json!({}))
                    .unwrap_or_default();
                let _ = tx_clone.send(done).await;
            }
            Err(e) => {
                let err = SseEvent::default()
                    .name("error")
                    .json(serde_json::json!({
                        "message": format!("{}", e)
                    }))
                    .unwrap_or_default();
                let _ = tx_clone.send(err).await;
            }
        }
    });

    sqlx::query(
        "INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
    )
    .bind(&conversation_id)
    .bind(&chat_req.message.chars().take(50).collect::<String>())
    .execute(&state.db.pool)
    .await
    .ok();

    let event_stream = ReceiverStream::new(rx).map(|event| Ok::<_, Infallible>(event));
    sse::stream(res, event_stream);
    Ok(())
}

#[handler]
pub async fn list_conversations(
    depot: &mut Depot,
) -> Result<Json<Vec<serde_json::Value>>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();

    let rows = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 50"
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    let conversations: Vec<serde_json::Value> = rows
        .iter()
        .map(|(id, title, created_at, updated_at)| {
            serde_json::json!({
                "id": id,
                "title": title,
                "created_at": created_at,
                "updated_at": updated_at,
            })
        })
        .collect();

    Ok(Json(conversations))
}

#[handler]
pub async fn delete_conversation(depot: &mut Depot, req: &mut Request) -> Result<(), StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let id = req.param::<String>("id").unwrap_or_default();

    sqlx::query("DELETE FROM conversations WHERE id = ?")
        .bind(&id)
        .execute(&state.db.pool)
        .await
        .map_err(|_| StatusError::internal_server_error())?;

    Ok(())
}

pub fn router() -> Router {
    Router::with_path("chat")
        .push(Router::with_path("conversations").get(list_conversations))
        .push(Router::with_path("conversations/{id}").delete(delete_conversation))
        .push(Router::with_path("send").post(chat))
        .push(Router::with_path("send_stream").post(chat_stream))
}
