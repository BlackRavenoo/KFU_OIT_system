use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Serialize;
use sqlx::PgPool;

use crate::{auth::extractor::UserIdExtractor, schema::{common::UserId, tickets::TicketStatus}, utils::error_chain_fmt};

#[derive(Serialize)]
struct UserStats {
    pub active_tickets_count: i64,
    pub closed_tickets_count: i64,
    pub cancelled_tickets_count: i64,
}

#[derive(thiserror::Error)]
pub enum GetStatsError {
    #[error("User unauthorized")]
    Unauthorized,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetStatsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetStatsError {
    fn status_code(&self) -> StatusCode {
        match self {
            GetStatsError::Unauthorized => StatusCode::UNAUTHORIZED,
            GetStatsError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn get_stats(
    user_id: UserIdExtractor,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, GetStatsError> {
    let stats = get_user_stats(&pool, user_id.0).await
        .context("Failed to get user stats")?;


    Ok(HttpResponse::Ok().json(stats))
}

#[tracing::instrument(
    name = "Get user stats from the database.",
    skip(pool)
)]
async fn get_user_stats(pool: &PgPool, user_id: UserId) -> Result<UserStats, sqlx::Error> {
    sqlx::query_as!(
        UserStats,
        r#"
            SELECT
                COALESCE(COUNT(t.id) FILTER (WHERE t.status = $1), 0) AS "active_tickets_count!",
                COALESCE(COUNT(t.id) FILTER (WHERE t.status = $2), 0) AS "closed_tickets_count!",
                COALESCE(COUNT(t.id) FILTER (WHERE t.status = $3), 0) AS "cancelled_tickets_count!"
            FROM tickets t
            LEFT JOIN tickets_users tu ON t.id = tu.ticket_id
            WHERE tu.assigned_to = $4
        "#,
        TicketStatus::InProgress as i16,
        TicketStatus::Closed as i16,
        TicketStatus::Cancelled as i16,
        user_id
    )
    .fetch_one(pool)
    .await
}