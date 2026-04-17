use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::QsQuery;
use moka::future::Cache;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, prelude::FromRow};

use crate::{build_where_condition, utils::error_chain_fmt};

#[derive(Debug, Deserialize, PartialEq, Eq, Hash, Validate)]
pub struct GetMetricsSchema {
    #[garde(range(min = 1))]
    pub building_id: Option<i16>,
    #[garde(range(min = 1))]
    pub department_id: Option<i16>,
}

#[derive(Clone, Serialize, FromRow)]
pub struct TicketsMetrics {
    pub month: i16,
    pub total: i64,
    pub closed: i64,

    pub avg_frt: i64,
    pub p50_frt: i64,
    pub p90_frt: i64,
    pub p95_frt: i64,

    pub avg_mttr: i64,
    pub p50_mttr: i64,
    pub p90_mttr: i64,
    pub p95_mttr: i64,

    pub sla_breaches: i64,
}

#[derive(thiserror::Error)]
pub enum GetMetricsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl ResponseError for GetMetricsError {}

impl std::fmt::Debug for GetMetricsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub async fn get_metrics(
    pool: web::Data<PgPool>,
    cache: web::Data<Cache<GetMetricsSchema, Vec<TicketsMetrics>>>,
    schema: QsQuery<GetMetricsSchema>,
) -> Result<HttpResponse, GetMetricsError> {
    let metrics = if let Some(metrics) = cache.get(&schema.0).await {
        metrics
    } else {
        let metrics = fetch_metrics(&schema, &pool).await
            .context("Failed to fetch ticket metrics")?;

        cache.insert(schema.0, metrics.clone()).await;

        metrics
    };

    Ok(HttpResponse::Ok().json(metrics))
}

#[tracing::instrument(
    name = "Get metrics from database",
    skip_all
)]
async fn fetch_metrics(
    schema: &GetMetricsSchema,
    pool: &PgPool,
) -> Result<Vec<TicketsMetrics>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        r#"
        SELECT
            EXTRACT(MONTH FROM created_at)::SMALLINT AS month,
            COUNT(*) AS total,
            COUNT(CASE WHEN status = 1 THEN 1 END) AS closed,
            COALESCE(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))), 0)::BIGINT AS avg_frt,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_response_at - created_at))), 0)::BIGINT AS p50_frt,
            COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_response_at - created_at))), 0)::BIGINT AS p90_frt,
            COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_response_at - created_at))), 0)::BIGINT AS p95_frt,
            COALESCE(AVG(EXTRACT(EPOCH FROM (closed_at - created_at))), 0)::BIGINT AS avg_mttr,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (closed_at - created_at))), 0)::BIGINT AS p50_mttr,
            COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (closed_at - created_at))), 0)::BIGINT AS p90_mttr,
            COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (closed_at - created_at))), 0)::BIGINT AS p95_mttr,
            COUNT(*) FILTER (
                WHERE closed_at - created_at > INTERVAL '2 hours' AND NOT is_long_term AND planned_at IS NULL
            ) AS sla_breaches
        FROM tickets
        "#
    );

    let mut has_filters = false;

    build_where_condition!(builder, has_filters, schema.building_id, "building_id", "=");
    build_where_condition!(builder, has_filters, schema.department_id, "department_id", "=");

    _ = has_filters;

    builder.push(" GROUP BY month ORDER BY month");

    builder.build_query_as::<TicketsMetrics>()
        .fetch_all(pool)
        .await
}