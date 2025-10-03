pub mod user_id;
pub mod user_role;

pub use user_id::UserIdExtractor;
pub use user_role::UserRoleExtractor;

use actix_web::{http::StatusCode, ResponseError};

use crate::utils::error_chain_fmt;

#[derive(thiserror::Error)]
pub enum JwtExtractorError {
    #[error("Missing claims")]
    MissingClaims,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for JwtExtractorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for JwtExtractorError {
    fn status_code(&self) -> StatusCode {
        match self {
            JwtExtractorError::MissingClaims => StatusCode::UNAUTHORIZED,
            JwtExtractorError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}