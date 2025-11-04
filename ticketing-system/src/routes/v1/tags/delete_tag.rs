use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use sqlx::PgPool;

use crate::{schema::page::TagId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum DeleteTagError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for DeleteTagError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for DeleteTagError {}

pub async fn delete_tag(
    pool: web::Data<PgPool>,
    id: web::Path<TagId>,
) -> Result<HttpResponse, DeleteTagError> {
    delete(&pool, *id).await
        .context("Failed to delete tag")?;

    Ok(HttpResponse::Ok().finish())
}


#[tracing::instrument(
    name = "Delete tag from database",
    skip(pool)
)]
async fn delete(
    pool: &PgPool,
    id: TagId
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "
            DELETE FROM tags
            WHERE id = $1
        ",
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}