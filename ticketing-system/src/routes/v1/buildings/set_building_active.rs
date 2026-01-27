use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::utils::error_chain_fmt;

#[derive(Deserialize)]
pub struct SetBuildingActiveSchema {
    pub is_active: bool,
}

#[derive(thiserror::Error)]
pub enum SetBuildingActiveError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for SetBuildingActiveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for SetBuildingActiveError {}

pub async fn set_building_active(
    pool: web::Data<PgPool>,
    id: web::Path<i16>,
    web::Json(schema): web::Json<SetBuildingActiveSchema>
) -> Result<HttpResponse, SetBuildingActiveError> {
    set_active(&pool, *id, schema.is_active).await
        .context("Failed to set building active in database")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Update building 'is_active' field in database",
    skip(pool)
)]
async fn set_active(
    pool: &PgPool,
    id: i16,
    is_active: bool
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "
            UPDATE buildings
            SET is_active = $1
            WHERE id = $2
        ",
        is_active,
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}