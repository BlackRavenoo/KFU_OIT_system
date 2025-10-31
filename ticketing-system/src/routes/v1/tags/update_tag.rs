use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{domain::tag_name::TagName, routes::v1::tags::create_tag::insert_tag_synonyms, schema::page::TagId, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct UpdateTagSchema {
    pub name: Option<TagName>,
    pub synonyms_to_add: Option<Vec<TagName>>,
    pub synonyms_to_delete: Option<Vec<TagName>>,
}

#[derive(thiserror::Error)]
pub enum UpdateTagError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for UpdateTagError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateTagError {}

pub async fn update_tag(
    pool: web::Data<PgPool>,
    web::Json(schema): web::Json<UpdateTagSchema>,
    id: web::Path<TagId>,
) -> Result<HttpResponse, UpdateTagError> {
    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    if let Some(name) = schema.name {
        change_tag_name(&mut transaction, *id, name)
            .await
            .context("Failed to change tag name")?;
    }

    if let Some(synonyms) = schema.synonyms_to_add {
        insert_tag_synonyms(&mut transaction, *id, &synonyms)
            .await
            .context("Failed to insert tag synonyms")?;
    }

    if let Some(synonyms) = schema.synonyms_to_delete {
        delete_tag_synonyms(&mut transaction, *id, &synonyms)
            .await
            .context("Failed to delete tag synonyms")?;
    }

    transaction.commit().await
        .context("Failed to commit transaction")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Change tag name",
    skip(transaction)
)]
async fn change_tag_name(
    transaction: &mut Transaction<'_, Postgres>,
    id: TagId,
    name: TagName,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "
            UPDATE tags
            SET name = $1
            WHERE id = $2
        ",
        name.as_ref(),
        id
    )
    .execute(transaction.as_mut())
    .await?;

    Ok(())
}

#[tracing::instrument(
    name = "Delete tag synonyms",
    skip(transaction)
)]
async fn delete_tag_synonyms(
    transaction: &mut Transaction<'_, Postgres>,
    tag_id: TagId,
    name_synonyms: &[TagName],
) -> Result<(), sqlx::Error> {
    if name_synonyms.is_empty() {
        return Ok(());
    }

    let mut builder = sqlx::QueryBuilder::new("DELETE FROM tags_synonyms WHERE tag_id = ");
    
    builder.push_bind(tag_id)
        .push(" AND name IN (");

    let mut separated = builder.separated(", ");

    for synonym in name_synonyms {
        separated.push_bind(synonym.as_ref());
    }

    builder.push(")");

    builder.build()
        .execute(transaction.as_mut())
        .await?;

    Ok(())
}