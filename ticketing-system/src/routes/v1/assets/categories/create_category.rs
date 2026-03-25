use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::{asset_category_name::AssetCategoryName, color::Color, notes::Notes}, schema::assets::CategoryId, utils::error_chain_fmt};

#[derive(Debug, Validate, Deserialize)]
pub struct CreateCategorySchema {
    #[garde(dive)]
    pub name: AssetCategoryName,
    #[garde(dive)]
    pub color: Color,
    #[serde(default)]
    #[garde(dive)]
    pub notes: Notes,
}

#[derive(thiserror::Error)]
pub enum CreateCategoryError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for CreateCategoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateCategoryError {}

pub async fn create_category(
    pool: web::Data<PgPool>,
    Json(schema): Json<CreateCategorySchema>
) -> Result<HttpResponse, CreateCategoryError> {
    let id = insert_category(&pool, schema)
        .await
        .context("Failed to insert category")?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "id": id
    })))
}

#[tracing::instrument(
    name = "Insert category into database",
    skip(pool)
)]
async fn insert_category(
    pool: &PgPool,
    schema: CreateCategorySchema,
) -> Result<CategoryId, sqlx::Error> {
    sqlx::query!(
        "INSERT INTO asset_categories(name, color, notes)
        VALUES ($1, $2, $3)
        RETURNING id",
        schema.name.as_ref(),
        schema.color.as_ref(),
        schema.notes.as_ref(),
    )
    .fetch_one(pool)
    .await
    .map(|r| r.id)
}