use actix_web::{HttpResponse, ResponseError, http::StatusCode, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{build_update_query, domain::model_name::ModelName, schema::assets::{CategoryId, ModelId}, utils::error_chain_fmt};

#[derive(Debug, Validate, Deserialize)]
pub struct UpdateModelSchema {
    #[garde(dive)]
    pub name: Option<ModelName>,
    #[garde(range(min = 1))]
    pub category: Option<CategoryId>,
}

#[derive(thiserror::Error)]
pub enum UpdateModelError {
    #[error("All fields are empty")]
    AllFieldsEmpty,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for UpdateModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateModelError {
    fn status_code(&self) -> StatusCode {
        match self {
            UpdateModelError::AllFieldsEmpty => StatusCode::BAD_REQUEST,
            UpdateModelError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn update_model(
    pool: web::Data<PgPool>,
    Json(schema): Json<UpdateModelSchema>,
    path: web::Path<ModelId>,
) -> Result<HttpResponse, UpdateModelError> {
    if schema.category.is_none() && schema.name.is_none() {
        Err(UpdateModelError::AllFieldsEmpty)
    } else {
        update(&pool, schema, path.into_inner()).await
            .context("Failed to update model")?;

        Ok(HttpResponse::Ok().finish())
    }
}

#[tracing::instrument(
    name = "Update asset model in database",
    skip(pool)
)]
async fn update(
    pool: &PgPool,
    schema: UpdateModelSchema,
    model_id: ModelId,
) -> Result<(), sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("UPDATE asset_models SET ");
    let mut has_fields = false;

    let name = schema.name.as_deref();

    build_update_query!(builder, has_fields, name, "name");
    build_update_query!(builder, has_fields, schema.category, "category");

    _ = has_fields;

    builder.push(" WHERE id = ").push_bind(model_id);

    builder.build()
        .execute(pool)
        .await?;

    Ok(())
}