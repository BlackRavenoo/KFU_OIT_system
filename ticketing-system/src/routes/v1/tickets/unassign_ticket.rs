use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{auth::extractor, schema::{common::UserId, tickets::{TicketId, TicketStatus}}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum UnassignTicketError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for UnassignTicketError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UnassignTicketError {
    fn status_code(&self) -> StatusCode {
        match self {
            UnassignTicketError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn unassign_ticket(
    id: web::Path<TicketId>,
    user_id: extractor::UserId,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, UnassignTicketError> {
    let ticket_id = id.into_inner();

    let user_id = match user_id.0 {
        Some(id) => id,
        None => return Ok(HttpResponse::Unauthorized().finish()),
    };

    let mut transaction = pool.begin()
        .await
        .context("Failed to acquire a Postgres connection from the pool.")?;

    unassign(&mut transaction, ticket_id, user_id).await
        .context("Failed to unassign ticket.")?;

    update_status(&mut transaction, ticket_id).await
        .context("Failed to update ticket status")?;

    transaction.commit()
        .await
        .context("Failed to commit SQL transaction to unassign ticket.")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Unassign ticket from a user in the database",
    skip(transaction)
)]
async fn unassign(transaction: &mut Transaction<'_, Postgres>, ticket_id: TicketId, user_id: UserId) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
            DELETE FROM tickets_users
            WHERE ticket_id = $1 AND assigned_to = $2
        "#,
        ticket_id,
        user_id,
    )
    .execute(transaction.as_mut())
    .await?;

    Ok(())
}

#[tracing::instrument(
    name = "Update ticket status in the database",
    skip(transaction)
)]
async fn update_status(transaction: &mut Transaction<'_, Postgres>, ticket_id: TicketId) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
            UPDATE tickets
            SET status = $1
            WHERE id = $2 AND status = $3 AND NOT EXISTS (
                SELECT 1
                FROM tickets_users tu
                WHERE tu.ticket_id = tickets.id
            )
        "#,
        TicketStatus::Open as i16,
        ticket_id,
        TicketStatus::InProgress as i16
    )
    .execute(transaction.as_mut())
    .await?;

    Ok(())
}