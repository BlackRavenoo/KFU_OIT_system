use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};

use crate::{services::registration_token::RegistrationTokenStore, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct ValidateTokenSchema {
    token: String,
}

#[derive(thiserror::Error)]
pub enum ValidateTokenError {
    #[error("Token does not exist")]
    TokenNotExist,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for ValidateTokenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ValidateTokenError {
    fn status_code(&self) -> StatusCode {
        match self {
            ValidateTokenError::TokenNotExist => StatusCode::BAD_REQUEST,
            ValidateTokenError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Serialize)]
pub struct ValidateTokenResponse {
    email: String,
}

pub async fn validate_register_token(
    web::Json(data): web::Json<ValidateTokenSchema>,
    store: web::Data<RegistrationTokenStore>,
) -> Result<HttpResponse, ValidateTokenError> {
    let email = store.get_email(&data.token)
        .await?
        .ok_or(ValidateTokenError::TokenNotExist)?;

    Ok(HttpResponse::Ok().json(ValidateTokenResponse {
        email,
    }))
}