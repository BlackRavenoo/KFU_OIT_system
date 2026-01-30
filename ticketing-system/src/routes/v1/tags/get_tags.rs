use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::QsQuery;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{schema::page::{Tag, TagId}, utils::error_chain_fmt};

#[derive(Debug, Deserialize, Validate)]
#[garde(allow_unvalidated)]
pub struct GetTagsSchema {
    #[garde(range(min = 1))]
    pub page: Option<TagId>,
    #[garde(range(min = 10, max = 100))]
    pub page_size: Option<i8>,
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
    let tags = select_tags(&pool, schema).await
        .context("Failed to get tags")?;

    Ok(HttpResponse::Ok().json(tags))
}

#[tracing::instrument(
    name = "Select tags from database",
    skip(pool)
)]
async fn select_tags(
    pool: &PgPool,
    schema: GetTagsSchema,
) -> Result<Vec<Tag>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("
        SELECT t.id, t.name
        FROM tags t
        LEFT JOIN tags_synonyms ts ON ts.tag_id = t.id
    ");

    if let Some(q) = &schema.q {
        builder.push(" WHERE t.name % ").push_bind(q)
            .push(" OR ts.name % ").push_bind(q)
            .push(" GROUP BY t.id, t.name")
            .push(" ORDER BY MAX(GREATEST(SIMILARITY(t.name, ").push_bind(q)
            .push("), COALESCE(SIMILARITY(ts.name, ").push_bind(q)
            .push("), 0))) DESC");
    }

    let page = schema.page.unwrap_or(1) - 1;
    let page_size = schema.page_size.unwrap_or(50);

    builder.push(" LIMIT ").push_bind(page_size as i64)
        .push(" OFFSET ").push_bind(page * page_size as i32)
        .build_query_as::<Tag>()
        .fetch_all(pool)
        .await
}