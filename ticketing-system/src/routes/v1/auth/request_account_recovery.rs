use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use rand::{RngExt as _, distr::Alphanumeric, rng};
use sailfish::Template;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{
    domain::email::Email,
    email_client::EmailClient,
    schema::action_token::ActionTokenKind,
    services::action_token::ActionTokenStore,
    startup::ApplicationBaseUrl,
    templates::ResetPasswordTemplate,
    utils::error_chain_fmt,
};

const PASSWORD_RECOVERY_TTL: u64 = 60 * 60;

#[derive(Debug, Deserialize, Validate)]
pub struct RequestAccountRecoverySchema {
    #[garde(dive)]
    pub email: Email,
}

#[derive(thiserror::Error)]
pub enum RequestAccountRecoveryError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for RequestAccountRecoveryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for RequestAccountRecoveryError {}

pub async fn request_account_recovery(
    Json(schema): Json<RequestAccountRecoverySchema>,
    token_store: web::Data<ActionTokenStore>,
    base_url: web::Data<ApplicationBaseUrl>,
    email_client: web::Data<dyn EmailClient>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, RequestAccountRecoveryError> {
    let user = get_user_by_email(&pool, &schema.email)
        .await
        .context("Failed to find user by email")?;

    if user.is_none() {
        return Ok(HttpResponse::Ok().finish());
    }

    let email_ref = schema.email.as_ref();

    let token = if let Some(existing) = token_store
        .get_token(ActionTokenKind::PasswordRecovery, email_ref)
        .await? {
        existing
    } else {
        generate_token()
    };

    token_store.save(
        ActionTokenKind::PasswordRecovery,
        &token,
        email_ref,
        Some(PASSWORD_RECOVERY_TTL),
    )
    .await?;

    send_recovery_email(
        email_client.as_ref(),
        &schema.email,
        base_url.0.as_str(),
        &token,
    )
    .await?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(name = "Get active user by email", skip(pool))]
async fn get_user_by_email(pool: &PgPool, email: &Email) -> Result<Option<i32>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT id
        FROM users
        WHERE email = $1 AND is_active",
        email.as_ref()
    )
    .fetch_optional(pool)
    .await
}

#[tracing::instrument(name = "Send account recovery email", skip(email_client, base_url))]
async fn send_recovery_email(
    email_client: &dyn EmailClient,
    email: &Email,
    base_url: &str,
    token: &str,
) -> Result<(), anyhow::Error> {
    let link = format!("{}/reset-password?token={}", base_url, token);

    let template = ResetPasswordTemplate {
        base_url,
        link: link.clone(),
    };

    let html = template
        .render()
        .context("Failed to render account recovery template")?;

    email_client
        .send_email(
            email,
            "Восстановление аккаунта",
            &html,
            &format!(
                "Для восстановления аккаунта перейдите по ссылке: {}",
                link
            ),
        )
        .await
        .context("Failed to send account recovery email")
}

fn generate_token() -> String {
    let mut rng = rng();

    std::iter::repeat_with(|| rng.sample(Alphanumeric))
        .map(char::from)
        .take(32)
        .collect()
}
