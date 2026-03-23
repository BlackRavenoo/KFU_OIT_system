use actix_web::{HttpResponse, ResponseError, http::StatusCode, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{build_update_query, domain::{color::Color, status_name::StatusName}, schema::assets::StatusId, utils::error_chain_fmt};

#[derive(Debug, Validate, Deserialize)]
pub struct UpdateStatusSchema {
    #[garde(dive)]
    name: Option<StatusName>,
    #[garde(dive)]
    color: Option<Color>,
}

#[derive(thiserror::Error)]
pub enum UpdateStatusError {
    #[error("All fields are empty")]
    AllFieldsEmpty,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for UpdateStatusError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateStatusError {
    fn status_code(&self) -> StatusCode {
        match self {
            UpdateStatusError::AllFieldsEmpty => StatusCode::BAD_REQUEST,
            UpdateStatusError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn update_status(
    pool: web::Data<PgPool>,
    status_id: web::Path<StatusId>,
    Json(schema): Json<UpdateStatusSchema>,
) -> Result<HttpResponse, UpdateStatusError> {
    if schema.color.is_none()
        && schema.name.is_none() {
            return Err(UpdateStatusError::AllFieldsEmpty)
        }

    update(
        &pool,
        schema,
        status_id.into_inner()
    )
    .await
    .context("Failed to update status")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Update status in database",
    skip(pool)
)]
async fn update(
    pool: &PgPool,
    schema: UpdateStatusSchema,
    status_id: StatusId,
) -> Result<(), sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "UPDATE asset_statuses SET "
    );
    let mut has_fields = false;

    let name = schema.name.as_deref();
    let color = schema.color.as_deref();

    build_update_query!(builder, has_fields, name, "name");
    build_update_query!(builder, has_fields, color, "color");

    _ = has_fields;

    builder.push(" WHERE id = ").push_bind(status_id);

    builder.build()
        .execute(pool)
        .await?;

    Ok(())
}