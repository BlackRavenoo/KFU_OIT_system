use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::QsQuery;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, QueryBuilder, prelude::FromRow};

use crate::{schema::{assets::StatusId, common::{PaginationResult, SortOrder}}, utils::error_chain_fmt};

fn default_page_size() -> i8 { 50 }

fn default_page() -> StatusId { 1 }

#[derive(Debug, Validate, Deserialize)]
pub struct GetStatusesSchema {
    #[garde(range(min = 1))]
    #[serde(default = "default_page")]
    pub page: StatusId,
    #[garde(range(min = 10, max = 100))]
    #[serde(default = "default_page_size")]
    pub page_size: i8,
    #[garde(length(min=1))]
    pub name: Option<String>,
    #[garde(skip)]
    #[serde(default)]
    pub sort_order: SortOrder,
}

#[derive(Debug, Serialize, FromRow)]
struct Status {
    id: StatusId,
    name: String,
    color: String,
}

#[derive(thiserror::Error)]
pub enum GetStatusesError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetStatusesError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetStatusesError {}

pub async fn get_statuses(
    pool: web::Data<PgPool>,
    QsQuery(schema): QsQuery<GetStatusesSchema>
) -> Result<HttpResponse, GetStatusesError> {
    let statuses = fetch_statuses(
        &pool,
        &schema
    )
    .await
    .context("Failed to get statuses")?;

    let total_items = get_statuses_count(
        &pool,
        &schema
    )
    .await
    .context("Failed to get statuses count")?;

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items,
        schema.page_size,
        statuses
    )))
}

#[tracing::instrument(
    name = "Fetch statuses from database",
    skip(pool)
)]
async fn fetch_statuses(
    pool: &PgPool,
    schema: &GetStatusesSchema,
) -> Result<Vec<Status>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT
            id,
            name,
            color
        FROM asset_statuses "
    );

    apply_filters(&mut builder, schema);

    builder.push("ORDER BY id ")
        .push(schema.sort_order.as_str())
        .push(" LIMIT ")
        .push_bind(schema.page_size as i64)
        .push(" OFFSET ")
        .push_bind(schema.page_size as i64 * (schema.page - 1) as i64)
        .build_query_as::<Status>()
        .fetch_all(pool)
        .await
}

#[tracing::instrument(
    name = "Get statuses count from database",
    skip(pool)
)]
async fn get_statuses_count(
    pool: &PgPool,
    schema: &GetStatusesSchema,
) -> Result<u64, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT COUNT(*) as count
        FROM asset_statuses "
    );

    apply_filters(&mut builder, schema);

    builder.build_query_scalar()
        .fetch_one(pool)
        .await
        .map(|count: i64| count as u64)
}

fn apply_filters<'a>(
    builder: &mut QueryBuilder<'a, Postgres>,
    schema: &'a GetStatusesSchema,
) {
    if let Some(name) = &schema.name {
        let name = format!("%{}%", name);

        builder.push("WHERE name ILIKE ")
            .push_bind(name)
            .push(" ");
    }
}