//! gRPC-over-WebSocket indexing API
//!
//! Proto-compatible message contract (JSON-encoded):
//!
//! ```json
//! // Client → Server (once, after WS upgrade)
//! { "relative_path": "projects/my-repo" }
//!
//! // Server → Client (streamed, one per line of CLI output)
//! { "type": "PROGRESS", "message": "...", "full_path": "/..." }
//! { "type": "COMPLETE", "message": "Done.",  "full_path": "/..." }
//! { "type": "ERROR",    "message": "Failed.", "full_path": "/..." }
//! ```

use crate::core::state::AppState;
use futures_util::{SinkExt, StreamExt};
use salvo::prelude::*;
use salvo::websocket::{Message, WebSocketUpgrade};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};

// ─────────────────────────────────────────────────────────────────────────────
// Proto-compatible message types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
#[allow(dead_code)] // kept for proto contract documentation
pub struct IndexRequest {
    pub relative_path: String,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum EventType {
    Progress,
    Complete,
    Error,
}

#[derive(Serialize, Debug)]
pub struct IndexEvent {
    #[serde(rename = "type")]
    pub event_type: EventType,
    pub message: String,
    pub full_path: String,
}

impl IndexEvent {
    fn progress(msg: impl Into<String>, path: &str) -> Self {
        Self {
            event_type: EventType::Progress,
            message: msg.into(),
            full_path: path.to_string(),
        }
    }
    fn complete(msg: impl Into<String>, path: &str) -> Self {
        Self {
            event_type: EventType::Complete,
            message: msg.into(),
            full_path: path.to_string(),
        }
    }
    fn error(msg: impl Into<String>, path: &str) -> Self {
        Self {
            event_type: EventType::Error,
            message: msg.into(),
            full_path: path.to_string(),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared streaming logic
// ─────────────────────────────────────────────────────────────────────────────

async fn run_indexer(
    ws: salvo::websocket::WebSocket,
    cmd: &'static str,
    args: &[&'static str],
    full_path: String,
) {
    let (mut sink, stream) = ws.split();

    // Await the first client message → IndexRequest (we already have full_path built)
    // (The caller already received and parsed the request before calling this fn)

    // Send a "starting" progress event immediately
    let starting = IndexEvent::progress(format!("Starting `{cmd}` on {full_path} …"), &full_path);
    if sink
        .send(Message::text(serde_json::to_string(&starting).unwrap()))
        .await
        .is_err()
    {
        return;
    }

    // Spawn the CLI process
    let mut proc_cmd = tokio::process::Command::new(cmd);
    proc_cmd
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    // Only append path when it is non-empty (e.g. gitnexus serve takes no path)
    if !full_path.is_empty() {
        proc_cmd.arg(&full_path);
    }
    let mut child = match proc_cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let ev = IndexEvent::error(format!("Failed to start `{cmd}`: {e}"), &full_path);
            let _ = sink
                .send(Message::text(serde_json::to_string(&ev).unwrap()))
                .await;
            return;
        }
    };

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let ev = IndexEvent::progress(line, &full_path);
            if sink
                .send(Message::text(serde_json::to_string(&ev).unwrap()))
                .await
                .is_err()
            {
                // Client disconnected
                let _ = child.kill().await;
                return;
            }
        }
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let ev = IndexEvent::progress(format!("[stderr] {line}"), &full_path);
            if sink
                .send(Message::text(serde_json::to_string(&ev).unwrap()))
                .await
                .is_err()
            {
                let _ = child.kill().await;
                return;
            }
        }
    }

    // Wait for exit status
    let ev = match child.wait().await {
        Ok(status) if status.success() => IndexEvent::complete("索引完成 ✓", &full_path),
        Ok(status) => IndexEvent::error(
            format!("索引失敗，exit code: {}", status.code().unwrap_or(-1)),
            &full_path,
        ),
        Err(e) => IndexEvent::error(format!("等待處理完畢時發生錯誤: {e}"), &full_path),
    };
    let _ = sink
        .send(Message::text(serde_json::to_string(&ev).unwrap()))
        .await;

