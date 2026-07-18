use crate::api::{admin, auth, chat, documents, graph, health, indexing, rag, research};
use crate::core::state::AppState;
use crate::middleware::error_handler::handle_error;
use salvo::cors::Cors;
use salvo::prelude::*;

const API_PREFIX: &str = "cortex/api/v0.85";

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .hoop(salvo::logging::Logger::new())
        .hoop(affix_state::inject(state))
        .push(
            Router::with_path(API_PREFIX)
                .push(auth::router())
                .push(documents::router())
                .push(rag::router())
                .push(health::router())
                .push(admin::router())
                .push(graph::router())
                .push(chat::router())
                .push(research::router())
                .push(indexing::router()),
        )
}

pub fn build_service(state: AppState) -> Service {
    let cors = Cors::new()
        .allow_origin("http://localhost:54321")
        .allow_methods([
            salvo::http::Method::GET,
            salvo::http::Method::POST,
            salvo::http::Method::PUT,
            salvo::http::Method::DELETE,
            salvo::http::Method::OPTIONS,
        ])
        .allow_headers(vec![
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
        ])
        .allow_credentials(true)
        .into_handler();

    Service::new(build_router(state))
        .hoop(cors)
        .catcher(salvo::catcher::Catcher::default().hoop(handle_error))
}
