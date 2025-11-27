use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::{building_code::BuildingCode, bulding_name::BuildingName}, utils::error_chain_fmt};

#[derive(Debug, Deserialize)]
pub struct CreateBuildingSchema {
    code: BuildingCode,
    name: BuildingName,
}

#[derive(thiserror::Error)]
pub enum CreateBuildingError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for CreateBuildingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateBuildingError {}

pub async fn create_building(
    pool: web::Data<PgPool>,
    web::Json(schema): web::Json<CreateBuildingSchema>,
) -> Result<HttpResponse, CreateBuildingError> {
    insert_building(&pool, schema).await
        .context("Failed to insert building")?;

    Ok(HttpResponse::Created().finish())
}

#[tracing::instrument(
    name = "Insert building into database",
    skip(pool)
)]
async fn insert_building(
    pool: &PgPool,
    schema: CreateBuildingSchema,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "
            INSERT INTO buildings(code, name)
            VALUES($1, $2)
        ",
        schema.code.as_ref(),
        schema.name.as_ref()
    )
    .execute(pool)
    .await?;

    Ok(())
}