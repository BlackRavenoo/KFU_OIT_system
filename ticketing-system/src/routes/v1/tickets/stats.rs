use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use moka::future::Cache;
use serde::Serialize;
use sqlx::PgPool;

use crate::{schema::tickets::TicketStatus, utils::error_chain_fmt};

#[derive(Clone, Serialize)]
pub struct TicketsStats {
    pub daily_tickets: i64,
    pub tickets_count: i64,
    pub percent_of_closed: f64,
}

#[derive(thiserror::Error)]
pub enum GetStatsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl ResponseError for GetStatsError {}

impl std::fmt::Debug for GetStatsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub async fn get_stats(
    pool: web::Data<PgPool>,
    cache: web::Data<Cache<(), TicketsStats>>,
) -> Result<HttpResponse, GetStatsError> {
    let stats = if let Some(stats) = cache.get(&()).await {
        stats
    } else {
        let stats = fetch_stats(&pool).await
            .context("Failed to fetch ticket stats")?;

        cache.insert((), stats.clone()).await;

        stats
    };

    Ok(HttpResponse::Ok().json(stats))
}

#[tracing::instrument(
    name = "Get stats from database",
    skip_all
)]
async fn fetch_stats(
    pool: &PgPool,
) -> Result<TicketsStats, sqlx::Error> {
    sqlx::query_as!(
        TicketsStats,
        r#"
            SELECT
            (
                SELECT COUNT(*)
                FROM tickets
                WHERE created_at >= NOW() - INTERVAL '1 day'
            ) AS "daily_tickets!",
            COUNT(*) AS "tickets_count!",
            CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE (COUNT(*) FILTER (WHERE status = $1)::float / COUNT(*) * 100)
            END AS "percent_of_closed!: f64"
            FROM tickets
        "#,
        TicketStatus::Closed as i16
    )
    .fetch_one(pool)
    .await
}