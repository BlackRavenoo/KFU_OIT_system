use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::QsQuery;
use serde::Deserialize;
use sqlx::{PgPool, Postgres, QueryBuilder};

use crate::{build_where_condition, schema::{assets::{CategoryId, Model, ModelId}, common::{PaginationResult, SortOrder}}, utils::error_chain_fmt};

fn default_page_size() -> i8 { 50 }

fn default_page() -> ModelId { 1 }

#[derive(Deserialize, Debug, Validate)]
pub struct GetModelsSchema {
    #[garde(range(min = 1))]
    #[serde(default = "default_page")]
    pub page: ModelId,
    #[garde(range(min = 10, max = 100))]
    #[serde(default = "default_page_size")]
    pub page_size: i8,
    #[garde(length(min=1))]
    pub name: Option<String>,
    #[garde(skip)]
    #[serde(default)]
    pub sort_order: SortOrder,
    #[garde(range(min = 1))]
    pub category: Option<CategoryId>,
}

#[derive(thiserror::Error)]
pub enum GetModelsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetModelsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetModelsError {}

pub async fn get_models(
    pool: web::Data<PgPool>,
    QsQuery(schema): QsQuery<GetModelsSchema>,
) -> Result<HttpResponse, GetModelsError> {
    let models = fetch_models(
        &pool,
        &schema
    )
    .await
    .context("Failed to fetch models")?;

    let total_items = get_models_count(
        &pool,
        &schema
    )
    .await
    .context("Failed to get models count")?;

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items,
        schema.page_size,
        models
    )))
}

#[tracing::instrument(
    name = "Fetch models from database",
    skip(pool)
)]
async fn fetch_models(
    pool: &PgPool,
    schema: &GetModelsSchema,
) -> Result<Vec<Model>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT
            am.id,
            am.name,
            json_build_object(
                'id', ac.id,
                'name', ac.name,
                'color', ac.color,
                'notes', ac.notes
            ) AS category
        FROM asset_models am
        JOIN asset_categories ac ON am.category = ac.id "
    );

    apply_filters(&mut builder, schema);

    builder.push("ORDER BY id ")
        .push(schema.sort_order.as_str())
        .push(" LIMIT ")
        .push_bind(schema.page_size as i64)
        .push(" OFFSET ")
        .push_bind(schema.page_size as i64 * (schema.page - 1) as i64)
        .build_query_as::<Model>()
        .fetch_all(pool)
        .await
}

#[tracing::instrument(
    name = "Get models count from database",
    skip(pool)
)]
async fn get_models_count(
    pool: &PgPool,
    schema: &GetModelsSchema
) -> Result<u64, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT COUNT(*) as count
        FROM asset_models am "
    );

    apply_filters(&mut builder, schema);

    builder.build_query_scalar()
        .fetch_one(pool)
        .await
        .map(|count: i64| count as u64)
}

fn apply_filters<'a>(
    builder: &mut QueryBuilder<'a, Postgres>,
    schema: &'a GetModelsSchema
) {
    let mut has_filters = false;

    build_where_condition!(builder, has_filters, schema.category, "am.category", "=");

    if let Some(name) = &schema.name {
        build_where_condition!(@add_where_and builder, has_filters);
        let name = format!("%{}%", name);

        builder.push("am.name ILIKE ")
            .push_bind(name)
            .push(" ");
    }

    let _ = has_filters;
}