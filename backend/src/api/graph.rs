use std::collections::{HashMap, HashSet};
use salvo::prelude::*;
use serde::Serialize;
use qdrant_client::qdrant::point_id::PointIdOptions;
use crate::core::state::AppState;
use crate::rag::embeddings::EmbeddingService;
use qdrant_client::qdrant::SearchPointsBuilder;

#[derive(Serialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub r#type: String,
    pub size: f64,
    pub link_count: u32,
    pub community: u32,
    pub filename: String,
}

#[derive(Serialize, Clone)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub weight: f64,
    pub label: String,
    pub signal_type: String,
}

#[derive(Serialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[handler]
pub async fn get_graph(depot: &mut Depot) -> Result<Json<GraphData>, StatusError> {
    let state = depot.obtain::<AppState>().unwrap();
    let db = &state.db;

    let doc_rows = sqlx::query_as::<_, (String, String, String, i64)>(
        "SELECT d.id, d.filename, d.content_type, CAST(COUNT(dc.id) AS INTEGER) as cnt
         FROM documents d
         LEFT JOIN document_chunks dc ON dc.document_id = d.id
         GROUP BY d.id, d.filename, d.content_type
         ORDER BY d.filename"
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    let chunk_rows = sqlx::query_as::<_, (String, String, String)>(
        "SELECT dc.id, dc.document_id, dc.content
         FROM document_chunks dc
         ORDER BY dc.document_id"
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|_| StatusError::internal_server_error())?;

    let mut doc_chunks: HashMap<String, Vec<(String, String)>> = HashMap::new();
    for (chunk_id, doc_id, content) in &chunk_rows {
        doc_chunks.entry(doc_id.clone()).or_default().push((chunk_id.clone(), content.clone()));
    }

    let mut nodes: Vec<GraphNode> = doc_rows.iter().map(|(id, filename, content_type, cnt)| {
        GraphNode {
            id: id.clone(),
            label: filename.clone(),
            r#type: content_type.clone(),
            size: ((*cnt as f64).sqrt() * 3.0 + 5.0).min(30.0),
            link_count: *cnt as u32,
            community: 0,
            filename: filename.clone(),
        }
    }).collect();

    let embedding = EmbeddingService::new(&state.config.embedding_model);
    let mut edges_map: HashMap<(String, String), (f64, Vec<String>)> = HashMap::new();

    for i in 0..nodes.len() {
        for j in (i + 1)..nodes.len() {
            if nodes[i].r#type == nodes[j].r#type {
                let key = if nodes[i].id < nodes[j].id {
                    (nodes[i].id.clone(), nodes[j].id.clone())
                } else {
                    (nodes[j].id.clone(), nodes[i].id.clone())
                };
                let entry = edges_map.entry(key).or_insert((0.0, Vec::new()));
                entry.0 += 1.0;
                entry.1.push("type_affinity".to_string());
            }
            if nodes[i].label.chars().next() == nodes[j].label.chars().next() {
                let key = if nodes[i].id < nodes[j].id {
                    (nodes[i].id.clone(), nodes[j].id.clone())
                } else {
                    (nodes[j].id.clone(), nodes[i].id.clone())
                };
                let entry = edges_map.entry(key).or_insert((0.0, Vec::new()));
                entry.0 += 0.3;
                entry.1.push("name_similar".to_string());
            }
        }
    }

    let sample_docs: Vec<&GraphNode> = nodes.iter().take(10).collect();
    for doc_a in &sample_docs {
        if let Some(chunks) = doc_chunks.get(&doc_a.id) {
            for (chunk_id, chunk_content) in chunks.iter().take(3) {
                let emb = match embedding.embed(chunk_content).await {
                    Ok(e) => e,
                    Err(_) => continue,
                };
                let search = match state.qdrant
                    .search_points(SearchPointsBuilder::new("documents", emb, 3u64).with_payload(true))
                    .await
                {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                for result in &search.result {
                    let pid = match &result.id {
                        Some(pid) => pid,
                        None => continue,
                    };
                    let found_id = match &pid.point_id_options {
                        Some(PointIdOptions::Num(n)) => n.to_string(),
                        Some(PointIdOptions::Uuid(u)) => u.clone(),
                        None => String::new(),
                    };
                    if found_id == *chunk_id { continue; }
                    let doc_b_id = match chunk_rows.iter().find(|r| r.0 == found_id) {
                        Some(row) => &row.1,
                        None => continue,
                    };
                    if doc_b_id == &doc_a.id { continue; }
                    if result.score <= 0.5 { continue; }
                    let key = if doc_a.id < *doc_b_id {
                        (doc_a.id.clone(), doc_b_id.clone())
                    } else {
                        (doc_b_id.clone(), doc_a.id.clone())
                    };
                    let entry = edges_map.entry(key).or_insert((0.0, Vec::new()));
                    entry.0 += (result.score as f64) * 2.0;
                    entry.1.push("semantic_similar".to_string());
                }
            }
        }
    }

    let mut edges: Vec<GraphEdge> = edges_map.into_iter()
        .filter(|(_, (weight, _))| *weight > 0.2)
        .map(|((source, target), (weight, signals))| {
            let label = signals.join(", ");
            let signal_type = signals.first().cloned().unwrap_or_default();
            GraphEdge { source, target, weight, label, signal_type }
        })
        .collect();

    edges.sort_by(|a, b| b.weight.partial_cmp(&a.weight).unwrap_or(std::cmp::Ordering::Equal));
    edges.truncate(nodes.len() * 3);

    let mut adj: HashMap<String, HashSet<String>> = HashMap::new();
    for n in &nodes { adj.entry(n.id.clone()).or_default(); }
    for e in &edges {
        adj.entry(e.source.clone()).or_default().insert(e.target.clone());
        adj.entry(e.target.clone()).or_default().insert(e.source.clone());
    }

    let mut visited = HashSet::new();
    let mut community_id = 1u32;
    let node_ids: Vec<String> = nodes.iter().map(|n| n.id.clone()).collect();
    for id in &node_ids {
        if visited.contains(id) { continue; }
        let mut queue = vec![id.clone()];
        visited.insert(id.clone());
        while let Some(current) = queue.pop() {
            if let Some(node) = nodes.iter_mut().find(|n| n.id == current) {
                node.community = community_id;
            }
            if let Some(neighbors) = adj.get(&current) {
                for neighbor in neighbors {
                    if !visited.contains(neighbor) {
                        visited.insert(neighbor.clone());
                        queue.push(neighbor.clone());
                    }
                }
            }
        }
        community_id += 1;
    }

    Ok(Json(GraphData { nodes, edges }))
}

pub fn router() -> Router {
    Router::with_path("graph")
        .push(Router::with_path("data").get(get_graph))
}
