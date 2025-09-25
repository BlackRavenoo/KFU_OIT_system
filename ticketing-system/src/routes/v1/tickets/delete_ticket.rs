use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use sqlx::PgPool;

use crate::{schema::tickets::TicketId, services::image::{ImageService, ImageType}, utils::{cleanup_images, error_chain_fmt}};

#[derive(thiserror::Error)]
pub enum DeleteTicketError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for DeleteTicketError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for DeleteTicketError {}

pub async fn delete_ticket(
    id: web::Path<TicketId>,
    pool: web::Data<PgPool>,
    image_service: web::Data<ImageService>,
) -> Result<HttpResponse, DeleteTicketError> {
    let id = id.into_inner();

    let keys = get_keys(&pool, id).await
        .context("Failed to get keys from ticket_attachments")?;

    delete(&pool, id).await
        .context("Failed to delete ticket")?;

    if !keys.is_empty() {
        cleanup_images(image_service.into_inner(), keys, 30, ImageType::Attachments).await;
    }

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Get attachment keys from database",
    skip(pool)
)]
async fn get_keys(
    pool: &PgPool,
    id: TicketId,
) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query!(
        r#"
        SELECT key FROM ticket_attachments
        WHERE ticket_id = $1
        "#,
        id
    )
    .fetch_all(pool)
    .await
    .map(|recs| 
        recs.into_iter()
            .map(|rec| rec.key)
            .collect()
    )
}

#[tracing::instrument(
    name = "Delete ticket from database",
    skip(pool)
)]
async fn delete(
    pool: &PgPool,
    id: TicketId
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM tickets
        WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}