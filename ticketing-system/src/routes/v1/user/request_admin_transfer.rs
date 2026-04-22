use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use rand::{RngExt as _, distr::Alphanumeric, rng};
use sailfish::Template;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{
    auth::types::UserRole,
    auth::extractor::UserIdExtractor,
    domain::email::Email,
    email_client::EmailClient,
    schema::common::UserId,
    schema::action_token::ActionTokenKind,
    services::action_token::ActionTokenStore,
    startup::ApplicationBaseUrl,
    templates::AdminTransferTemplate,
    utils::error_chain_fmt,
};

const ADMIN_TRANSFER_TTL: u64 = 60 * 60 * 24;

#[derive(Deserialize)]
pub struct RequestAdminTransferSchema {
    pub user_id: UserId,
}

#[derive(sqlx::FromRow)]
struct TransferTarget {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub role: i16,
    pub is_active: bool,
}

#[derive(thiserror::Error)]
pub enum RequestAdminTransferError {
    #[error("Target user not found")]
    TargetUserNotFound,
    #[error("Cannot transfer admin role to this user")]
    InvalidTarget,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for RequestAdminTransferError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for RequestAdminTransferError {
    fn status_code(&self) -> StatusCode {
        match self {
            RequestAdminTransferError::TargetUserNotFound => StatusCode::NOT_FOUND,
            RequestAdminTransferError::InvalidTarget => StatusCode::BAD_REQUEST,
            RequestAdminTransferError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn request_admin_transfer(
    web::Json(schema): web::Json<RequestAdminTransferSchema>,
    user_id: UserIdExtractor,
    token_store: web::Data<ActionTokenStore>,
    base_url: web::Data<ApplicationBaseUrl>,
    email_client: web::Data<dyn EmailClient>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, RequestAdminTransferError> {
    if schema.user_id == user_id.0 {
        return Err(RequestAdminTransferError::InvalidTarget);
    }

    let target = get_transfer_target(&pool, schema.user_id)
        .await
        .context("Failed to find transfer target")?
        .ok_or(RequestAdminTransferError::TargetUserNotFound)?;

    if !target.is_active || target.role == UserRole::Admin as i16 {
        return Err(RequestAdminTransferError::InvalidTarget);
    }

    let payload = format!("{}:{}", user_id.0, target.id);

    let token = if let Some(existing) = token_store
        .get_token(ActionTokenKind::AdminTransfer, &payload)
        .await?
    {
        existing
    } else {
        generate_token()
    };

    token_store
        .save(
            ActionTokenKind::AdminTransfer,
            &token,
            &payload,
            Some(ADMIN_TRANSFER_TTL),
        )
        .await?;

    let target_email = Email::parse(target.email).context("Invalid user email")?;

    send_admin_transfer_email(
        email_client.as_ref(),
        &target_email,
        &target.name,
        base_url.0.as_str(),
        &token,
    )
    .await?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(name = "Get target user for admin transfer", skip(pool))]
async fn get_transfer_target(
    pool: &PgPool,
    user_id: UserId,
) -> Result<Option<TransferTarget>, sqlx::Error> {
    sqlx::query_as!(
        TransferTarget,
        "SELECT id, name, email, role, is_active
        FROM users
        WHERE id = $1",
        user_id
    )
    .fetch_optional(pool)
    .await
}

#[tracing::instrument(name = "Send admin transfer email", skip(email_client, base_url))]
async fn send_admin_transfer_email(
    email_client: &dyn EmailClient,
    email: &Email,
    name: &str,
    base_url: &str,
    token: &str,
) -> Result<(), anyhow::Error> {
    let link = format!("{}/confirm-admin-transfer?token={}", base_url, token);

    let template = AdminTransferTemplate {
        base_url,
        link: link.clone(),
        user_name: name,
    };

    let html = template
        .render()
        .context("Failed to render admin transfer template")?;

    email_client
        .send_email(
            email,
            "Подтверждение передачи прав администратора",
            &html,
            &format!(
                "Для подтверждения передачи прав администратора перейдите по ссылке: {}",
                link
            ),
        )
        .await
        .context("Failed to send admin transfer email")
}

fn generate_token() -> String {
    let mut rng = rng();

    std::iter::repeat_with(|| rng.sample(Alphanumeric))
        .map(char::from)
        .take(32)
        .collect()
}
