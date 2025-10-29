use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{domain::tag_name::TagName, schema::page::TagId, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct CreateTagSchema {
    pub name: TagName,
    pub synonyms: Vec<TagName>,
}

#[derive(thiserror::Error)]
pub enum CreateTagError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for CreateTagError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateTagError {}

pub async fn create_tag(
    pool: web::Data<PgPool>,
    web::Json(schema): web::Json<CreateTagSchema>,
) -> Result<HttpResponse, CreateTagError> {
    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    let tag_id = insert_tag(&mut transaction, schema.name).await
        .context("Failed to insert tag")?;

    insert_tag_synonyms(&mut transaction, tag_id, &schema.synonyms).await
        .context("Failed to insert tag synonyms")?;

    transaction.commit().await
        .context("Failed to commit transaction")?;

    Ok(HttpResponse::Created().finish())
}

#[tracing::instrument(
    name = "Insert tag into the database"
)]
async fn insert_tag(
    transaction: &mut Transaction<'_, Postgres>,
    name: TagName,
) -> Result<TagId, sqlx::Error> {
    sqlx::query!(
        "
            INSERT INTO tags (name)
            VALUES ($1)
            RETURNING id
        ",
        name.as_ref()
    )
    .fetch_one(transaction.as_mut())
    .await
    .map(|r| r.id)
}

#[tracing::instrument(
    name = "Insert tag synonyms"
)]
async fn insert_tag_synonyms(
    transaction: &mut Transaction<'_, Postgres>,
    tag_id: TagId,
    name_synonyms: &[TagName],
) -> Result<(), sqlx::Error> {
    if name_synonyms.is_empty() {
        return Ok(());
    }

    let mut builder = sqlx::QueryBuilder::new("INSERT INTO tags_synonyms(tag_id, name) VALUES ");

    let mut separated = builder.separated(", ");

    for synonym in name_synonyms {
        separated.push_unseparated("(")
            .push_bind(tag_id)
            .push_bind(synonym.as_ref())
            .push_unseparated(")");
    }

    builder.build()
        .execute(transaction.as_mut())
        .await?;

    Ok(())
}