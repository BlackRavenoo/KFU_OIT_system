use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{build_update_query, domain::title::Title, routes::v1::pages::create_page::{insert_related_pages, insert_tags, upload_page}, schema::page::{PageId, TagId}, services::pages::PageService, utils::error_chain_fmt};

#[derive(Deserialize, Debug)]
pub struct UpdatePageSchema {
    pub data: Option<serde_json::Value>,
    pub title: Option<Title>,
    pub tags_to_add: Vec<TagId>,
    pub tags_to_delete: Vec<TagId>,
    pub related_to_add: Vec<PageId>,
    pub related_to_delete: Vec<PageId>,
    pub is_public: Option<bool>,
}

#[derive(thiserror::Error)]
pub enum UpdatePageError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for UpdatePageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdatePageError {
    fn status_code(&self) -> StatusCode {
        match self {
            UpdatePageError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn update_page(
    web::Json(schema): web::Json<UpdatePageSchema>,
    pool: web::Data<PgPool>,
    page_service: web::Data<PageService>,
    path: web::Path<PageId>,
) -> Result<HttpResponse, UpdatePageError> {
    let page_id = path.into_inner();

    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    update(&mut transaction, &schema, page_id).await
        .context("Failed to update page")?;

    insert_related_pages(&mut transaction, page_id, &schema.related_to_add).await
        .context("Failed to insert related pages")?;

    delete_related_pages(&mut transaction, page_id, &schema.related_to_delete).await
        .context("Failed to delete related pages")?;

    insert_tags(&mut transaction, page_id, &schema.tags_to_add).await
        .context("Failed to insert tags")?;

    delete_tags(&mut transaction, page_id, &schema.tags_to_delete).await
        .context("Failed to delete tags")?;

    if let Some(data) = schema.data {
        let (key, is_public) = get_page_fields(&mut transaction, page_id).await
            .context("Failed to get page fields for upload")?;

        upload_page(&page_service, &key, &data, is_public).await
            .context("Failed to upload page")?;
    }

    transaction.commit().await
        .context("Failed to commit transaction")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Update page in database",
    skip(transaction)
)]
async fn update(
    transaction: &mut Transaction<'_, Postgres>,
    schema: &UpdatePageSchema,
    page_id: PageId,
) -> Result<(), sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("UPDATE pages SET ");
    let mut has_fields = false;

    let title = schema.title.as_ref().map(|desc| desc.as_ref());

    build_update_query!(builder, has_fields, title, "title");
    build_update_query!(builder, has_fields, schema.is_public, "is_public");

    if !has_fields {
        return Ok(());
    }

    builder.push(" WHERE id = ").push_bind(page_id);

    let query = builder.build();

    query.execute(transaction.as_mut()).await?;

    Ok(())
}

#[tracing::instrument(
    name = "Delete page relations",
    skip(transaction)
)]
async fn delete_related_pages(
    transaction: &mut Transaction<'_, Postgres>,
    source_page_id: PageId,
    related_pages: &[PageId],
) -> Result<(), sqlx::Error> {
    if related_pages.is_empty() {
        return Ok(());
    }

    let mut builder = sqlx::QueryBuilder::new("DELETE FROM related_pages WHERE source_page_id = ");
    
    builder.push_bind(source_page_id)
        .push(" AND related_page_id IN (");

    let mut separated = builder.separated(", ");

    for page in related_pages {
        separated.push_bind(page);
    }

    builder.push(")");

    builder.build()
        .execute(transaction.as_mut())
        .await?;

    Ok(())
}

#[tracing::instrument(
    name = "Delete tags from page",
    skip(transaction)
)]
async fn delete_tags(
    transaction: &mut Transaction<'_, Postgres>,
    page_id: PageId,
    tags: &[TagId],
) -> Result<(), sqlx::Error> {
    if tags.is_empty() {
        return Ok(());
    }

    let mut builder = sqlx::QueryBuilder::new("DELETE FROM pages_tags WHERE page_id = ");
    
    builder.push_bind(page_id)
        .push(" AND tag_id IN (");

    let mut separated = builder.separated(", ");

    for tag in tags {
        separated.push_bind(tag);
    }

    builder.push(")");

    builder.build()
        .execute(transaction.as_mut())
        .await?;

    Ok(())
}

#[tracing::instrument(
    name = "Get page key",
    skip(transaction)
)]
async fn get_page_fields(
    transaction: &mut Transaction<'_, Postgres>,
    page_id: PageId,
) -> Result<(String, bool), sqlx::Error> {
    sqlx::query!(
        "
            SELECT key, is_public FROM pages WHERE id = $1
        ",
        page_id
    )
    .fetch_one(transaction.as_mut())
    .await
    .map(|r| (r.key, r.is_public))
}