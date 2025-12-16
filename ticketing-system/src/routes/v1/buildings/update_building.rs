use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{build_update_query, domain::{building_code::BuildingCode, bulding_name::BuildingName}, utils::error_chain_fmt};

#[derive(Debug, Deserialize)]
pub struct UpdateBuildingSchema {
    code: Option<BuildingCode>,
    name: Option<BuildingName>,
}

#[derive(thiserror::Error)]
pub enum UpdateBuildingError {
    #[error("All fields are empty")]
    AllFieldsEmpty,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for UpdateBuildingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateBuildingError {}

pub async fn update_building(
    pool: web::Data<PgPool>,
    id: web::Path<i16>,
    web::Json(schema): web::Json<UpdateBuildingSchema>,
) -> Result<HttpResponse, UpdateBuildingError> {
    update(&pool, schema, *id).await?;

    Ok(HttpResponse::Created().finish())
}

#[tracing::instrument(
    name = "Update building in database",
    skip(pool)
)]
async fn update(
    pool: &PgPool,
    schema: UpdateBuildingSchema,
    id: i16,
) -> Result<(), UpdateBuildingError> {
    let mut builder = sqlx::QueryBuilder::new("UPDATE buildings SET ");
    let mut has_fields = false;

    let code = schema.code.as_ref().map(|code| code.as_ref());
    let name = schema.name.as_ref().map(|name| name.as_ref());

    build_update_query!(builder, has_fields, code, "code");
    build_update_query!(builder, has_fields, name, "name");

    if !has_fields {
        return Err(UpdateBuildingError::AllFieldsEmpty);
    }

    builder.push(" WHERE id = ")
        .push_bind(id);

    let query = builder.build();

    query.execute(pool).await
        .context("Failed to update building.")?;

    Ok(())
}