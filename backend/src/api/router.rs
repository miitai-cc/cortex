use salvo::prelude::*;
use crate::api::{auth, documents, rag, health, admin};
use crate::core::state::AppState;

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
