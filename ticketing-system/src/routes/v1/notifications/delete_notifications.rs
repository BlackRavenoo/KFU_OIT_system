use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{auth::extractor::UserIdExtractor, schema::{common::UserId, notification::NotificationId}, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct DeleteNotificationsSchema {
    pub notification_ids: Vec<NotificationId>
}

#[derive(thiserror::Error)]
pub enum DeleteNotificationsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for DeleteNotificationsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for DeleteNotificationsError {}

pub async fn delete_notifications(
    pool: web::Data<PgPool>,
    web::Json(schema): web::Json<DeleteNotificationsSchema>,
    user_id: UserIdExtractor,
) -> Result<HttpResponse, DeleteNotificationsError> {
    delete(
        &pool,
        user_id.0,
        &schema.notification_ids,
    )
    .await
    .context("Failed to update notifications")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Delete notifications from database",
    skip(pool)
)]
async fn delete(
    pool: &PgPool,
    user_id: UserId,
    notification_ids: &[NotificationId],
) -> Result<(), sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("DELETE FROM notifications
        WHERE user_id = 
    ");

    builder.push_bind(user_id)
        .push(" AND id IN (");

    let mut separated = builder.separated(", ");

    for notification_id in notification_ids {
        separated.push_bind(notification_id);
    }

    builder.push(")");

    builder.build()
        .execute(pool)
        .await?;

    Ok(())
}