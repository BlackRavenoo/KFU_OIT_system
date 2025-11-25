use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::department_name::DepartmentName, utils::error_chain_fmt};

#[derive(Debug, Deserialize)]
pub struct UpdateDepartmentSchema {
    name: DepartmentName,
}

#[derive(thiserror::Error)]
pub enum UpdateDepartmentError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for UpdateDepartmentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateDepartmentError {}

pub async fn update_department(
    pool: web::Data<PgPool>,
    id: web::Path<i16>,
    web::Json(schema): web::Json<UpdateDepartmentSchema>,
) -> Result<HttpResponse, UpdateDepartmentError> {
    update(&pool, schema, *id).await
        .context("Failed to update department")?;

    Ok(HttpResponse::Created().finish())
}

#[tracing::instrument(
    name = "Update department in database",
    skip(pool)
)]
async fn update(
    pool: &PgPool,
    schema: UpdateDepartmentSchema,
    id: i16,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE departments SET name = $1 WHERE id = $2",
        schema.name.as_ref(),
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}