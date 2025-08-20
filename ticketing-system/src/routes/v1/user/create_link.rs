use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use uuid::Uuid;

use crate::{domain::email::Email, email_client::{mailersend::MailerSendClient, EmailClient}, services::registration_token::RegistrationTokenStore, startup::ApplicationBaseUrl, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct CreateRegisterLinkSchema {
    pub email: Email
}

#[derive(thiserror::Error)]
pub enum CreateLinkError {
    #[error(transparent)]
    UnexpectedError(#[from] anyhow::Error)
}

impl std::fmt::Debug for CreateLinkError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateLinkError {
    fn status_code(&self) -> StatusCode {
        match self {
            CreateLinkError::UnexpectedError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn create_register_link(
    web::Json(schema): web::Json<CreateRegisterLinkSchema>,
    reg_store: web::Data<RegistrationTokenStore>,
    base_url: web::Data<ApplicationBaseUrl>,
    email_client: web::Data<MailerSendClient>,
) -> Result<HttpResponse, CreateLinkError> {
    let token = Uuid::new_v4().to_string();
    
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