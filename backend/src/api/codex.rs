//! Authenticated gRPC-over-WebSocket bridge for non-interactive Codex prompts.
//!
//! Client → server:
//! `{ "prompt": "…" }` followed optionally by `{ "action": "cancel" }`.
//!
//! Server → client:
//! `{ "type": "CONNECTED|STARTED|PROGRESS|COMPLETE|ERROR|CANCELLED", ... }`.

use crate::core::state::AppState;
use cortex_lib::utils::generate_id;
use eiva_be_security::jwt::{verify_token, Claims};
use futures_util::{SinkExt, StreamExt};
use salvo::prelude::*;
use salvo::websocket::{Message, WebSocketUpgrade};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::process::Stdio;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::sync::{mpsc, oneshot, Semaphore};

const MAX_PROMPT_CHARS: usize = 20_000;
const MAX_OUTPUT_CHARS: usize = 16_000;
const MAX_JOB_DURATION: Duration = Duration::from_secs(30 * 60);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_CONCURRENT_JOBS: usize = 2;

static CODEX_JOB_SLOTS: OnceLock<Arc<Semaphore>> = OnceLock::new();

fn job_slots() -> Arc<Semaphore> {
    CODEX_JOB_SLOTS
        .get_or_init(|| Arc::new(Semaphore::new(MAX_CONCURRENT_JOBS)))
        .clone()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PromptCommand {
    prompt: Option<String>,
    action: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "UPPERCASE")]
enum PromptEventType {
    Connected,
    Started,
    Progress,
    Complete,
    Error,
    Cancelled,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PromptEvent {
    #[serde(rename = "type")]
    event_type: PromptEventType,
    job_id: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_type: Option<String>,
}

impl PromptEvent {
    fn new(event_type: PromptEventType, job_id: &str, message: impl Into<String>) -> Self {
        Self {
            event_type,
            job_id: job_id.to_string(),
            message: message.into(),
            stream: None,
            source_type: None,
        }
    }

    fn output(job_id: &str, stream: &str, line: &str) -> Self {
        let (message, source_type) = output_message(line);
        Self {
            event_type: PromptEventType::Progress,
            job_id: job_id.to_string(),
            message,
            stream: Some(stream.to_string()),
            source_type,
        }
    }

    fn terminal(&self) -> bool {
        matches!(
            self.event_type,
            PromptEventType::Complete | PromptEventType::Error | PromptEventType::Cancelled
        )
    }
}

fn websocket_authentication(req: &Request, state: &AppState) -> Result<Claims, StatusError> {
    let token = req
        .query::<String>("token")
        .ok_or_else(StatusError::unauthorized)?;
    let claims =
        verify_token(&token, &state.config.jwt_secret).map_err(|_| StatusError::unauthorized())?;
    if claims.role != "admin" {
        return Err(StatusError::unauthorized());
    }
    Ok(claims)
}

fn validate_prompt(prompt: &str) -> Result<String, &'static str> {
    let prompt = prompt.trim();
    let length = prompt.chars().count();
    if length == 0 {
        return Err("Prompt cannot be empty");
    }
    if length > MAX_PROMPT_CHARS {
        return Err("Prompt is too long");
    }
    if prompt.contains('\0') {
        return Err("Prompt contains an invalid character");
    }
    Ok(prompt.to_string())
}

fn truncate(value: &str) -> String {
    let mut chars = value.chars();
    let result = chars.by_ref().take(MAX_OUTPUT_CHARS).collect::<String>();
    if chars.next().is_some() {
        format!("{result}… [truncated]")
    } else {
        result
    }
}

fn output_message(line: &str) -> (String, Option<String>) {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return (truncate(line), None);
    };
    let source_type = value
        .get("type")
        .and_then(Value::as_str)
        .map(str::to_string);
    let message = value
        .pointer("/item/text")
        .and_then(Value::as_str)
        .or_else(|| value.pointer("/error/message").and_then(Value::as_str))
        .or_else(|| value.get("message").and_then(Value::as_str))
        .or_else(|| value.get("text").and_then(Value::as_str))
        .or_else(|| source_type.as_deref())
        .unwrap_or(line);
    (truncate(message), source_type)
}

