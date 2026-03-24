use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::{color::Color, status_name::StatusName}, schema::assets::StatusId, utils::error_chain_fmt};

#[derive(Debug, Validate, Deserialize)]
pub struct CreateStatusSchema {
    #[garde(dive)]
    name: StatusName,
    #[garde(dive)]
    color: Color,
}

#[derive(thiserror::Error)]
pub enum CreateStatusError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for CreateStatusError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateStatusError {}

pub async fn create_status(
    pool: web::Data<PgPool>,
    Json(schema): Json<CreateStatusSchema>,
) -> Result<HttpResponse, CreateStatusError> {
    let id = insert_status(
        &pool,
        schema
    )
    .await
    .context("Failed to create status")?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "id": id
    })))
}


#[tracing::instrument(
    name = "Insert asset status into database",
    skip(pool)
)]
async fn insert_status(
    pool: &PgPool,
    schema: CreateStatusSchema,
) -> Result<StatusId, sqlx::Error> {
    sqlx::query!(
        "INSERT INTO asset_statuses(name, color)
        VALUES ($1, $2)
        RETURNING id",
        schema.name.as_ref(),
        schema.color.as_ref()
    )
    .fetch_one(pool)
    .await
    .map(|r| r.id)
}