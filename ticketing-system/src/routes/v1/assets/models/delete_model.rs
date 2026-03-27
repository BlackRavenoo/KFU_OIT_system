use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use sqlx::PgPool;

use crate::{schema::assets::ModelId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum DeleteModelError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for DeleteModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for DeleteModelError {}

pub async fn delete_model(
    pool: web::Data<PgPool>,
    id: web::Path<ModelId>,
) -> Result<HttpResponse, DeleteModelError> {
    delete(&pool, id.into_inner())
        .await
        .context("Failed to delete model")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Delete model from database",
    skip(pool)
)]
async fn delete(
    pool: &PgPool,
    id: ModelId,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "DELETE FROM asset_models
        WHERE id = $1",
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}