use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::QsQuery;
use serde::Deserialize;
use sqlx::{PgPool, Postgres, QueryBuilder};

use crate::{schema::{assets::{Category, CategoryId}, common::{PaginationResult, SortOrder}}, utils::error_chain_fmt};

fn default_page_size() -> i8 { 50 }

fn default_page() -> CategoryId { 1 }

#[derive(Deserialize, Debug, Validate)]
pub struct GetCategoriesSchema {
    #[garde(range(min = 1))]
    #[serde(default = "default_page")]
    pub page: CategoryId,
    #[garde(range(min = 10, max = 100))]
    #[serde(default = "default_page_size")]
    pub page_size: i8,
    #[garde(length(min = 1))]
    pub name: Option<String>,
    #[garde(skip)]
    #[serde(default)]
    pub sort_order: SortOrder,
}

#[derive(thiserror::Error)]
pub enum GetCategoriesError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetCategoriesError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetCategoriesError {}

pub async fn get_categories(
    pool: web::Data<PgPool>,
    QsQuery(schema): QsQuery<GetCategoriesSchema>,
) -> Result<HttpResponse, GetCategoriesError> {
    let categories = fetch_categories(
        &pool,
        &schema
    )
    .await
    .context("Failed to fetch categories")?;

    let total_items = get_categories_count(
        &pool,
        &schema
    )
    .await
    .context("Failed to get categories count")?;

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items,
        schema.page_size,
        categories
    )))
}

#[tracing::instrument(
    name = "Fetch categories from database",
    skip(pool)
)]
async fn fetch_categories(
    pool: &PgPool,
    schema: &GetCategoriesSchema,
) -> Result<Vec<Category>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT
            id,
            name,
            color,
            notes
        FROM asset_categories "
    );

    apply_filters(&mut builder, schema);

    builder.push("ORDER BY id ")
        .push(schema.sort_order.as_str())
        .push(" LIMIT ")
        .push_bind(schema.page_size as i64)
        .push(" OFFSET ")
        .push_bind(schema.page_size as i64 * (schema.page - 1) as i64)
        .build_query_as::<Category>()
        .fetch_all(pool)
        .await
}

#[tracing::instrument(
    name = "Get categories count from database",
    skip(pool)
)]
async fn get_categories_count(
    pool: &PgPool,
    schema: &GetCategoriesSchema
) -> Result<u64, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT COUNT(*) as count
        FROM asset_categories "
    );

    apply_filters(&mut builder, schema);

    builder.build_query_scalar()
        .fetch_one(pool)
        .await
        .map(|count: i64| count as u64)
}

fn apply_filters<'a>(
    builder: &mut QueryBuilder<'a, Postgres>,
    schema: &'a GetCategoriesSchema
) {
    if let Some(name) = &schema.name {
        let name = format!("%{}%", name);
        builder.push("WHERE name ILIKE ").push_bind(name).push(" ");
    }
}