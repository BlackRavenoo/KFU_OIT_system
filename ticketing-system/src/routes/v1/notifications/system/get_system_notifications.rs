use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_qs::web::QsQuery;
use sqlx::PgPool;

use crate::{auth::{extractor::{user_role::OptionalUserRoleExtractor}, types::UserRole}, schema::notification::{SystemNotificationId, SystemNotificationCategory}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum GetNotificationsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

#[derive(Deserialize, Debug)]
pub struct GetNotificationsSchema {
    pub all: bool,
}

impl std::fmt::Debug for GetNotificationsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetNotificationsError {}

#[derive(Serialize)]
struct SystemNotification {
    pub id: SystemNotificationId,
    pub text: String,
    pub category: SystemNotificationCategory,
    pub active_until: Option<DateTime<Utc>>,
}

pub async fn get_system_notifications(
    pool: web::Data<PgPool>,
    role: OptionalUserRoleExtractor,
    QsQuery(schema): QsQuery<GetNotificationsSchema>,
) -> Result<HttpResponse, GetNotificationsError> {
    let all_notifications = if schema.all {
        role.0.is_some_and(|role| role.has_access(UserRole::Admin))
    } else {
        false
    };

    let notifications = get_notifications(
        &pool,
        all_notifications
    ).await
    .context("Failed to get system notifications")?;

    Ok(HttpResponse::Ok().json(notifications))
}

#[tracing::instrument(
    name = "Get system notifications from database",
    skip(pool)
)]
async fn get_notifications(
    pool: &PgPool,
    all_notifications: bool,
) -> Result<Vec<SystemNotification>, sqlx::Error> {
    if all_notifications {
        sqlx::query_as!(
            SystemNotification,
            "SELECT id, text, category, active_until
            FROM system_notifications"
        )
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as!(
            SystemNotification,
            "SELECT id, text, category, active_until
            FROM system_notifications
            WHERE active_until > CURRENT_TIMESTAMP OR active_until IS NULL"
        )
        .fetch_all(pool)
        .await
    }
}