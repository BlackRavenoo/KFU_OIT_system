use std::marker::PhantomData;

use actix_web::{http::StatusCode, ResponseError};
use anyhow::Context;
use thiserror::Error;
use uuid::Uuid;

use crate::{image::{ImageProcessor, ProcessingError, thumbnail::AvatarProcessor, webp::WebpProcessor}, services::attachment::{Attachment, AttachmentType}, storage::{FileAccess, FileStorage, Storage, StorageError}};

pub struct Service<P: ImageProcessor> {
    storage: Storage,
    bucket: String,
    _phantom: std::marker::PhantomData<P>
}

#[derive(Error, Debug)]
pub enum AttachmentServiceError {
    #[error("Processing error: {0}")]
    ProcessingError(#[from] ProcessingError),
    #[error("Storage error: {0}")]
    StorageError(#[from] StorageError),
    #[error("Unsupported file format")]
    UnsupportedFormat,
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

impl ResponseError for AttachmentServiceError {
    fn status_code(&self) -> StatusCode {
        match self {
            AttachmentServiceError::ProcessingError(processing_error) => processing_error.status_code(),
            AttachmentServiceError::StorageError(storage_error) => storage_error.status_code(),
            AttachmentServiceError::UnsupportedFormat => StatusCode::BAD_REQUEST,
            AttachmentServiceError::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub type AttachmentService = Service<WebpProcessor>;

impl<P: ImageProcessor> Service<P> {
    pub fn new(storage: Storage, bucket: String) -> Self {
        Self {
            storage,
            bucket,
            _phantom: PhantomData
        }
    }

    pub async fn upload(&self, attachment_type: AttachmentType, attachment: Attachment, key: Option<String>) -> Result<String, AttachmentServiceError> {
        let (data, ext) = if attachment.is_image() {
            let (data, ext) = match attachment_type {
                AttachmentType::TicketAttachments => actix_web::web::block(move ||  P::process(&attachment.data)).await
                    .context("Failed to process attachment")??,
                AttachmentType::Avatars => actix_web::web::block(move ||  AvatarProcessor::process(&attachment.data)).await
                    .context("Failed to process avatar")??,
            };

            (data.into(), ext.to_string())
        } else {
            (
                attachment.data,
                format!(".{}", attachment.extension)
            )
        };

        let key = format!(
            "{}/{}{}",
            attachment_type.prefix(),
            key.unwrap_or(Uuid::new_v4().to_string()),
            ext
        );

        self.storage.store(&self.bucket, &key, data).await?;

        Ok(key)
    }

    pub async fn delete(&self, image_type: AttachmentType, key: &str) -> Result<(), AttachmentServiceError> {
        let key = format!("{}/{}", image_type.prefix(), key);
        Ok(self.storage.delete(&self.bucket, &key).await?)
    }

    pub async fn get(&self, image_type: AttachmentType, key: &str) -> Result<FileAccess, AttachmentServiceError> {
        let key = format!("{}/{}", image_type.prefix(), key);
        Ok(self.storage.get_file_access(&self.bucket, &key, true).await?)
    }
}