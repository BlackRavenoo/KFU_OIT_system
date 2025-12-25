use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;

use crate::{auth::{extractor::{user_role::OptionalUserRoleExtractor}, types::UserRole}, schema::notification::{NotificationId, SystemNotificationCategory}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum GetNotificationsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetNotificationsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetNotificationsError {}

#[derive(Serialize)]
pub struct Notification {
    pub id: NotificationId,
    pub text: String,
    pub category: SystemNotificationCategory,
    pub active_until: Option<DateTime<Utc>>,
}

pub async fn get_system_notifications(
    pool: web::Data<PgPool>,
    role: OptionalUserRoleExtractor,
) -> Result<HttpResponse, GetNotificationsError> {
    let notifications = get_notifications(
        &pool,
        role.0.is_some_and(|role| role.has_access(UserRole::Admin))
    ).await
    .context("Failed to get system notifications")?;

    Ok(HttpResponse::Ok().json(notifications))
}

#[tracing::instrument(
    name = "Get system notifications from database"
)]
async fn get_notifications(
    pool: &PgPool,
    for_admin: bool,
) -> Result<Vec<Notification>, sqlx::Error> {
    if for_admin {
        sqlx::query_as!(
            Notification,
            "SELECT id, text, category, active_until
            FROM system_notifications"
        )
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as!(
            Notification,
            "SELECT id, text, category, active_until
            FROM system_notifications
            WHERE active_until > CURRENT_TIMESTAMP"
        )
        .fetch_all(pool)
        .await
    }
}