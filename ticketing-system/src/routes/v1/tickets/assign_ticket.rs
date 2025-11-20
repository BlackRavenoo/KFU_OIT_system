use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{auth::extractor::UserIdExtractor, schema::{common::UserId, tickets::{TicketId, TicketStatus}}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum AssignTicketError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for AssignTicketError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for AssignTicketError {}

pub async fn assign_ticket_to_self(
    id: web::Path<TicketId>,
    user_id: UserIdExtractor,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AssignTicketError> {
    let ticket_id = id.into_inner();

    assign_ticket(&pool, ticket_id, user_id.0).await?;

    Ok(HttpResponse::Ok().finish())
}

pub async fn assign_ticket_to_user(
    path: web::Path<(TicketId, UserId)>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, AssignTicketError> {
    let (ticket_id, user_id) = path.into_inner();

    assign_ticket(&pool, ticket_id, user_id).await?;

    Ok(HttpResponse::Ok().finish())
}

async fn assign_ticket(
    pool: &PgPool,
    ticket_id: TicketId,
    user_id: UserId,
) -> Result<(), AssignTicketError> {
    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    assign(&mut transaction, ticket_id, user_id).await
        .context("Failed to assign ticket")?;

    update_status(&mut transaction, ticket_id).await
        .context("Failed to update status")?;

    transaction.commit().await
        .context("Failed to commit SQL transaction to assign ticket")?;

    Ok(())
}

#[tracing::instrument(
    name = "Assign ticket to a user in the database",
    skip(transaction)
)]
async fn assign(
    transaction: &mut Transaction<'_, Postgres>,
    ticket_id: TicketId,
    user_id: UserId
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
            INSERT INTO tickets_users(assigned_to, ticket_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        "#,
        user_id,
        ticket_id
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
            WHERE id = $2 AND status = $3
        "#,
        TicketStatus::InProgress as i16,
        ticket_id,
        TicketStatus::Open as i16
    )
    .execute(transaction.as_mut())
    .await?;

    Ok(())
}