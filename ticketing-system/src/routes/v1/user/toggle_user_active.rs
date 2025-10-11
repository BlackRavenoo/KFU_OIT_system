use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use sqlx::{postgres::PgQueryResult, PgPool};

use crate::{schema::common::UserId, utils::error_chain_fmt};



#[derive(thiserror::Error)]
pub enum ToggleUserActiveError {
    #[error("User not found")]
    UserNotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for ToggleUserActiveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ToggleUserActiveError {
    fn status_code(&self) -> StatusCode {
        match self {
            ToggleUserActiveError::UserNotFound => StatusCode::NOT_FOUND,
            ToggleUserActiveError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn activate_account(
    pool: web::Data<PgPool>,
    user_id: web::Path<UserId>,
) -> Result<HttpResponse, ToggleUserActiveError> {
    if toggle_user_active(&pool, true, *user_id)
        .await
        .context("Failed to activate user account")?
        .rows_affected() == 0 {
            return Err(ToggleUserActiveError::UserNotFound)
        }

    Ok(HttpResponse::Ok().finish())
}

pub async fn deactivate_account(
    pool: web::Data<PgPool>,
    user_id: web::Path<UserId>,
) -> Result<HttpResponse, ToggleUserActiveError> {
    if toggle_user_active(&pool, false, *user_id)
        .await
        .context("Failed to deactivate user account")?
        .rows_affected() == 0 {
            return Err(ToggleUserActiveError::UserNotFound)
        }

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Toggle user account in database",
    skip(pool),
)]
async fn toggle_user_active(
    pool: &PgPool,
    is_active: bool,
    user_id: UserId
) -> Result<PgQueryResult, sqlx::Error> {
    sqlx::query!(
        "
            UPDATE users
            SET is_active = $1
            WHERE id = $2
        ",
        is_active,
        user_id
    )
    .execute(pool)
    .await
}