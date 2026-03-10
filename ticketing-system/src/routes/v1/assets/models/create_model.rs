use actix_web::{HttpResponse, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use sqlx::PgPool;

use crate::{domain::model_name::ModelName, schema::assets::{CategoryId, ModelId}, utils::error_chain_fmt};

#[derive(Validate)]
pub struct CreateModelSchema {
    #[garde(dive)]
    pub name: ModelName,
    #[garde(skip)]
    pub category: CategoryId,
}

#[derive(thiserror::Error)]
pub enum CreateModelError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for CreateModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub async fn create_model(
    pool: web::Data<PgPool>,
    Json(schema): Json<CreateModelSchema>,
) -> Result<HttpResponse, CreateModelError> {
    let id = insert_model(&pool, schema).await
        .context("Failed to insert model")?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": id
    })))
}

async fn insert_model(
    pool: &PgPool,
    schema: CreateModelSchema,
) -> Result<ModelId, sqlx::Error> {
    sqlx::query!(
        "INSERT INTO asset_models(name, category)
        VALUES($1, $2)
        RETURNING id",
        schema.name.as_ref(),
        schema.category,
    )
    .fetch_one(pool)
    .await
    .map(|r| r.id)
}