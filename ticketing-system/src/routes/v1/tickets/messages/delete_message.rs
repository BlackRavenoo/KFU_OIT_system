use actix_web::{HttpResponse, ResponseError, http::StatusCode, web};
use anyhow::Context;
use sqlx::{PgPool, postgres::PgQueryResult};

use crate::{auth::{extractor::{UserIdExtractor, UserRoleExtractor}, types::UserRole}, schema::{common::UserId, tickets::{MessageId, TicketId}}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum DeleteMessageError {
    #[error("Message not found")]
    NotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for DeleteMessageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for DeleteMessageError {
    fn status_code(&self) -> StatusCode {
        match self {
            DeleteMessageError::NotFound => StatusCode::NOT_FOUND,
            DeleteMessageError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn delete_message(
    pool: web::Data<PgPool>,
    path: web::Path<(TicketId, MessageId)>,
    user_id: UserIdExtractor,
    user_role: UserRoleExtractor,
) -> Result<HttpResponse, DeleteMessageError> {
    let (ticket_id, message_id) = path.into_inner();

    let res = delete(
        &pool,
        ticket_id,
        message_id,
        user_id.0,
        user_role.0
    ).await
    .context("Failed to delete message")?;

    if res.rows_affected() == 0 {
        return Err(DeleteMessageError::NotFound)
    }

    Ok(HttpResponse::Ok().finish())
}

async fn delete(
    pool: &PgPool,
    ticket_id: TicketId,
    message_id: MessageId,
    user_id: UserId,
    user_role: UserRole,
) -> Result<PgQueryResult, sqlx::Error> {
    if !user_role.has_access(UserRole::Employee) {
        sqlx::query!(
            "
                DELETE FROM ticket_messages
                WHERE id = $1 AND ticket_id = $2 AND user_id = $3
            ",
            message_id,
            ticket_id,
            user_id
        )
    } else {
        sqlx::query!(
            "
                DELETE FROM ticket_messages
                WHERE id = $1 AND ticket_id = $2
            ",
            message_id,
            ticket_id
        )
    }
    .execute(pool)
    .await
}