use crate::core::state::AppState;
use salvo::prelude::*;

#[handler]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn check(depot: &mut Depot) -> Json<serde_json::Value> {
    let state = depot.obtain::<AppState>().unwrap();
    let db_ok = sqlx::query("SELECT 1")
        .execute(&state.db.pool)
        .await
        .is_ok();
    let qdrant_ok = state.qdrant.health_check().await.is_ok();

    Json(serde_json::json!({
        "status": if db_ok && qdrant_ok { "healthy" } else { "unhealthy" },
        "database": db_ok,
        "qdrant": qdrant_ok,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

pub fn router() -> Router {
    Router::with_path("health").get(check)
}
