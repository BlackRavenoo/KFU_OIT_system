use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{auth::extractor, domain::password::Password, schema::common::UserId, utils::{error_chain_fmt, is_password_valid}};


#[derive(Deserialize)]
pub struct ChangePasswordSchema {
    pub current_password: String,
    pub new_password: Password,
}

#[derive(thiserror::Error)]
pub enum ChangePasswordError {
    #[error("Invalid password")]
    InvalidPassword,
    #[error(transparent)]
    UnexpectedError(#[from] anyhow::Error)
}

impl std::fmt::Debug for ChangePasswordError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ChangePasswordError {
    fn status_code(&self) -> StatusCode {
        match self {
            ChangePasswordError::InvalidPassword => StatusCode::BAD_REQUEST,
            ChangePasswordError::UnexpectedError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn change_password(
    user_id: extractor::UserId,
    web::Json(req): web::Json<ChangePasswordSchema>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, ChangePasswordError> {
    let user_id = match user_id.0 {
        Some(id) => id,
        None => return Ok(HttpResponse::Unauthorized().finish())
    };

    let current_password_hash = get_current_password(user_id, &pool).await
        .context("Failed to get password from database.")?;

    if !is_password_valid(
        &req.current_password,
        &current_password_hash
    ).context("Failed to check password")? {
        return Err(ChangePasswordError::InvalidPassword)
    };

    update_password(user_id, req.new_password, &pool).await?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Get current password hash from database",
    skip(pool)
)]
async fn get_current_password(user_id: UserId, pool: &PgPool) -> Result<String, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
            SELECT password_hash
            FROM users
            WHERE id = $1
        "#,
        user_id
    )
    .fetch_one(pool)
    .await
}
    
#[tracing::instrument(
    name = "Update password in the database",
    skip(pool, password)
)]
async fn update_password(user_id: UserId, password: Password, pool: &PgPool) -> Result<(), anyhow::Error> {
    let password_hash = password.hash()?;
    
    sqlx::query!(
        "UPDATE users
        SET password_hash = $1
        WHERE id = $2",
        password_hash,
        user_id
    )
    .execute(pool)
    .await
    .context("Failed to update password in the database")?;

    Ok(())
}