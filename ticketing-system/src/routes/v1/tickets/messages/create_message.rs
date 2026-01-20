use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{auth::{extractor::{UserIdExtractor, UserRoleExtractor}, types::UserRole}, schema::{common::UserId, notification::Notification, tickets::TicketId}, services::notification::NotificationService, utils::error_chain_fmt};

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
    notification_service: web::Data<NotificationService>,
    ticket_id: web::Path<TicketId>,
    web::Json(mut schema): web::Json<CreateMessageSchema>,
    user_id: UserIdExtractor,
    role: UserRoleExtractor,
) -> Result<HttpResponse, CreateMessageError> {
    if role.0 == UserRole::Client {
        schema.is_internal = false;
    }

    let ticket_id = ticket_id.into_inner();

    insert_message(
        &pool,
        ticket_id,
        user_id.0,
        &schema
    ).await
    .context("Failed to insert message")?;

    tokio::spawn(async move {
        if let Ok(user_ids) = get_user_ids(
            &pool,
            ticket_id,
            user_id.0,
        )
        .await {
            if !user_ids.is_empty() 
                && let Err(e) = notification_service.notify(
                    pool.as_ref(),
                    ticket_id,
                    &user_ids,
                    Notification::NewMessages {
                        count: 1
                    }
                )
                .await {
                    tracing::error!("Failed to create notifications: {:?}", e)
                };
        } else {
            tracing::error!("Failed to get user ids")
        }
    });

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

#[tracing::instrument(
    name = "Get user ids for notification",
    skip(pool)
)]
async fn get_user_ids(
    pool: &PgPool,
    ticket_id: TicketId,
    user_id: UserId,
) -> Result<Vec<UserId>, sqlx::Error> {
    sqlx::query!(
        r#"SELECT DISTINCT "user_id!"
        FROM (
            SELECT author_id AS "user_id!"
            FROM tickets
            WHERE id = $1 AND author_id IS NOT NULL

            UNION

            SELECT assigned_to AS "user_id!"
            FROM tickets_users
            WHERE ticket_id = $1
        )
        WHERE "user_id!" != $2
        "#,
        ticket_id,
        user_id
    )
    .fetch_all(pool)
    .await
    .map(|r| {
        r.into_iter().map(|r | r.user_id)
            .collect()
    })
}