use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{
    auth::types::UserRole,
    schema::action_token::ActionTokenKind,
    services::action_token::ActionTokenStore,
    utils::error_chain_fmt,
};

#[derive(Deserialize)]
pub struct ConfirmAdminTransferSchema {
    token: String,
}

#[derive(thiserror::Error)]
pub enum ConfirmAdminTransferError {
    #[error("Token does not exist")]
    TokenNotExist,
    #[error("Invalid token payload")]
    InvalidTokenPayload,
    #[error("User not found")]
    UserNotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for ConfirmAdminTransferError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ConfirmAdminTransferError {
    fn status_code(&self) -> StatusCode {
        match self {
            ConfirmAdminTransferError::TokenNotExist => StatusCode::BAD_REQUEST,
            ConfirmAdminTransferError::InvalidTokenPayload => StatusCode::BAD_REQUEST,
            ConfirmAdminTransferError::UserNotFound => StatusCode::NOT_FOUND,
            ConfirmAdminTransferError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn confirm_admin_transfer(
    web::Json(schema): web::Json<ConfirmAdminTransferSchema>,
    token_store: web::Data<ActionTokenStore>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, ConfirmAdminTransferError> {
    let payload = token_store
        .get_del_payload(ActionTokenKind::AdminTransfer, &schema.token)
        .await?
        .ok_or(ConfirmAdminTransferError::TokenNotExist)?;

    let (from_admin_id, to_admin_id) = parse_transfer_payload(&payload)
        .ok_or(ConfirmAdminTransferError::InvalidTokenPayload)?;

    let mut transaction = pool
        .begin()
        .await
        .context("Failed to start DB transaction")?;

    let promote_res = sqlx::query!(
        "UPDATE users
        SET role = $1
        WHERE id = $2 AND is_active",
        UserRole::Admin as i16,
        to_admin_id,
    )
    .execute(&mut *transaction)
    .await
    .context("Failed to promote new admin")?;

    if promote_res.rows_affected() == 0 {
        transaction.rollback().await.ok();
        return Err(ConfirmAdminTransferError::UserNotFound);
    }

    let demote_res = sqlx::query!(
        "UPDATE users
        SET role = $1
        WHERE id = $2 AND role = $3",
        UserRole::Moderator as i16,
        from_admin_id,
        UserRole::Admin as i16,
    )
    .execute(&mut *transaction)
    .await
    .context("Failed to demote current admin")?;

    if demote_res.rows_affected() == 0 {
        transaction.rollback().await.ok();
        return Err(ConfirmAdminTransferError::UserNotFound);
    }

    transaction
        .commit()
        .await
        .context("Failed to commit admin transfer transaction")?;

    Ok(HttpResponse::Ok().finish())
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
