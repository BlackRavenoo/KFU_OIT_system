use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context as _;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{build_update_query, schema::notification::{NotificationId, SystemNotificationCategory}, utils::error_chain_fmt};

#[derive(Deserialize, Debug)]
pub struct UpdateNotificationSchema {
    pub text: Option<String>,
    pub category: Option<SystemNotificationCategory>,
    pub active_until: Option<Option<DateTime<Utc>>>,
}

#[derive(thiserror::Error)]
pub enum UpdateNotificationError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for UpdateNotificationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateNotificationError {}

pub async fn update_system_notification(
    pool: web::Data<PgPool>,
    path: web::Path<NotificationId>,
    web::Json(schema): web::Json<UpdateNotificationSchema>,
) -> Result<HttpResponse, UpdateNotificationError> {
    update_notification(&pool, path.into_inner(), schema).await
        .context("Failed to update notification")?;
    
    Ok(HttpResponse::Ok().finish())
}


#[tracing::instrument(
    name = "Update notification in database",
    skip(pool),
)]
async fn update_notification(
    pool: &PgPool,
    id: NotificationId,
    schema: UpdateNotificationSchema,
) -> Result<bool, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("UPDATE system_notifications SET ");
    let mut has_fields = false;

    let category = schema.category.map(|cat| cat as i16);

    build_update_query!(builder, has_fields, schema.text, "text");
    build_update_query!(builder, has_fields, category, "category");
    build_update_query!(builder, has_fields, schema.active_until, "active_until");

    if !has_fields {
        return Ok(has_fields)
    }

    builder.push(" WHERE id = ");
    builder.push_bind(id);

    builder.build()
        .execute(pool)
        .await?;

    Ok(has_fields)
}