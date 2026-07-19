use crate::core::state::AppState;
use salvo::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ResearchRequest {
    pub topic: String,
    pub queries: Vec<String>,
}

#[derive(Serialize)]
pub struct ResearchResult {
    pub topic: String,
    pub synthesis: String,
    pub sources: Vec<String>,
    pub status: String,
}

fn url_encode(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => "+".to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

#[handler]
pub async fn start_research(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<ResearchResult>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let research_req: ResearchRequest = req
        .parse_json()
        .await
        .map_err(|_| StatusError::bad_request().detail("Invalid request body"))?;

    let mut sources = Vec::new();

    for query in &research_req.queries {
        let encoded = url_encode(query);
        let search_url = format!(
            "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
            encoded
        );

        match reqwest::get(&search_url).await {
            Ok(resp) => {
                if let Ok(text) = resp.text().await {
                    sources.push(format!(
                        "Query '{}': {}",
                        query,
                        &text[..text.len().min(500)]
                    ));
                }
            }
            Err(e) => {
                sources.push(format!("Query '{}' failed: {}", query, e));
            }
        }
    }

    let synthesis = format!(
        "# {} 研究報告\n\n## 研究摘要\n\n已針對「{}」進行研究，共 {} 個查詢。\n\n## 來源\n\n{}",
        research_req.topic,
        research_req.topic,
        research_req.queries.len(),
        sources.join("\n\n")
    );

    sqlx::query(
        "INSERT INTO researches (id, topic, synthesis, created_at) VALUES (?, ?, ?, datetime('now'))"
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&research_req.topic)
    .bind(&synthesis)
    .execute(&state.db.pool)
    .await
    .ok();

    Ok(Json(ResearchResult {
        topic: research_req.topic,
        synthesis,
        sources,
        status: "completed".to_string(),
    }))
}

#[handler]
pub async fn list_researches(
    depot: &mut Depot,
) -> Result<Json<Vec<serde_json::Value>>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();

    let rows = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, topic, CAST(created_at AS TEXT) AS created_at FROM researches ORDER BY created_at DESC LIMIT 20",
    )
    .fetch_all(&state.db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    let researches: Vec<serde_json::Value> = rows
        .iter()
        .map(|(id, topic, created_at)| {
            serde_json::json!({
                "id": id,
                "topic": topic,
                "created_at": created_at,
            })
        })
        .collect();

    Ok(Json(researches))
}

pub fn router() -> Router {
    Router::with_path("research")
        .push(Router::with_path("start").post(start_research))
        .push(Router::with_path("list").get(list_researches))
}
