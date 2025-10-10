use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::{postgres::PgQueryResult, PgPool};

use crate::{auth::{extractor::{UserIdExtractor, UserRoleExtractor}, types::{UserRole, UserStatus}}, schema::common::UserId, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct ChangeStatusSchema {
    pub id: UserId,
    pub status: UserStatus,
}

#[derive(thiserror::Error)]
pub enum ChangeStatusError {
    #[error("Insufficient permissions to change user role")]
    InsufficientPermissions,
    #[error("User not found")]
    UserNotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for ChangeStatusError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ChangeStatusError {
    fn status_code(&self) -> StatusCode {
        match self {
            ChangeStatusError::InsufficientPermissions => StatusCode::FORBIDDEN,
            ChangeStatusError::UserNotFound => StatusCode::BAD_REQUEST,
            ChangeStatusError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn change_user_status(
    role: UserRoleExtractor,
    id: UserIdExtractor,
    web::Json(schema): web::Json<ChangeStatusSchema>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, ChangeStatusError> {
    if role.0 < UserRole::Moderator || id.0 != schema.id {
        return Err(ChangeStatusError::InsufficientPermissions)
    }

    let res = change_status(schema.id, schema.status, &pool).await
        .context("Failed to change user status in the database.")?;

    if res.rows_affected() == 0 {
        return Err(ChangeStatusError::UserNotFound)
    }

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Change user status",
    skip(pool)
)]
async fn change_status(
    id: UserId,
    status: UserStatus,
    pool: &PgPool,
) -> Result<PgQueryResult, sqlx::Error> {
    sqlx::query!(
        r#"
            UPDATE users
            SET status = $1
            WHERE id = $2
        "#,
        status as i16,
        id
    )
    .execute(pool)
    .await
}