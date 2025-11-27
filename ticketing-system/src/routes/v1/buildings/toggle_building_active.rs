use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use sqlx::PgPool;

use crate::utils::error_chain_fmt;

#[derive(thiserror::Error)]
pub enum ToggleBuildingActiveError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for ToggleBuildingActiveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for ToggleBuildingActiveError {}

pub async fn toggle_building_active(
    pool: web::Data<PgPool>,
    id: web::Path<i16>,
) -> Result<HttpResponse, ToggleBuildingActiveError> {
    toggle_active(&pool, *id).await
        .context("Failed to toggle building active in database")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Toggle building 'is_active' field in database",
    skip(pool)
)]
async fn toggle_active(
    pool: &PgPool,
    id: i16,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "
            UPDATE buildings
            SET is_active = NOT is_active
            WHERE id = $1
        ",
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}