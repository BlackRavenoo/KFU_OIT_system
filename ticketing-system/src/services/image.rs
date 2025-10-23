use std::marker::PhantomData;

use actix_web::{http::StatusCode, ResponseError};
use anyhow::Context;
use bytes::Bytes;
use thiserror::Error;
use uuid::Uuid;

use crate::{image::{thumbnail::AvatarProcessor, webp::WebpProcessor, ImageProcessor, ProcessingError}, storage::{FileAccess, FileStorage, Storage, StorageError}};

pub struct Service<P: ImageProcessor> {
    storage: Storage,
    bucket: String,
    _phantom: std::marker::PhantomData<P>
}

#[derive(Error, Debug)]
pub enum ImageServiceError {
    #[error("Processing error: {0}")]
    ProcessingError(#[from] ProcessingError),
    #[error("Storage error: {0}")]
    StorageError(#[from] StorageError),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

impl ResponseError for ImageServiceError {
    fn status_code(&self) -> StatusCode {
        match self {
            ImageServiceError::ProcessingError(processing_error) => processing_error.status_code(),
            ImageServiceError::StorageError(storage_error) => storage_error.status_code(),
            ImageServiceError::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Debug, Clone)]
pub enum ImageType {
    Attachments,
    Avatars,
}

impl ImageType {
    pub fn prefix(&self) -> &'static str {
        match self {
            ImageType::Attachments => "attachments",
            ImageType::Avatars => "avatars",
        }
    }
}

impl TryFrom<String> for ImageType {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.as_str() {
            "attachments" => Ok(ImageType::Attachments),
            "avatars" => Ok(ImageType::Avatars),
            _ => Err(format!("Unknown image type: {}", value)),
        }
    }
}

impl TryFrom<&str> for ImageType {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "attachments" => Ok(ImageType::Attachments),
            "avatars" => Ok(ImageType::Avatars),
            _ => Err(format!("Unknown image type: {}", value)),
        }
    }
}

pub type ImageService = Service<WebpProcessor>;

impl<P: ImageProcessor> Service<P> {
    pub fn new(storage: Storage, bucket: String) -> Self {
        Self {
            storage,
            bucket,
            _phantom: PhantomData
        }
    }

    pub async fn upload_image(&self, image_type: ImageType, data: Bytes, key: Option<String>) -> Result<String, ImageServiceError> {
        let (image, ext) = match image_type {
            ImageType::Attachments => actix_web::web::block(move ||  P::process(&data)).await
                .context("Failed to process attachment")??,
            ImageType::Avatars => actix_web::web::block(move ||  AvatarProcessor::process(&data)).await
                .context("Failed to process avatar")??,
        };

        let key = format!(
            "{}/{}{}",
            image_type.prefix(),
            key.unwrap_or(Uuid::new_v4().to_string()),
            ext
        );

        self.storage.store(&self.bucket, &key, image).await?;

        Ok(key)
    }

    pub async fn delete_image(&self, image_type: ImageType, key: &str) -> Result<(), ImageServiceError> {
        let key = format!("{}/{}", image_type.prefix(), key);
        Ok(self.storage.delete(&self.bucket, &key).await?)
    }

    pub async fn get_image(&self, image_type: ImageType, key: &str) -> Result<FileAccess, ImageServiceError> {
        let key = format!("{}/{}", image_type.prefix(), key);
        Ok(self.storage.get_file_access(&self.bucket, &key, true).await?)
    }
}