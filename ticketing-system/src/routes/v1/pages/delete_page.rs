use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{schema::page::PageId, services::pages::{PageService, PageServiceError}, utils::error_chain_fmt};

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
    page_service: web::Data<PageService>,
    id: web::Path<PageId>,
) -> Result<HttpResponse, DeletePageError> {
    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    let (key, is_public) = delete_from_db(&mut transaction, *id).await
        .context("Failed to delete page from database")?
        .ok_or(DeletePageError::NotFound)?;

    delete_from_storage(&page_service, &key, is_public).await
        .context("Failed to delete page from storage")?;
    
    transaction.commit().await
        .context("Failed to commit transaction")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Delete page from database",
    skip(transaction)
)]
async fn delete_from_db(
    transaction: &mut Transaction<'_, Postgres>,
    id: PageId,
) -> Result<Option<(String, bool)>, sqlx::Error> {
    sqlx::query!(
        "
            DELETE FROM pages
            WHERE id = $1
            RETURNING key, is_public
        ",
        id
    )
    .fetch_optional(transaction.as_mut())
    .await
    .map(|r| r.map( |r|
            (r.key, r.is_public)
        )
    )
}

#[tracing::instrument(
    name = "Delete page from storage",
    skip(page_service)
)]
async fn delete_from_storage(
    page_service: &PageService,
    key: &str,
    is_public: bool,
) -> Result<(), PageServiceError> {
    page_service.delete_page(key, is_public).await
}