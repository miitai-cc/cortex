use salvo::prelude::*;
use std::path::Path;
use tracing_subscriber::EnvFilter;

mod api;
mod config;
mod core;
mod db;
mod errors;
mod gsuite;
mod i18n;
mod ingestion;
mod logging;
mod markdown;
mod middleware;
mod models;
mod monitoring;
mod office;
mod rag;
mod webdav;

fn load_env() -> Option<String> {
    let candidates = [
        // Running from project root (cargo run)
        "backend/.env",
        // Running from backend/ directory
        ".env",
        // Docker or deployed binary (same dir as exe)
        &std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join(".env")))
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
    ];

    for path in &candidates {
        if !path.is_empty() && Path::new(path).exists() {
            dotenv::from_path(path).ok();
            return Some(path.to_string());
        }
    }

    dotenv::dotenv().ok();
    None
}

#[tokio::main]
async fn main() {
    let env_path = load_env();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("debug")),
        )
        .init();

    if let Some(path) = env_path {
        tracing::info!("Loaded environment from: {}", path);
    }

    tracing::info!("Starting Cortex Backend...");

    let mut app_state = core::state::AppState::new().await;
    tracing::debug!("App state initialized");

    if let Err(error) = app_state.db.run_migrations().await {
        tracing::error!("Database migration failed; server startup aborted: {error}");
        return;
    }
    tracing::debug!("Database migrations completed");
    if let Err(error) = app_state.apply_persisted_settings().await {
        tracing::error!("Failed to load persisted system settings: {error}");
    }

    let server_host = app_state.config.server_host.clone();
    let server_port = app_state.config.server_port;

    let service = api::router::build_service(app_state);

    let addr = format!("{}:{}", server_host, server_port);
    let acceptor = TcpListener::new(&addr).bind().await;
    tracing::info!("Server listening on {}", addr);
    Server::new(acceptor).serve(service).await;
}
