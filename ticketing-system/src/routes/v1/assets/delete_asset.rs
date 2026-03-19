use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use sqlx::PgPool;

use crate::{schema::assets::AssetId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum CreateAssetError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for CreateAssetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateAssetError {}

pub async fn delete_asset(
    pool: web::Data<PgPool>,
    asset_id: web::Path<AssetId>,
) -> Result<HttpResponse, CreateAssetError> {
    delete(
        &pool,
        asset_id.into_inner()
    )
    .await
    .context("Failed to delete asset")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Delete asset from database",
    skip(pool)
)]
async fn delete(
    pool: &PgPool,
    id: AssetId
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "DELETE FROM assets
        WHERE id = $1",
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}