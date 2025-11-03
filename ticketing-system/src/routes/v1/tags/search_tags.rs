use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use serde_qs::actix::QsQuery;
use sqlx::PgPool;

use crate::{schema::page::Tag, utils::error_chain_fmt};

#[derive(Debug, Deserialize)]
pub struct SearchTagsSchema {
    q: String,
}

#[derive(thiserror::Error)]
pub enum SearchTagsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for SearchTagsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for SearchTagsError {}

pub async fn search_tags(
    pool: web::Data<PgPool>,
    schema: QsQuery<SearchTagsSchema>,
) -> Result<HttpResponse, SearchTagsError> {
    let tags = fetch_tags(&pool, schema.into_inner()).await
        .context("Failed to fetch tags")?;

    Ok(HttpResponse::Ok().json(tags))
}

#[tracing::instrument(
    name = "Fetch tags from database",
    skip(pool)
)]
async fn fetch_tags(
    pool: &PgPool,
    schema: SearchTagsSchema,
) -> Result<Vec<Tag>, sqlx::Error> {
    sqlx::query_as!(
        Tag,
        "
            SELECT t.id, t.name
            FROM tags t
            LEFT JOIN tags_synonyms ts ON ts.tag_id = t.id
            WHERE t.name % $1
                OR ts.name % $1
            ORDER BY LEAST(
                similarity(t.name, 'user_input'),
                COALESCE(similarity(ts.name, 'user_input'), 0)
            ) DESC
        ",
        schema.q
    )
    .fetch_all(pool)
    .await
}