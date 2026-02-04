use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use serde::Serialize;
use sqlx::PgPool;

use crate::{auth::extractor::UserIdExtractor, schema::common::UserId, utils::error_chain_fmt};

#[derive(Serialize)]
struct NotificationCount {
    pub count: i64,
}

#[derive(thiserror::Error)]
pub enum GetNotificationsCountError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for GetNotificationsCountError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetNotificationsCountError {}

pub async fn get_notifications_count(
    pool: web::Data<PgPool>,
    user_id: UserIdExtractor,
) -> Result<HttpResponse, GetNotificationsCountError> {
    let count = select_notification_count(
        &pool,
        user_id.0
    )
    .await
    .context("Failed to get notifications count from database")?;

    Ok(HttpResponse::Ok().json(NotificationCount{
        count
    }))
}

#[tracing::instrument(
    name = "Select count of notifications from database",
    skip(pool)
)]
async fn select_notification_count(
    pool: &PgPool,
    user_id: UserId,
) -> Result<i64, sqlx::Error> {
    sqlx::query!(
        r#"SELECT COUNT(*) AS "count!"
        FROM notifications
        WHERE user_id = $1 AND not read"#,
        user_id
    )
    .fetch_one(pool)
    .await
    .map(|r| r.count)
}