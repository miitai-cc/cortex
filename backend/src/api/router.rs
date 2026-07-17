use salvo::prelude::*;
use salvo::cors::Cors;
use crate::api::{auth, documents, rag, health, admin, graph, chat, research};
use crate::core::state::AppState;
use crate::middleware::error_handler::handle_error;

const API_PREFIX: &str = "cortex/api/v0.85";

pub fn build_router(state: AppState) -> Router {
    let cors = Cors::new()
        .allow_origin("http://localhost:54321")
        .allow_methods([
            salvo::http::Method::GET,
            salvo::http::Method::POST,
            salvo::http::Method::PUT,
            salvo::http::Method::DELETE,
            salvo::http::Method::OPTIONS,
        ])
        .allow_headers(vec!["content-type", "authorization"])
        .allow_credentials(true)
        .into_handler();

    Router::new()
        .hoop(cors)
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
        )
}

pub fn build_service(state: AppState) -> Service {
    Service::new(build_router(state)).catcher(salvo::catcher::Catcher::default().hoop(handle_error))
}

