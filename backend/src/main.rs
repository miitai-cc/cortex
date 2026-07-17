use salvo::prelude::*;
use tracing_subscriber::EnvFilter;
use std::path::Path;

mod api;
mod core;
mod rag;
mod ingestion;
mod office;
mod markdown;
mod webdav;
mod gsuite;
mod i18n;
mod middleware;
mod monitoring;
mod config;
mod db;
mod errors;
mod logging;
mod models;

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
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("debug")))
        .init();

    if let Some(path) = env_path {
        tracing::info!("Loaded environment from: {}", path);
    }

    tracing::info!("Starting Cortex Backend...");

    let app_state = core::state::AppState::new().await;
    tracing::debug!("App state initialized");
    
    let _ = app_state.db.run_migrations().await;
    tracing::debug!("Database migrations completed");

    let service = api::router::build_service(app_state);

    let acceptor = TcpListener::new("0.0.0.0:8080").bind().await;
    tracing::info!("Server listening on 0.0.0.0:8080");
    Server::new(acceptor).serve(service).await;
}