async fn stream_output<R>(
    reader: R,
    stream: &'static str,
    job_id: String,
    events: mpsc::UnboundedSender<PromptEvent>,
) where
    R: AsyncRead + Unpin,
{
    let mut lines = BufReader::new(reader).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if events
            .send(PromptEvent::output(&job_id, stream, &line))
            .is_err()
        {
            break;
        }
    }
}

async fn run_process(
    prompt: String,
    work_root: String,
    job_id: String,
    events: mpsc::UnboundedSender<PromptEvent>,
    cancel: oneshot::Receiver<()>,
) {
    let binary = std::env::var("CODEX_BINARY").unwrap_or_else(|_| "codex".into());
    let _ = events.send(PromptEvent::new(
        PromptEventType::Started,
        &job_id,
        "Codex 工作已啟動",
    ));
    let mut command = tokio::process::Command::new(binary);
    command
        .arg("exec")
        .arg("--json")
        .arg("--color")
        .arg("never")
        .arg("--sandbox")
        .arg("workspace-write")
        .arg("--ephemeral")
        .arg("-C")
        .arg(&work_root)
        .arg("--")
        .arg(prompt)
        .current_dir(&work_root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            let _ = events.send(PromptEvent::new(
                PromptEventType::Error,
                &job_id,
                format!("無法啟動 Codex：{error}"),
            ));
            return;
        }
    };
    let stdout_task = child.stdout.take().map(|stdout| {
        tokio::spawn(stream_output(
            stdout,
            "stdout",
            job_id.clone(),
            events.clone(),
        ))
    });
    let stderr_task = child.stderr.take().map(|stderr| {
        tokio::spawn(stream_output(
            stderr,
            "stderr",
            job_id.clone(),
            events.clone(),
        ))
    });

    let terminal = tokio::select! {
        status = child.wait() => match status {
            Ok(status) if status.success() => PromptEvent::new(PromptEventType::Complete, &job_id, "Codex 執行完成"),
            Ok(status) => PromptEvent::new(PromptEventType::Error, &job_id, format!("Codex 執行失敗，exit code: {}", status.code().unwrap_or(-1))),
            Err(error) => PromptEvent::new(PromptEventType::Error, &job_id, format!("等待 Codex 結束時發生錯誤：{error}")),
        },
        _ = cancel => {
            let _ = child.kill().await;
            PromptEvent::new(PromptEventType::Cancelled, &job_id, "Codex 工作已取消")
        },
        _ = tokio::time::sleep(MAX_JOB_DURATION) => {
            let _ = child.kill().await;
            PromptEvent::new(PromptEventType::Error, &job_id, "Codex 工作超過 30 分鐘，已自動停止")
        },
    };

    if let Some(task) = stdout_task {
        let _ = task.await;
    }
    if let Some(task) = stderr_task {
        let _ = task.await;
    }
    let _ = events.send(terminal);
}

