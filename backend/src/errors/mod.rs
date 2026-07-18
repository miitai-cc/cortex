#![allow(dead_code)]
use salvo::http::StatusCode;
use salvo::prelude::*;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Security error: {0}")]
    Security(#[from] eiva_be_security::errors::SecurityError),
}

impl AppError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            AppError::Database(_) | AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Security(e) => match e {
                eiva_be_security::errors::SecurityError::Database(_) => {
                    StatusCode::INTERNAL_SERVER_ERROR
                }
                eiva_be_security::errors::SecurityError::NotFound(_) => StatusCode::NOT_FOUND,
                eiva_be_security::errors::SecurityError::Conflict(_) => StatusCode::CONFLICT,
                eiva_be_security::errors::SecurityError::Unauthorized(_) => {
                    StatusCode::UNAUTHORIZED
                }
            },
        }
    }
}

#[async_trait]
impl Writer for AppError {
    async fn write(self, _req: &mut Request, _depot: &mut Depot, res: &mut Response) {
        let code = self.status_code();
        res.status_code(code);
        res.render(Json(serde_json::json!({
            "error": self.to_string(),
            "code": code.as_u16(),
        })));
    }
}
