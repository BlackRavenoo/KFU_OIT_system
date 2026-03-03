use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::QsQuery;
use serde::Deserialize;
use sqlx::{PgPool, Postgres, QueryBuilder};

use crate::{schema::{common::PaginationResult, page::{Tag, TagId}}, utils::error_chain_fmt};

fn default_page_size() -> i8 { 50 }

fn default_page() -> TagId { 1 }

#[derive(Debug, Deserialize, Validate)]
#[garde(allow_unvalidated)]
pub struct GetTagsSchema {
    #[garde(range(min = 1))]
    #[serde(default = "default_page")]
    pub page: TagId,
    #[garde(range(min = 10, max = 100))]
    #[serde(default = "default_page_size")]
    pub page_size: i8,
    pub q: Option<String>,
}

#[derive(thiserror::Error)]
pub enum GetTagsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetTagsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetTagsError {}

pub async fn get_tags(
    pool: web::Data<PgPool>,
    QsQuery(schema): QsQuery<GetTagsSchema>
) -> Result<HttpResponse, GetTagsError> {
    let tags = select_tags(&pool, &schema).await
        .context("Failed to get tags")?;

    let total_items = get_tags_count(
        &pool,
        &schema
    )
    .await
    .context("Failed to get tags count")?;

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items as u64,
        schema.page_size,
        tags
    )))
}

#[tracing::instrument(
    name = "Select tags from database",
    skip(pool)
)]
async fn select_tags(
    pool: &PgPool,
    schema: &GetTagsSchema,
) -> Result<Vec<Tag>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT t.id, t.name
        FROM tags t"
    );

    apply_filters(&mut builder, schema);

    builder.push(" LIMIT ").push_bind(schema.page_size as i64)
        .push(" OFFSET ").push_bind((schema.page - 1) * schema.page_size as i32)
        .build_query_as::<Tag>()
        .fetch_all(pool)
        .await
}

#[tracing::instrument(
    name = "Get tags count from database",
    skip(pool)
)]
async fn get_tags_count(
    pool: &PgPool,
    schema: &GetTagsSchema
) -> Result<u64, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT COUNT(*) FROM tags t"
    );

    apply_join_and_where(&mut builder, schema);

    builder.build_query_scalar()
        .fetch_one(pool)
        .await
        .map(|count: i64| count as u64)
}

fn apply_join_and_where<'a>(
    builder: &mut QueryBuilder<'a, Postgres>,
    schema: &'a GetTagsSchema,
) {
    if let Some(q) = &schema.q {
        builder.push(" LEFT JOIN tags_synonyms ts ON ts.tag_id = t.id")
            .push(" WHERE t.name % ").push_bind(q)
            .push(" OR ts.name % ").push_bind(q);
    }
}

fn apply_filters<'a>(
    builder: &mut QueryBuilder<'a, Postgres>,
    schema: &'a GetTagsSchema
) {
    if let Some(q) = &schema.q {
        apply_join_and_where(builder, schema);
        
        builder.push(" GROUP BY t.id, t.name")
            .push(" ORDER BY MAX(GREATEST(SIMILARITY(t.name, ").push_bind(q)
            .push("), COALESCE(SIMILARITY(ts.name, ").push_bind(q)
            .push("), 0))) DESC");
    }
}