    // Drain any remaining client messages (keep connection tidy)
    drop(stream);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// GET /indexing/ws/gitnexus  → WebSocket upgrade (index)
#[handler]
pub async fn ws_gitnexus(
    req: &mut Request,
    res: &mut Response,
    depot: &mut Depot,
) -> Result<(), StatusError> {
    let state = depot.obtain::<AppState>().unwrap().clone();

    // Parse relative_path from query param (WS upgrades cannot have a body)
    let rel_path = req.query::<String>("relative_path").unwrap_or_default();
    let rel_path = rel_path.trim_matches('/').to_string();
    let full_path = format!(
        "{}/{}",
        state.config.work_root.trim_end_matches('/'),
        rel_path
    );

    tracing::info!("WS GitNexus indexing: {full_path}");

    WebSocketUpgrade::new()
        .upgrade(req, res, move |ws| async move {
            run_indexer(ws, "gitnexus", &["index"], full_path).await;
        })
        .await
}

/// GET /indexing/ws/gitnexus/serve → WebSocket upgrade (start HTTP server)
/// Runs: gitnexus serve
/// Long-running — streams startup output until client disconnects or process exits.
#[handler]
pub async fn ws_gitnexus_serve(
    req: &mut Request,
    res: &mut Response,
    _depot: &mut Depot,
) -> Result<(), StatusError> {
    tracing::info!("WS GitNexus serve: starting");

    WebSocketUpgrade::new()
        .upgrade(req, res, |ws| async move {
            // gitnexus serve takes no path; runs on default port 4747
            run_indexer(ws, "gitnexus", &["serve"], String::new()).await;
        })
        .await
}

/// GET /indexing/ws/graphify  → WebSocket upgrade (index / AST-only)
#[handler]
pub async fn ws_graphify(
    req: &mut Request,
    res: &mut Response,
    depot: &mut Depot,
) -> Result<(), StatusError> {
    let state = depot.obtain::<AppState>().unwrap().clone();

    let rel_path = req.query::<String>("relative_path").unwrap_or_default();
    let rel_path = rel_path.trim_matches('/').to_string();
    let full_path = format!(
        "{}/{}",
        state.config.work_root.trim_end_matches('/'),
        rel_path
    );

    tracing::info!("WS Graphify indexing: {full_path}");

    WebSocketUpgrade::new()
        .upgrade(req, res, move |ws| async move {
            run_indexer(ws, "graphify", &["index"], full_path).await;
        })
        .await
}

/// GET /indexing/ws/graphify/extract → WebSocket upgrade (full semantic extraction)
/// Runs: graphify extract <full_path>
/// Performs complete AST + LLM semantic extraction for the target directory.
#[handler]
pub async fn ws_graphify_extract(
    req: &mut Request,
    res: &mut Response,
    depot: &mut Depot,
) -> Result<(), StatusError> {
    let state = depot.obtain::<AppState>().unwrap().clone();

    let rel_path = req.query::<String>("relative_path").unwrap_or_default();
    let rel_path = rel_path.trim_matches('/').to_string();
    let full_path = format!(
        "{}/{}",
        state.config.work_root.trim_end_matches('/'),
        rel_path
    );

    tracing::info!("WS Graphify extract: {full_path}");

    WebSocketUpgrade::new()
        .upgrade(req, res, move |ws| async move {
            run_indexer(ws, "graphify", &["extract"], full_path).await;
        })
        .await
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

pub fn router() -> Router {
    Router::with_path("indexing")
        // 建立索引
        .push(Router::with_path("ws/gitnexus").get(ws_gitnexus))
        .push(Router::with_path("ws/graphify").get(ws_graphify))
        // 啟始
        .push(Router::with_path("ws/gitnexus/serve").get(ws_gitnexus_serve))
        .push(Router::with_path("ws/graphify/extract").get(ws_graphify_extract))
}
