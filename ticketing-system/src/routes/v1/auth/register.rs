use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::{login::Login, name::Name, password::Password}, services::registration_token::RegistrationTokenStore, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum RegisterError {
    #[error("Token not exists")]
    TokenNotExists,
    #[error("Email already in use")]
    EmailAlreadyExists,
    #[error("Login already in use")]
    LoginAlreadyExists,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for RegisterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for RegisterError {
    fn status_code(&self) -> StatusCode {
        match self {
            RegisterError::TokenNotExists => StatusCode::UNAUTHORIZED,
            RegisterError::EmailAlreadyExists | RegisterError::LoginAlreadyExists => StatusCode::BAD_REQUEST,
            RegisterError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Deserialize)]
pub struct RegisterForm {
    pub name: Name,
    pub login: Login,
    pub password: Password,
    pub token: String,
}

#[tracing::instrument(
    name = "Register new user",
    skip_all,
    fields(name = %data.name, token = %data.token)
)]
pub async fn register(
    web::Json(data): web::Json<RegisterForm>,
    pool: web::Data<PgPool>,
    store: web::Data<RegistrationTokenStore>,
) -> Result<HttpResponse, RegisterError> {
    let email = store.get_del_email(&data.token).await?
        .ok_or(RegisterError::TokenNotExists)?;

    let password_hash = data.password.hash()
        .context("Failed to hash password")?;

    let res = insert_new_user(&pool, data.name, &email, &data.login, &password_hash).await;

    if let Err(e) = &res
        && let Some(db_err) = e.as_database_error()
            && db_err.is_unique_violation()
                && let Some(constraint) = db_err.constraint() {
                    match constraint {
                        "users_email_key" => return Err(RegisterError::EmailAlreadyExists),
                        "user_login_key" => return Err(RegisterError::LoginAlreadyExists),
                        _ => ()
                    }
                };

    res.context("Failed to insert new user")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Insert new user into database",
    skip(pool, password_hash)
)]
async fn insert_new_user(pool: &PgPool, name: Name, email: &str, login: &Login, password_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO users (name, email, login, password_hash) 
        VALUES ($1, $2, $3, $4)
        "#,
        name.as_ref(),
        email,
        login.as_ref(),
        password_hash
    )
    .execute(pool)
    .await?;
    
    Ok(())
}