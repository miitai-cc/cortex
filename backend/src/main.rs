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
mod security;
mod monitoring;
mod config;
mod db;
mod errors;
mod logging;
mod middleware;
mod models;

fn load_env() {
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
            tracing::info!("Loaded environment from: {}", path);
            return;
        }
    }

    dotenv::dotenv().ok();
}

#[tokio::main]
async fn main() {
    load_env();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let app_state = core::state::AppState::new().await;
    let _ = app_state.db.run_migrations().await;

    let router = api::router::build_router(app_state);

    let acceptor = TcpListener::new("0.0.0.0:8080").bind().await;
    Server::new(acceptor).serve(router).await;
}
