use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{auth::{extractor::{UserIdExtractor, UserRoleExtractor}, types::UserRole}, schema::{common::UserId, tickets::TicketId}, utils::error_chain_fmt};

#[derive(Deserialize, Debug)]
pub struct CreateMessageSchema {
    pub message: String,
    #[serde(default)]
    pub is_internal: bool,
}

#[derive(thiserror::Error)]
pub enum CreateMessageError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for CreateMessageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateMessageError {}

pub async fn create_message(
    pool: web::Data<PgPool>,
    ticket_id: web::Path<TicketId>,
    web::Json(mut schema): web::Json<CreateMessageSchema>,
    user_id: UserIdExtractor,
    role: UserRoleExtractor,
) -> Result<HttpResponse, CreateMessageError> {
    if role.0 == UserRole::Client {
        schema.is_internal = false;
    }

    insert_message(
        &pool,
        ticket_id.into_inner(),
        user_id.0,
        &schema
    ).await
    .context("Failed to insert message")?;

    Ok(HttpResponse::Created().finish())
}

#[tracing::instrument(
    name = "Insert message into database",
    skip(pool)
)]
async fn insert_message(
    pool: &PgPool,
    ticket_id: TicketId,
    user_id: UserId,
    schema: &CreateMessageSchema,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "
            INSERT INTO ticket_messages(ticket_id, user_id, message_text, is_internal)
            VALUES ($1, $2, $3, $4)
        ",
        ticket_id,
        user_id,
        schema.message,
        schema.is_internal
    )
    .execute(pool)
    .await?;

    Ok(())
}