use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use chrono::{DateTime, Utc};
use garde::Validate;
use garde_actix_web::web::QsQuery;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, prelude::FromRow, types::Json};

use crate::{auth::extractor::UserIdExtractor, schema::{common::UserId, notification::NotificationId, tickets::TicketId}, utils::error_chain_fmt};

fn default_limit() -> i8 { 50 }

#[derive(Deserialize, Debug, Validate)]
#[garde(allow_unvalidated)]
pub struct GetNotificationsSchema {
    pub before: Option<NotificationId>,
    pub after: Option<NotificationId>,
    #[garde(range(min = 10, max = 100))]
    #[serde(default = "default_limit")]
    pub limit: i8,
}

#[derive(thiserror::Error)]
pub enum GetNotificationsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl ResponseError for GetNotificationsError {}

#[derive(Serialize, FromRow)]
struct NotificationSchema {
    pub id: NotificationId,
    pub ticket_id: TicketId,
    pub created_at: DateTime<Utc>,
    pub read: bool,
    pub payload: Json<Value>,
}

impl std::fmt::Debug for GetNotificationsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub async fn get_notifications(
    pool: web::Data<PgPool>,
    QsQuery(schema): QsQuery<GetNotificationsSchema>,
    user_id: UserIdExtractor,
) -> Result<HttpResponse, GetNotificationsError> {
    let notifications = select_notifications(&pool, schema, user_id.0)
        .await
        .context("Failed to get notifications from db.")?;

    Ok(HttpResponse::Ok().json(notifications))
}

#[tracing::instrument(
    name = "Select notifications from database",
    skip(pool)
)]
async fn select_notifications(
    pool: &PgPool,
    schema: GetNotificationsSchema,
    user_id: UserId,
) -> Result<Vec<NotificationSchema>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT
            id,
            ticket_id,
            created_at,
            read,
            payload
        FROM notifications
        WHERE user_id = "
    );

    builder.push_bind(user_id);

    if let Some(after) = schema.after {
        builder.push(" AND id > ").push_bind(after);
    } else if let Some(before) = schema.before {
        builder.push(" AND id < ").push_bind(before);
    }

    builder.push(" ORDER BY id DESC ")
        .push(" LIMIT ").push_bind(schema.limit as i64)
        .build_query_as::<NotificationSchema>()
        .fetch_all(pool)
        .await
}