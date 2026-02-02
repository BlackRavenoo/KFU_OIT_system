use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::department_name::DepartmentName, utils::error_chain_fmt};

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDepartmentSchema {
    #[garde(dive)]
    name: DepartmentName,
}

#[derive(thiserror::Error)]
pub enum CreateDepartmentError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for CreateDepartmentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateDepartmentError {}

pub async fn create_department(
    pool: web::Data<PgPool>,
    Json(schema): Json<CreateDepartmentSchema>,
) -> Result<HttpResponse, CreateDepartmentError> {
    insert_department(&pool, schema).await
        .context("Failed to insert department")?;

    Ok(HttpResponse::Created().finish())
}

#[tracing::instrument(
    name = "Insert department into database",
    skip(pool)
)]
async fn insert_department(
    pool: &PgPool,
    schema: CreateDepartmentSchema,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "
            INSERT INTO departments(name)
            VALUES($1)
        ",
        schema.name.as_ref()
    )
    .execute(pool)
    .await?;

    Ok(())
}