async fn codex_prompt_loop(
    socket: salvo::websocket::WebSocket,
    state: AppState,
    identity: Claims,
    job_id: String,
) {
    let (mut sink, mut incoming) = socket.split();
    let permit = match job_slots().try_acquire_owned() {
        Ok(permit) => permit,
        Err(_) => {
            let event = PromptEvent::new(
                PromptEventType::Error,
                &job_id,
                "Codex 工作已達同時執行上限，請稍後再試",
            );
            let _ = sink
                .send(Message::text(serde_json::to_string(&event).unwrap()))
                .await;
            return;
        }
    };
    let connected = PromptEvent::new(
        PromptEventType::Connected,
        &job_id,
        "gRPC-over-WebSocket 連線已建立",
    );
    if sink
        .send(Message::text(serde_json::to_string(&connected).unwrap()))
        .await
        .is_err()
    {
        return;
    }

    let command = match tokio::time::timeout(REQUEST_TIMEOUT, incoming.next()).await {
        Ok(Some(Ok(message))) if message.is_text() => message
            .to_str()
            .ok()
            .and_then(|value| serde_json::from_str::<PromptCommand>(value).ok()),
        _ => None,
    };
    let prompt = match command
        .and_then(|command| command.prompt)
        .ok_or("Missing prompt")
        .and_then(|prompt| validate_prompt(&prompt))
    {
        Ok(prompt) => prompt,
        Err(message) => {
            let event = PromptEvent::new(PromptEventType::Error, &job_id, message);
            let _ = sink
                .send(Message::text(serde_json::to_string(&event).unwrap()))
                .await;
            return;
        }
    };

    tracing::info!(job_id = %job_id, user = %identity.username, "Starting Codex prompt job");
    let (events_tx, mut events_rx) = mpsc::unbounded_channel();
    let (cancel_tx, cancel_rx) = oneshot::channel();
    let mut cancel_tx = Some(cancel_tx);
    let mut process = tokio::spawn(run_process(
        prompt,
        state.config.work_root.clone(),
        job_id.clone(),
        events_tx,
        cancel_rx,
    ));

    loop {
        tokio::select! {
            event = events_rx.recv() => match event {
                Some(event) => {
                    let terminal = event.terminal();
                    if sink.send(Message::text(serde_json::to_string(&event).unwrap())).await.is_err() {
                        if let Some(cancel) = cancel_tx.take() { let _ = cancel.send(()); }
                        break;
                    }
                    if terminal { break; }
                }
                None => break,
            },
            message = incoming.next() => match message {
                Some(Ok(message)) if message.is_text() => {
                    let cancel_requested = message.to_str().ok()
                        .and_then(|value| serde_json::from_str::<PromptCommand>(value).ok())
                        .and_then(|command| command.action)
                        .is_some_and(|action| action.eq_ignore_ascii_case("cancel"));
                    if cancel_requested {
                        if let Some(cancel) = cancel_tx.take() { let _ = cancel.send(()); }
                    }
                }
                Some(Ok(message)) if message.is_close() => {
                    if let Some(cancel) = cancel_tx.take() { let _ = cancel.send(()); }
                    break;
                }
                Some(Err(_)) | None => {
                    if let Some(cancel) = cancel_tx.take() { let _ = cancel.send(()); }
                    break;
                }
                _ => {}
            }
        }
    }
    if tokio::time::timeout(Duration::from_secs(5), &mut process)
        .await
        .is_err()
    {
        process.abort();
        let _ = process.await;
    }
    drop(permit);
    tracing::info!(job_id = %job_id, user = %identity.username, "Codex prompt job closed");
}

#[handler]
async fn codex_prompt_websocket(
    req: &mut Request,
    res: &mut Response,
    depot: &mut Depot,
) -> Result<(), StatusError> {
    let state = depot.obtain::<AppState>().unwrap().clone();
    let identity = websocket_authentication(req, &state)?;
    let job_id = generate_id();
    WebSocketUpgrade::new()
        .upgrade(req, res, move |socket| async move {
            codex_prompt_loop(socket, state, identity, job_id).await;
        })
        .await
}

pub fn router() -> Router {
    Router::with_path("codex").push(Router::with_path("ws/prompt").get(codex_prompt_websocket))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_prompt_boundaries() {
        assert_eq!(
            validate_prompt("  inspect the repository  ").unwrap(),
            "inspect the repository"
        );
        assert!(validate_prompt("   ").is_err());
        assert!(validate_prompt(&"x".repeat(MAX_PROMPT_CHARS + 1)).is_err());
        assert!(validate_prompt("bad\0prompt").is_err());
    }

    #[test]
    fn extracts_codex_jsonl_messages() {
        let line = r#"{"type":"item.completed","item":{"type":"agent_message","text":"Finished"}}"#;
        assert_eq!(
            output_message(line),
            ("Finished".into(), Some("item.completed".into()))
        );
        assert_eq!(
            output_message("plain output"),
            ("plain output".into(), None)
        );
    }
}
