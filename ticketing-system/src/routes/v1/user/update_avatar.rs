use actix_multipart::form::{bytes::Bytes, MultipartForm};
use actix_web::{HttpResponse, ResponseError, http::StatusCode, web};
use anyhow::Context;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{auth::extractor::UserIdExtractor, schema::common::UserId, services::attachment::{Attachment, AttachmentService, AttachmentServiceError, AttachmentType}, utils::error_chain_fmt};

#[derive(MultipartForm)]
pub struct UpdateAvatarForm {
    avatar: Bytes,
}

#[derive(thiserror::Error)]
pub enum UpdateAvatarError {
    #[error(transparent)]
    AttachmentServiceError(#[from] AttachmentServiceError),
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl ResponseError for UpdateAvatarError {
    fn status_code(&self) -> StatusCode {
        match self {
            UpdateAvatarError::AttachmentServiceError(e) => e.status_code(),
            UpdateAvatarError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl std::fmt::Debug for UpdateAvatarError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub async fn update_avatar(
    pool: web::Data<PgPool>,
    service: web::Data<AttachmentService>,
    id: UserIdExtractor,
    MultipartForm(form): MultipartForm<UpdateAvatarForm>,
) -> Result<HttpResponse, UpdateAvatarError> {
    let key = get_key(&pool, id.0).await
        .context("Failed to get key from database")?
        .context("User not found")?;

    service.upload(
        AttachmentType::Avatars,
        Attachment::try_from(form.avatar)?,
        Some(key)
    )
        .await
        .context("Failed to upload avatar")?;

    Ok(HttpResponse::Ok().finish())
    
}

#[tracing::instrument(
    name = "Get avatar key from database",
    skip(pool),
)]
async fn get_key(
    pool: &PgPool,
    id: UserId,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar!(
        "
            UPDATE users
            SET avatar_key = COALESCE(avatar_key, $1)
            WHERE id = $2
            RETURNING avatar_key
        ",
        Uuid::new_v4().to_string(),
        id
    )
    .fetch_one(pool)
    .await
}