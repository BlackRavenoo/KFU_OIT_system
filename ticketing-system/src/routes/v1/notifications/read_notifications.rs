use actix_web::{HttpResponse, web};
use anyhow::Context;
use sqlx::PgPool;

use crate::{auth::extractor::UserIdExtractor, schema::{common::UserId, notification::NotificationId}, utils::error_chain_fmt};

pub struct ReadNotificationsSchema {
    pub notification_ids: Vec<NotificationId>
}

#[derive(thiserror::Error)]
pub enum ReadNotificationsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for ReadNotificationsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub async fn read_notifications(
    pool: web::Data<PgPool>,
    web::Json(schema): web::Json<ReadNotificationsSchema>,
    user_id: UserIdExtractor,
) -> Result<HttpResponse, ReadNotificationsError> {
    update_notifications_read_field(
        &pool,
        user_id.0,
        &schema.notification_ids,
    )
    .await
    .context("Failed to update notifications")?;

    Ok(HttpResponse::Ok().finish())
}

async fn update_notifications_read_field(
    pool: &PgPool,
    user_id: UserId,
    notification_ids: &[NotificationId],
) -> Result<(), sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("UPDATE notifications
        SET read = TRUE
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