use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Serialize;
use sqlx::PgPool;

use crate::{auth::{extractor, types::UserRole}, schema::common::UserId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum MeError {
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
            MeError::UserNotExist => StatusCode::UNAUTHORIZED,
            MeError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct User {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub login: String,
    pub role: UserRole,
}

pub async fn me(
    id: extractor::UserId,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, MeError> {
    let user =  get_user_info(&pool, id.0).await
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
        SELECT id, name, login, email, role
        FROM users
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_optional(pool)
    .await
}