use salvo::prelude::*;

#[handler]
pub async fn handle_error(res: &mut Response, _ctrl: &mut FlowCtrl) {
    if let Some(status) = res.status_code {
        if status.is_client_error() || status.is_server_error() {
            let body = serde_json::json!({
                "error": status.canonical_reason().unwrap_or("Unknown error"),
                "code": status.as_u16(),
            });
            res.render(Json(body));
        }
    }
}
