use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};

use crate::{schema::action_token::ActionTokenKind, services::action_token::ActionTokenStore, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct ValidateAdminTransferTokenSchema {
    token: String,
}

#[derive(thiserror::Error)]
pub enum ValidateAdminTransferTokenError {
    #[error("Token does not exist")]
    TokenNotExist,
    #[error("Invalid token payload")]
    InvalidTokenPayload,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for ValidateAdminTransferTokenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ValidateAdminTransferTokenError {
    fn status_code(&self) -> StatusCode {
        match self {
            ValidateAdminTransferTokenError::TokenNotExist => StatusCode::BAD_REQUEST,
            ValidateAdminTransferTokenError::InvalidTokenPayload => StatusCode::BAD_REQUEST,
            ValidateAdminTransferTokenError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Serialize)]
pub struct ValidateAdminTransferTokenResponse {
    from_user_id: i32,
    to_user_id: i32,
}

pub async fn validate_admin_transfer_token(
    web::Json(data): web::Json<ValidateAdminTransferTokenSchema>,
    store: web::Data<ActionTokenStore>,
) -> Result<HttpResponse, ValidateAdminTransferTokenError> {
    let payload = store
        .get_payload(ActionTokenKind::AdminTransfer, &data.token)
        .await?
        .ok_or(ValidateAdminTransferTokenError::TokenNotExist)?;

    let (from_user_id, to_user_id) = parse_transfer_payload(&payload)
        .ok_or(ValidateAdminTransferTokenError::InvalidTokenPayload)?;

    Ok(HttpResponse::Ok().json(ValidateAdminTransferTokenResponse {
        from_user_id,
        to_user_id,
    }))
}

fn parse_transfer_payload(payload: &str) -> Option<(i32, i32)> {
    let mut parts = payload.split(':');

    let from = parts.next()?.parse().ok()?;
    let to = parts.next()?.parse().ok()?;

    if parts.next().is_some() {
        return None;
    }

    Some((from, to))
}
