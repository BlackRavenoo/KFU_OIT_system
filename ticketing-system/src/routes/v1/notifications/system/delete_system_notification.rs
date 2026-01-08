use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context as _;
use sqlx::PgPool;

use crate::{schema::notification::SystemNotificationId, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum DeleteNotificationError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for DeleteNotificationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for DeleteNotificationError {}

pub async fn delete_system_notification(
    pool: web::Data<PgPool>,
    path: web::Path<SystemNotificationId>
) -> Result<HttpResponse, DeleteNotificationError> {
    delete_notification(&pool, path.into_inner()).await
        .context("Failed to delete notification")?;
    
    Ok(HttpResponse::Ok().finish())
}


#[tracing::instrument(
    name = "Delete notification from database",
    skip(pool),
)]
async fn delete_notification(
    pool: &PgPool,
    id: SystemNotificationId,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "DELETE FROM system_notifications
        WHERE id = $1",
        id
    )
    .execute(pool)
    .await?;

    Ok(())
}