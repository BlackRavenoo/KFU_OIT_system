use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use sqlx::{PgPool, postgres::PgQueryResult};

use crate::{schema::page::PageId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum DeletePageError {
    #[error("Page not found")]
    NotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for DeletePageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for DeletePageError {
    fn status_code(&self) -> StatusCode {
        match self {
            DeletePageError::NotFound => StatusCode::NOT_FOUND,
            DeletePageError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn delete_page(
    pool: web::Data<PgPool>,
    id: web::Path<PageId>,
) -> Result<HttpResponse, DeletePageError> {
    let result = delete_from_db(&pool, *id).await
        .context("Failed to delete page from database")?;

    if result.rows_affected() == 0 {
        Err(DeletePageError::NotFound)
    } else {
        Ok(HttpResponse::Ok().finish())
    }
}

#[tracing::instrument(
    name = "Delete page from database",
    skip(pool)
)]
async fn delete_from_db(
    pool: &PgPool,
    id: PageId,
) -> Result<PgQueryResult, sqlx::Error> {
    sqlx::query!(
        "
            DELETE FROM pages
            WHERE id = $1
        ",
        id
    )
    .execute(pool)
    .await
}