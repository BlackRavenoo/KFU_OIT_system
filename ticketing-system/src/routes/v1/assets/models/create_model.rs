use actix_web::{HttpResponse, ResponseError, http::StatusCode, web};
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::model_name::ModelName, schema::assets::{CategoryId, ModelId}, utils::error_chain_fmt};

#[derive(Debug, Validate, Deserialize)]
pub struct CreateModelSchema {
    #[garde(dive)]
    pub name: ModelName,
    #[garde(skip)]
    pub category: CategoryId,
}

#[derive(thiserror::Error)]
pub enum CreateModelError {
    #[error("Invalid category")]
    InvalidCategory,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for CreateModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateModelError {
    fn status_code(&self) -> actix_web::http::StatusCode {
        match self {
            CreateModelError::InvalidCategory => StatusCode::CONFLICT,
            CreateModelError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn create_model(
    pool: web::Data<PgPool>,
    Json(schema): Json<CreateModelSchema>,
) -> Result<HttpResponse, CreateModelError> {
    let id = insert_model(&pool, schema)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(db_err) => match db_err.constraint() {
                Some("asset_models_category_fkey") => CreateModelError::InvalidCategory,
                _ => CreateModelError::Unexpected(anyhow::anyhow!(db_err)),
            },
            e => CreateModelError::Unexpected(anyhow::anyhow!(e)),
        })?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "id": id
    })))
}

#[tracing::instrument(
    name = "Insert model into database",
    skip(pool)
)]
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