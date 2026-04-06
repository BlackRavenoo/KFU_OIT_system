use actix_web::{ResponseError, web::{self, Path}};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{schema::assets::AssetId, utils::error_chain_fmt};

#[derive(Debug, Deserialize, Validate)]
pub struct AttachAssetSchema {
    #[garde(range(min = 1))]
    pub asset_id: AssetId,
    #[garde(length(min = 1))]
    pub comment: Option<String>,
}

#[derive(thiserror::Error)]
pub enum AttachAssetError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for AttachAssetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for AttachAssetError {}

pub async fn attach_asset(
    ticket_id: Path<i64>,
    Json(schema): Json<AttachAssetSchema>,
    pool: web::Data<PgPool>,
) -> Result<(), AttachAssetError> {
    attach(
        ticket_id.into_inner(),
        schema,
        &pool
    )
    .await
    .context("Failed to attach asset to ticket")?;

    Ok(())
}

#[tracing::instrument(
    name = "Attach asset to ticket",
    skip(pool)
)]
async fn attach(
    ticket_id: i64,
    schema: AttachAssetSchema,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO ticket_assets (ticket_id, asset_id, comment)
        VALUES ($1, $2, $3)
        "#,
        ticket_id,
        schema.asset_id,
        schema.comment
    )
    .execute(pool)
    .await?;

    Ok(())
}