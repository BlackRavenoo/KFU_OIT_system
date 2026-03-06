use actix_web::{HttpResponse, web};
use anyhow::Context;
use sqlx::PgPool;

use crate::{schema::assets::CategoryId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum DeleteCategoryError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for DeleteCategoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub async fn delete_category(
    pool: web::Data<PgPool>,
    id: web::Path<CategoryId>,
) -> Result<HttpResponse, DeleteCategoryError> {
    delete(
        &pool,
        id.into_inner()
    )
    .await
    .context("Failed to delete category")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Delete category from database",
    skip(pool)
)]
async fn delete(
    pool: &PgPool,
    id: CategoryId
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "DELETE FROM asset_categories
        WHERE id = $1",
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}