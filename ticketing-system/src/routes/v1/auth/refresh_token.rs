use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use sqlx::PgPool;

use crate::{auth::{jwt::JwtService, token_store::{TokenStore, TokenStoreError}, types::{UserRole, UserStatus}}, schema::{auth::{RefreshTokenRequest, TokenResponse}, common::UserId}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum RefreshTokenError {
    #[error("User account is deactivated")]
    UserAccountDeactivated,
    #[error("{0}")]
    TokenStore(#[from] TokenStoreError),
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for RefreshTokenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for RefreshTokenError {
    fn status_code(&self) -> StatusCode {
        match self {
            RefreshTokenError::UserAccountDeactivated => StatusCode::FORBIDDEN,
            RefreshTokenError::TokenStore(e) => e.status_code(),
            RefreshTokenError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn refresh_token(
    req: web::Json<RefreshTokenRequest>,
    token_store: web::Data<TokenStore>,
    pool: web::Data<PgPool>,
    jwt_service: web::Data<JwtService>,
) -> Result<HttpResponse, RefreshTokenError> {
    let token_data = token_store.get_del_refresh_token(&req.refresh_token, &req.fingerprint).await?;

    let (role, status) = get_user_role_and_status(&pool, token_data.user_id)
        .await
        .context("Failed to get user role and status from database.")?;

    if !status.can_auth() {
        return Err(RefreshTokenError::UserAccountDeactivated)
    }

    let access_token = jwt_service.create_access_token(token_data.user_id, role)
        .context("Failed to create access token.")?;

    let refresh_token = token_store.generate_refresh_token(&token_data)
        .await
        .context("Failed to generate refresh token.")?;

    Ok(HttpResponse::Ok().json(TokenResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: jwt_service.access_token_lifetime.num_seconds()
    }))
}

#[tracing::instrument(
    name = "Get user role and status from database.",
    skip(pool)
)]
async fn get_user_role_and_status(pool: &PgPool, user_id: UserId) -> Result<(UserRole, UserStatus), sqlx::Error> {
    let rec = sqlx::query!(
        "SELECT role, status FROM users
        WHERE id = $1",
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok((UserRole::from(rec.role), UserStatus::from(rec.status)))
}