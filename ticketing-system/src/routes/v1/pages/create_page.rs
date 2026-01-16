use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{auth::extractor::UserIdExtractor, domain::title::Title, schema::{common::UserId, page::{PageId, TagId}}, utils::error_chain_fmt};

#[derive(Deserialize, Debug)]
pub struct InsertPageSchema {
    pub data: serde_json::Value,
    pub title: Title,
    pub tags: Vec<TagId>,
    pub related: Vec<PageId>,
    pub is_public: bool,
}

#[derive(thiserror::Error)]
pub enum InsertPageError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for InsertPageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for InsertPageError {}

pub async fn create_page(
    web::Json(schema): web::Json<InsertPageSchema>,
    pool: web::Data<PgPool>,
    user_id: UserIdExtractor,
) -> Result<HttpResponse, InsertPageError> {
    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    let page_id = insert_page(&mut transaction, &schema, user_id.0).await
        .context("Failed to insert page into database")?;

    insert_related_pages(&mut transaction, page_id, &schema.related).await
        .context("Failed to insert related pages")?;

    insert_tags(&mut transaction, page_id, &schema.tags).await
        .context("Failed to insert tags")?;

    transaction.commit().await
        .context("Failed to commit transaction")?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "id": page_id
    })))
}

#[tracing::instrument(
    name = "Insert page into database",
    skip(transaction),
)]
async fn insert_page(
    transaction: &mut Transaction<'_, Postgres>,
    schema: &InsertPageSchema,
    author_id: UserId,
) -> Result<PageId, sqlx::Error> {
    let title = schema.title.as_ref();
    sqlx::query!(
        "
            INSERT INTO pages(author, is_public, title, text)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        ",
        author_id,
        schema.is_public,
        title,
        schema.data.to_string()
    )
    .fetch_one(transaction.as_mut())
    .await
    .map(|r| r.id)
}

#[tracing::instrument(
    name = "Insert page relations into database",
    skip(transaction)
)]
pub async fn insert_related_pages(
    transaction: &mut Transaction<'_, Postgres>,
    page_id: PageId,
    related_pages: &[PageId],
) -> Result<(), sqlx::Error> {
    if related_pages.is_empty() {
        return Ok(());
    }

    let mut builder = sqlx::QueryBuilder::new("INSERT INTO related_pages(source_page_id, related_page_id) ");

    builder.push_values(related_pages, |mut b, related_id| {
        b.push_bind(page_id)
            .push_bind(related_id);
    });

    builder.build()
        .execute(transaction.as_mut())
        .await?;

    Ok(())
}

#[tracing::instrument(
    name = "Insert tags relations into database",
    skip(transaction)
)]
pub async fn insert_tags(
    transaction: &mut Transaction<'_, Postgres>,
    page_id: PageId,
    tags: &[TagId],
) -> Result<(), sqlx::Error> {
    if tags.is_empty() {
        return Ok(());
    }

    let mut builder = sqlx::QueryBuilder::new("INSERT INTO pages_tags(tag_id, page_id) ");

    builder.push_values(tags, |mut b, tag_id| {
        b.push_bind(tag_id)
            .push_bind(page_id);
    });

    builder.build()
        .execute(transaction.as_mut())
        .await?;

    Ok(())
}