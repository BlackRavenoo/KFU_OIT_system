use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use sqlx::PgPool;

use crate::{schema::assets::StatusId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum DeleteStatusError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for DeleteStatusError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for DeleteStatusError {}

pub async fn delete_status(
    pool: web::Data<PgPool>,
    status_id: web::Path<StatusId>,
) -> Result<HttpResponse, DeleteStatusError> {
    delete(
        &pool,
        status_id.into_inner(),
    )
    .await
    .context("Failed to delete status")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Delete status from database",
    skip(pool)
)]
async fn delete(
    pool: &PgPool,
    id: StatusId,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "DELETE FROM asset_statuses
        WHERE id = $1",
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}