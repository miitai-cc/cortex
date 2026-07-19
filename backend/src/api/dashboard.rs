use crate::core::state::AppState;
use crate::errors::AppError;
use chrono::{Duration, Utc};
use eiva_be_security::jwt::{verify_token, Claims};
use salvo::prelude::*;
use sqlx::Row;
use std::collections::BTreeMap;
use std::time::Instant;

fn authentication(req: &Request, state: &AppState) -> Result<Claims, AppError> {
    let header = req
        .headers()
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".into()))?;
    let token = header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid Authorization header".into()))?;
    verify_token(token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired token".into()))
}

async fn count(state: &AppState, sql: &str) -> Result<i64, AppError> {
    Ok(sqlx::query(sql)
        .fetch_one(&state.db.pool)
        .await?
        .get::<i64, _>("count"))
}

#[handler]
async fn stats(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    authentication(req, state)?;
    let total_documents = count(state, "SELECT COUNT(*) AS count FROM documents").await?;
    let total_chunks = count(state, "SELECT COUNT(*) AS count FROM document_chunks").await?;
    let total_queries = count(state, "SELECT COUNT(*) AS count FROM rag_query_events").await?;
    let conversations = count(state, "SELECT COUNT(*) AS count FROM conversations").await?;
    let researches = count(state, "SELECT COUNT(*) AS count FROM researches").await?;
    let issues = count(state, "SELECT COUNT(*) AS count FROM issues").await?;
    let messages = count(
        state,
        "SELECT COUNT(*) AS count FROM collaboration_messages WHERE deleted_at IS NULL",
    )
    .await?;
    let documents = sqlx::query("SELECT filename,status FROM documents")
        .fetch_all(&state.db.pool)
        .await?;
    let mut types = BTreeMap::<String, i64>::new();
    let mut statuses = BTreeMap::<String, i64>::new();
    for document in documents {
        let filename = document.get::<String, _>("filename");
        let extension = std::path::Path::new(&filename)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("other")
            .to_lowercase();
        *types.entry(extension).or_default() += 1;
        *statuses
            .entry(document.get::<String, _>("status"))
            .or_default() += 1;
    }
    let document_types = types
        .into_iter()
        .map(|(name, value)| serde_json::json!({"name":name,"value":value}))
        .collect::<Vec<_>>();
    let document_statuses = statuses
        .into_iter()
        .map(|(name, value)| serde_json::json!({"name":name,"value":value}))
        .collect::<Vec<_>>();
    Ok(Json(serde_json::json!({
        "totalDocuments":total_documents,"totalChunks":total_chunks,"totalQueries":total_queries,
        "conversations":conversations,"researches":researches,"issues":issues,"messages":messages,
        "documentTypes":document_types,"documentStatuses":document_statuses
    })))
}

#[handler]
async fn query_trend(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    authentication(req, state)?;
    let rows = sqlx::query(
        "SELECT CAST(created_at AS TEXT) AS created_at FROM rag_query_events ORDER BY created_at",
    )
    .fetch_all(&state.db.pool)
    .await?;
    let mut counts = BTreeMap::<String, i64>::new();
    for row in rows {
        if let Ok(timestamp) = row.try_get::<String, _>("created_at") {
            if timestamp.len() >= 10 {
                *counts.entry(timestamp[..10].to_string()).or_default() += 1;
            }
        }
    }
    let today = Utc::now().date_naive();
    let trend = (0..7)
        .rev()
        .map(|offset| {
            let date = today - Duration::days(offset);
            let key = date.format("%Y-%m-%d").to_string();
            serde_json::json!({
                "date":key,"day":date.format("%m/%d").to_string(),
                "queries":counts.get(&key).copied().unwrap_or(0)
            })
        })
        .collect::<Vec<_>>();
    Ok(Json(serde_json::json!({"trend":trend})))
}

fn activity(
    id: String,
    kind: &str,
    action: &str,
    target: String,
    actor: Option<String>,
    timestamp: Option<String>,
    path: &str,
) -> serde_json::Value {
    serde_json::json!({
        "id":format!("{kind}:{id}"),"kind":kind,"action":action,"target":target,
        "actor":actor,"timestamp":timestamp,"path":path
    })
}

#[handler]
async fn recent_activity(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    authentication(req, state)?;
    let mut activities = Vec::new();
    for row in sqlx::query("SELECT id,filename,CAST(created_at AS TEXT) AS created_at FROM documents ORDER BY created_at DESC LIMIT 30").fetch_all(&state.db.pool).await? {
        activities.push(activity(row.get("id"),"document","上傳文件",row.get("filename"),None,row.try_get("created_at").ok(),"/cortex/documents/list"));
    }
    for row in sqlx::query("SELECT id,title,CAST(updated_at AS TEXT) AS updated_at FROM content_items ORDER BY updated_at DESC LIMIT 30").fetch_all(&state.db.pool).await? {
        activities.push(activity(row.get("id"),"content","維護內容",row.get("title"),None,row.try_get("updated_at").ok(),"/cortex/documents/content"));
    }
    for row in sqlx::query("SELECT id,issue_key,title,reporter_id,CAST(updated_at AS TEXT) AS updated_at FROM issues ORDER BY updated_at DESC LIMIT 30").fetch_all(&state.db.pool).await? {
        activities.push(activity(row.get("id"),"issue","更新 Issue",format!("{} · {}",row.get::<String,_>("issue_key"),row.get::<String,_>("title")),row.try_get("reporter_id").ok(),row.try_get("updated_at").ok(),"/cortex/collaboration/issues"));
    }
    for row in sqlx::query("SELECT id,username,content,CAST(created_at AS TEXT) AS created_at FROM collaboration_messages WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 30").fetch_all(&state.db.pool).await? {
        let content=row.get::<String,_>("content");
        let target=if content.chars().count()>80 { format!("{}…",content.chars().take(80).collect::<String>()) } else { content };
        activities.push(activity(row.get("id"),"message","發送團隊訊息",target,row.try_get("username").ok(),row.try_get("created_at").ok(),"/cortex/collaboration/channels"));
    }
    for row in sqlx::query("SELECT id,query_text,CAST(created_at AS TEXT) AS created_at FROM rag_query_events ORDER BY created_at DESC LIMIT 30").fetch_all(&state.db.pool).await? {
        activities.push(activity(row.get("id"),"query","執行文件檢索",row.get("query_text"),None,row.try_get("created_at").ok(),"/cortex"));
    }
    for row in sqlx::query("SELECT id,topic,CAST(created_at AS TEXT) AS created_at FROM researches ORDER BY created_at DESC LIMIT 30").fetch_all(&state.db.pool).await? {
        activities.push(activity(row.get("id"),"research","建立深層研究",row.get("topic"),None,row.try_get("created_at").ok(),"/cortex/graph/research/history"));
    }
    for row in sqlx::query("SELECT id,title,CAST(updated_at AS TEXT) AS updated_at FROM conversations ORDER BY updated_at DESC LIMIT 30").fetch_all(&state.db.pool).await? {
        activities.push(activity(row.get("id"),"conversation","更新智慧對話",row.get("title"),None,row.try_get("updated_at").ok(),"/cortex/chat/history"));
    }
    activities.sort_by(|left, right| {
        right["timestamp"]
            .as_str()
            .unwrap_or("")
            .cmp(left["timestamp"].as_str().unwrap_or(""))
    });
    activities.truncate(100);
    Ok(Json(serde_json::json!({"activities":activities})))
}

#[handler]
async fn operational_health(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    authentication(req, state)?;
    let db_started = Instant::now();
    let database_ok = sqlx::query("SELECT 1")
        .execute(&state.db.pool)
        .await
        .is_ok();
    let database_latency = i64::try_from(db_started.elapsed().as_millis()).unwrap_or(i64::MAX);
    let qdrant_started = Instant::now();
    let qdrant_ok = state.qdrant.health_check().await.is_ok();
    let qdrant_latency = i64::try_from(qdrant_started.elapsed().as_millis()).unwrap_or(i64::MAX);
    let queue_rows = sqlx::query("SELECT id,filename,status,CAST(updated_at AS TEXT) AS updated_at FROM documents WHERE status IN ('pending','processing') ORDER BY updated_at")
        .fetch_all(&state.db.pool).await?;
    let queue = queue_rows.into_iter().map(|row|serde_json::json!({
        "id":row.get::<String,_>("id"),"type":"文件索引","target":row.get::<String,_>("filename"),
        "status":row.get::<String,_>("status"),"updatedAt":row.try_get::<String,_>("updated_at").ok()
    })).collect::<Vec<_>>();
    let failed_rows = sqlx::query("SELECT id,filename,CAST(updated_at AS TEXT) AS updated_at FROM documents WHERE status='failed' ORDER BY updated_at DESC LIMIT 20")
        .fetch_all(&state.db.pool).await?;
    let alerts=failed_rows.into_iter().map(|row|serde_json::json!({
        "id":row.get::<String,_>("id"),"level":"error","message":format!("文件索引失敗：{}",row.get::<String,_>("filename")),
        "timestamp":row.try_get::<String,_>("updated_at").ok(),"resolved":false
    })).collect::<Vec<_>>();
    let query_rows=sqlx::query("SELECT duration_ms,result_count,CAST(created_at AS TEXT) AS created_at FROM rag_query_events ORDER BY created_at DESC LIMIT 50")
        .fetch_all(&state.db.pool).await?;
    let query_samples=query_rows.iter().map(|row|serde_json::json!({
        "durationMs":row.get::<i64,_>("duration_ms"),"resultCount":row.get::<i64,_>("result_count"),
        "timestamp":row.try_get::<String,_>("created_at").ok()
    })).collect::<Vec<_>>();
    let average_query_latency = if query_rows.is_empty() {
        0
    } else {
        query_rows
            .iter()
            .map(|row| row.get::<i64, _>("duration_ms"))
            .sum::<i64>()
            / i64::try_from(query_rows.len()).unwrap_or(1)
    };
    let failed_documents = count(
        state,
        "SELECT COUNT(*) AS count FROM documents WHERE status='failed'",
    )
    .await?;
    let pending_documents = count(
        state,
        "SELECT COUNT(*) AS count FROM documents WHERE status IN ('pending','processing')",
    )
    .await?;
    let services = vec![
        serde_json::json!({"id":"api","name":"API 服務","status":"healthy","latencyMs":0,"details":"Cortex REST + WebSocket v0.85"}),
        serde_json::json!({"id":"database","name":"關聯資料庫","status":if database_ok{"healthy"}else{"error"},"latencyMs":database_latency,"details":state.config.db_type.as_str()}),
        serde_json::json!({"id":"qdrant","name":"向量資料庫","status":if qdrant_ok{"healthy"}else{"error"},"latencyMs":qdrant_latency,"details":state.config.qdrant_url}),
        serde_json::json!({"id":"documents","name":"文件索引流程","status":if failed_documents>0{"warning"}else{"healthy"},"latencyMs":serde_json::Value::Null,"details":format!("{} 筆處理中，{} 筆失敗",pending_documents,failed_documents)}),
        serde_json::json!({"id":"embedding","name":"Embedding 模型","status":"configured","latencyMs":serde_json::Value::Null,"details":state.config.embedding_model}),
        serde_json::json!({"id":"llm","name":"LLM 服務","status":if state.config.openai_api_key.is_some(){"configured"}else{"unconfigured"},"latencyMs":serde_json::Value::Null,"details":state.config.openai_base_url}),
    ];
    Ok(Json(serde_json::json!({
        "status":if database_ok&&qdrant_ok{"healthy"}else{"degraded"},"timestamp":Utc::now().to_rfc3339(),
        "database":database_ok,"qdrant":qdrant_ok,"services":services,"queue":queue,"alerts":alerts,
        "metrics":{"pendingDocuments":pending_documents,"failedDocuments":failed_documents,
            "completedQueries":query_rows.len(),"averageQueryLatencyMs":average_query_latency},
        "querySamples":query_samples
    })))
}

pub fn router() -> Router {
    Router::with_path("dashboard")
        .push(Router::with_path("stats").get(stats))
        .push(Router::with_path("query-trend").get(query_trend))
        .push(Router::with_path("activity").get(recent_activity))
        .push(Router::with_path("health").get(operational_health))
}
