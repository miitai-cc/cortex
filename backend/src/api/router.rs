use salvo::prelude::*;
use crate::api::{auth, documents, rag, health, admin};
use crate::core::state::AppState;
use crate::middleware::error_handler::handle_error;

const API_PREFIX: &str = "cortex/api/v0.85";

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .hoop(affix_state::inject(state))
        .push(
            Router::with_path(API_PREFIX)
                .push(auth::router())
                .push(documents::router())
                .push(rag::router())
                .push(health::router())
                .push(admin::router())
        )
}

pub fn build_service(state: AppState) -> Service {
    Service::new(build_router(state)).catcher(salvo::catcher::Catcher::default().hoop(handle_error))
}

