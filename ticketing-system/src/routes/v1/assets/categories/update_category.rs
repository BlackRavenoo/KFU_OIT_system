use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::Json;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{build_update_query, domain::{asset_category_name::AssetCategoryName, color::Color, notes::Notes}, schema::assets::CategoryId, utils::error_chain_fmt};

#[derive(Debug, Validate, Deserialize)]
pub struct UpdateCategorySchema {
    #[garde(dive)]
    pub name: Option<AssetCategoryName>,
    #[garde(dive)]
    pub color: Option<Color>,
    #[garde(dive)]
    pub notes: Option<Notes>,
}

#[derive(thiserror::Error)]
pub enum UpdateCategoryError {
    #[error("All fields are empty")]
    AllFieldsEmpty,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for UpdateCategoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateCategoryError {}

pub async fn update_category(
    pool: web::Data<PgPool>,
    Json(schema): Json<UpdateCategorySchema>,
    path: web::Path<CategoryId>,
) -> Result<HttpResponse, UpdateCategoryError> {
    if schema.name.is_none() && schema.color.is_none() && schema.notes.is_none() {
        Err(UpdateCategoryError::AllFieldsEmpty)
    } else {
        update(&pool, schema, path.into_inner())
            .await
            .context("Failed to update asset category")?;

        Ok(HttpResponse::Ok().finish())
    }
}

#[tracing::instrument(
    name = "Update asset category in database",
    skip(pool)
)]
async fn update(
    pool: &PgPool,
    schema: UpdateCategorySchema,
    category_id: CategoryId,
) -> Result<(), sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("UPDATE asset_categories SET ");
    let mut has_fields = false;

    let name = schema.name.as_ref().map(|name| name.as_ref());
    let color = schema.color.as_ref().map(|color| color.as_ref());
    let notes = schema.notes.as_ref().map(|notes| notes.as_ref());

    build_update_query!(builder, has_fields, name, "name");
    build_update_query!(builder, has_fields, color, "color");
    build_update_query!(builder, has_fields, notes, "notes");

    _ = has_fields;

    builder.push(" WHERE id = ").push_bind(category_id);

    builder.build()
        .execute(pool)
        .await?;

    Ok(())
}