use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{auth::{jwt::JwtService, token_store::TokenStore, types::{RefreshToken, UserRole, UserStatus}}, domain::email::Email, schema::auth::TokenResponse, utils::{error_chain_fmt, is_password_valid}};

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: Email,
    pub password: String,
    pub fingerprint: String,
}

struct User {
    pub id: i32,
    pub password_hash: String,
    pub role: UserRole,
    pub status: UserStatus,
}

#[derive(thiserror::Error)]
pub enum LoginError {
    #[error("User cannot be authorized")]
    UserCannotBeAuthorized,
    #[error("Invalid password")]
    PasswordNotValid,
    #[error("User does not exist")]
    UserNotExist,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for LoginError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for LoginError {
    fn status_code(&self) -> StatusCode {
        match self {
            LoginError::PasswordNotValid | LoginError::UserNotExist => StatusCode::UNAUTHORIZED,
            LoginError::UserCannotBeAuthorized => StatusCode::FORBIDDEN,
            LoginError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn login(
    web::Json(req): web::Json<LoginRequest>,
    pool: web::Data<PgPool>,
    jwt_service: web::Data<JwtService>,
    token_store: web::Data<TokenStore>
) -> Result<HttpResponse, LoginError> {
    let user = get_user(&pool, req.email)
        .await
        .context("Failed to get user from db")?
        .ok_or(LoginError::UserNotExist)?;

    if !is_password_valid(&req.password, &user.password_hash)
        .context("Failed to verify password")? {
        return Err(LoginError::PasswordNotValid);
    }

    if !user.status.can_auth() {
        return Err(LoginError::UserCannotBeAuthorized)
    }

    let resp = get_token_response(&jwt_service, &token_store, user, req.fingerprint)
        .await?;
    
    Ok(HttpResponse::Ok().json(resp))
    
}

#[tracing::instrument(
    name = "Get user from database",
    skip(pool)
)]
async fn get_user(pool: &PgPool, email: Email) -> Result<Option<User>, sqlx::Error> {
    let row = sqlx::query_as!(
        User,
        r#"SELECT id, password_hash, role, status FROM users WHERE email = $1"#,
        email.as_ref()
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(row)
}

#[tracing::instrument(
    name = "Get token response",
    skip_all,
    fields(id = %user.id, role = %user.role, status = %user.status)
)]
async fn get_token_response(jwt_service: &JwtService, token_store: &TokenStore, user: User, fingerprint: String) -> Result<TokenResponse, anyhow::Error> {

    let access_token = jwt_service.create_access_token(user.id, user.role)
        .context("Failed to create access token.")?;

    let refresh_token_data = RefreshToken {
        user_id: user.id,
        fingerprint,
    };

    let refresh_token = token_store.generate_refresh_token(&refresh_token_data).await
        .context("Failed to create refresh token")?;

    let resp = TokenResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: jwt_service.access_token_lifetime.num_seconds(),
    };

    Ok(resp)
}