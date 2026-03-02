use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::QsQuery;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::{schema::{assets::CategoryId, common::PaginationResult}, utils::error_chain_fmt};

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
}

#[derive(thiserror::Error)]
pub enum GetCategoriesError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

#[derive(Debug)]
struct CategoryWithMeta {
    id: CategoryId,
    name: String,
    color: String,
    notes: Option<String>,
    total_items: i64
}

#[derive(Serialize, Debug)]
struct Category {
    id: CategoryId,
    name: String,
    color: String,
    notes: Option<String>,
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

    let total_items = categories.first()
        .map(|meta| meta.total_items)
        .unwrap_or(0);

    let items = categories.into_iter().map(|cat| Category {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        notes: cat.notes
    })
    .collect();

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items as u64,
        schema.page_size,
        items
    )))
}

#[tracing::instrument(
    name = "Fetch categories from database",
    skip(pool)
)]
async fn fetch_categories(
    pool: &PgPool,
    schema: &GetCategoriesSchema,
) -> Result<Vec<CategoryWithMeta>, sqlx::Error> {
    sqlx::query_as!(
        CategoryWithMeta,
        r#"SELECT
            id,
            name,
            color,
            notes,
            COUNT(*) OVER() as "total_items!"
        FROM asset_categories
        LIMIT $1 OFFSET $2"#,
        schema.page_size as i64,
        schema.page_size as i64 * (schema.page - 1) as i64
    )
    .fetch_all(pool)
    .await
}