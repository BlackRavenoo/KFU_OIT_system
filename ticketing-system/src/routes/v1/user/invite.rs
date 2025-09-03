use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use rand::{distr::Alphanumeric, rng, Rng as _};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::email::Email, email_client::{mailersend::MailerSendClient, EmailClient}, services::registration_token::RegistrationTokenStore, startup::ApplicationBaseUrl, utils::error_chain_fmt};

#[derive(Debug, Deserialize)]
pub struct InviteUserSchema {
    pub email: Email
}

#[derive(thiserror::Error)]
pub enum InviteUserError {
    #[error("User with this email already exists")]
    EmailAlreadyExists,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for InviteUserError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for InviteUserError {
    fn status_code(&self) -> StatusCode {
        match self {
            InviteUserError::EmailAlreadyExists => StatusCode::BAD_REQUEST,
            InviteUserError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[tracing::instrument(
    name = "Invite a new user",
    skip(email_client, base_url, reg_store)
)]
pub async fn invite_user(
    web::Json(schema): web::Json<InviteUserSchema>,
    reg_store: web::Data<RegistrationTokenStore>,
    base_url: web::Data<ApplicationBaseUrl>,
    email_client: web::Data<MailerSendClient>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, InviteUserError> {
    if is_email_exists(&pool, &schema.email)
        .await
        .context("Failed to check email existence")? {
            return Err(InviteUserError::EmailAlreadyExists)
    }

    let token = if let Some(token) = reg_store.get_token(&schema.email).await? {
        token
    } else {
        generate_token()
    };
    
    reg_store.save_token(&token, &schema.email).await?;

    send_confirmation_email(
        &email_client,
        &schema.email,
        base_url.0.as_str(),
        &token
    )
    .await
    .context("Failed to send a confirmation email.")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Send a confirmation email to a new user",
    skip(email_client, base_url)
)]
async fn send_confirmation_email(
    email_client: &MailerSendClient,
    email: &Email,
    base_url: &str,
    token: &str,
) -> Result<(), reqwest::Error> {
    let link = format!("{}/confirm?token={}", base_url, token);

    email_client.send_email(
        email,
        "Ссылка с регистрацией.",
        &format!(
            "Добро пожаловать!<br />\
            Нажми <a href=\"{}\">сюда</a>, чтобы продолжить регистрацию аккаунта.",
            link
        ),
        &format!(
            "Добро пожаловать!\nПосети {}, чтобы продолжить регистрацию аккаунта.",
            link
        )
    )
    .await
}

#[tracing::instrument(
    name = "Check if email already exists in database",
    skip(pool)
)]
async fn is_email_exists(
    pool: &PgPool,
    email: &Email,
) -> Result<bool, sqlx::Error> {
    let exists = sqlx::query_scalar!(
        r#"
            SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)
        "#,
        email.as_ref()
    )
    .fetch_one(pool)
    .await?;

    Ok(exists.unwrap_or(false))
}

fn generate_token() -> String {
    let mut rng = rng();
    std::iter::repeat_with(|| rng.sample(Alphanumeric))
        .map(char::from)
        .take(32)
        .collect()
}
