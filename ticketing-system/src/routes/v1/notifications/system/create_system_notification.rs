use actix_web::{HttpResponse, web};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{schema::notification::SystemNotificationCategory, utils::error_chain_fmt};

#[derive(Deserialize, Debug)]
pub struct CreateNotificationSchema {
    pub text: String,
    pub category: SystemNotificationCategory,
    pub active_until: Option<DateTime<Utc>>,
}

#[derive(thiserror::Error)]
pub enum CreateNotificationError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for CreateNotificationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub async fn create_system_notification(
    pool: web::Data<PgPool>,
    web::Json(schema): web::Json<CreateNotificationSchema>,
) -> Result<HttpResponse, CreateNotificationError> {
    insert_notification(&pool, schema).await
        .context("Failed to insert notification")?;
    
    Ok(HttpResponse::Created().finish())
}


#[tracing::instrument(
    name = "Insert notification into database",
    skip(pool),
)]
async fn insert_notification(
    pool: &PgPool,
    schema: CreateNotificationSchema,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO system_notifications (text, category, active_until)
        VALUES ($1, $2, $3)",
        schema.text,
        schema.category as i16,
        schema.active_until
    )
    .execute(pool)
    .await?;

    Ok(())
}