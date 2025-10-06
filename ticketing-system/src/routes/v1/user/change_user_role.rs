use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::{postgres::PgQueryResult, PgPool};

use crate::{auth::{extractor::UserRoleExtractor, types::UserRole}, schema::common::UserId, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct ChangeRoleSchema {
    pub id: UserId,
    pub role: UserRole,
}

#[derive(thiserror::Error)]
pub enum ChangeRoleError {
    #[error("Insufficient permissions to change user role")]
    InsufficientPermissions,
    #[error("User not found")]
    UserNotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for ChangeRoleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ChangeRoleError {
    fn status_code(&self) -> StatusCode {
        match self {
            ChangeRoleError::InsufficientPermissions => StatusCode::FORBIDDEN,
            ChangeRoleError::UserNotFound => StatusCode::BAD_REQUEST,
            ChangeRoleError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn change_user_role(
    web::Json(schema): web::Json<ChangeRoleSchema>,
    role: UserRoleExtractor,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, ChangeRoleError> {
    if role.0 <= schema.role {
        return Err(ChangeRoleError::InsufficientPermissions)
    }

    let res = change_role(schema.id, schema.role, &pool).await
        .context("Failed to change user role in the database.")?;

    if res.rows_affected() == 0 {
        return Err(ChangeRoleError::UserNotFound)
    }

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Change user role",
    skip(pool)
)]
async fn change_role(
    id: UserId,
    role: UserRole,
    pool: &PgPool,
) -> Result<PgQueryResult, sqlx::Error> {
    sqlx::query!(
        r#"
            UPDATE users
            SET role = $1
            WHERE id = $2
        "#,
        role as i16,
        id
    )
    .execute(pool)
    .await
}