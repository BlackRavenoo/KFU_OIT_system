use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Serialize;
use sqlx::PgPool;

use crate::{auth::{extractor, types::UserRole}, schema::common::UserId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum MeError {
    #[error("Missing token")]
    MissingToken,
    #[error("User does not exist")]
    UserNotExist,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for MeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for MeError {
    fn status_code(&self) -> StatusCode {
        match self {
            MeError::MissingToken | MeError::UserNotExist => StatusCode::UNAUTHORIZED,
            MeError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct User {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub role: UserRole,
}

pub async fn me(
    id: extractor::UserId,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, MeError> {
    let user_id = match id.0 {
        Some(id) => id,
        None => return Err(MeError::MissingToken)
    };

    let user =  get_user_info(&pool, user_id).await
        .context("Failed to get user info")?
        .ok_or(MeError::UserNotExist)?;
    
    Ok(HttpResponse::Ok().json(user))
}

#[tracing::instrument(
    name = "Get user info from the database",
    skip(pool)
)]
async fn get_user_info(pool: &PgPool, user_id: UserId) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        SELECT id, name, email, role
        FROM users
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_optional(pool)
    .await
}