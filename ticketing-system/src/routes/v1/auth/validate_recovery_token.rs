use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use serde::Deserialize;

use crate::{schema::action_token::ActionTokenKind, services::action_token::ActionTokenStore, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct ValidateRecoveryTokenSchema {
    token: String,
}

#[derive(thiserror::Error)]
pub enum ValidateRecoveryTokenError {
    #[error("Token does not exist")]
    TokenNotExist,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for ValidateRecoveryTokenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ValidateRecoveryTokenError {
    fn status_code(&self) -> StatusCode {
        match self {
            ValidateRecoveryTokenError::TokenNotExist => StatusCode::BAD_REQUEST,
            ValidateRecoveryTokenError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn validate_recovery_token(
    web::Json(data): web::Json<ValidateRecoveryTokenSchema>,
    store: web::Data<ActionTokenStore>,
) -> Result<HttpResponse, ValidateRecoveryTokenError> {
    store.get_payload(ActionTokenKind::PasswordRecovery, &data.token)
        .await?
        .ok_or(ValidateRecoveryTokenError::TokenNotExist)?;

    Ok(HttpResponse::Ok().finish())
}
