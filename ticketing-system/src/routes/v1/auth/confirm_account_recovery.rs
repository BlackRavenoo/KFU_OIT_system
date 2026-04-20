use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::password::Password, schema::action_token::ActionTokenKind, utils::error_chain_fmt};

use crate::services::action_token::ActionTokenStore;

#[derive(Deserialize, Validate)]
pub struct ConfirmAccountRecoverySchema {
    #[garde(skip)]
    token: String,
    #[garde(dive)]
    new_password: Password,
}

#[derive(thiserror::Error)]
pub enum ConfirmAccountRecoveryError {
    #[error("Token does not exist")]
    TokenNotExist,
    #[error("User not found")]
    UserNotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for ConfirmAccountRecoveryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ConfirmAccountRecoveryError {
    fn status_code(&self) -> StatusCode {
        match self {
            ConfirmAccountRecoveryError::TokenNotExist => StatusCode::BAD_REQUEST,
            ConfirmAccountRecoveryError::UserNotFound => StatusCode::NOT_FOUND,
            ConfirmAccountRecoveryError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn confirm_account_recovery(
    Json(data): Json<ConfirmAccountRecoverySchema>,
    token_store: web::Data<ActionTokenStore>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, ConfirmAccountRecoveryError> {
    let email = token_store
        .get_del_payload(ActionTokenKind::PasswordRecovery, &data.token)
        .await?
        .ok_or(ConfirmAccountRecoveryError::TokenNotExist)?;

    let password_hash = data
        .new_password
        .hash()
        .context("Failed to hash password")?;

    let rows_affected = sqlx::query!(
        "UPDATE users
        SET password_hash = $1
        WHERE email = $2",
        password_hash,
        email
    )
    .execute(pool.as_ref())
    .await
    .context("Failed to update password")?
    .rows_affected();

    if rows_affected == 0 {
        return Err(ConfirmAccountRecoveryError::UserNotFound);
    }

    Ok(HttpResponse::Ok().finish())
}
