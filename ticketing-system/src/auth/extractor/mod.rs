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

#[cfg(test)]
mod tests {
    use super::JwtExtractorError;
    use actix_web::{http::StatusCode, ResponseError};

    #[test]
    fn debug_contains_message_and_status_code() {
        let missing = JwtExtractorError::MissingClaims;
        let s = format!("{:?}", missing);
        assert!(s.contains("Missing claims"));
        assert_eq!(missing.status_code(), StatusCode::UNAUTHORIZED);

        let unexpected = JwtExtractorError::Unexpected(anyhow::anyhow!("boom"));
        let s2 = format!("{:?}", unexpected);
        assert!(s2.contains("boom"));
        assert_eq!(unexpected.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}