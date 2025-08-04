use std::marker::PhantomData;

use bytes::Bytes;
use thiserror::Error;
use uuid::Uuid;

use crate::{image::{webp::WebpProcessor, ImageProcessor, ProcessingError}, storage::{FileAccess, FileStorage, StorageError}};

pub struct Service<P: ImageProcessor> {
    storage: Box<dyn FileStorage>,
    bucket: String,
    _phantom: std::marker::PhantomData<P>
}

#[derive(Error, Debug)]
pub enum ImageServiceError {
    #[error("Processing error: {0}")]
    ProcessingError(#[from] ProcessingError),
    #[error("Storage error: {0}")]
    StorageError(#[from] StorageError),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Other error: {0}")]
    Other(String)
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
    pub fn new(storage: Box<dyn FileStorage>, bucket: String) -> Self {
        Self {
            storage,
            bucket,
            _phantom: PhantomData
        }
    }

    pub async fn upload_image(&self, image_type: ImageType, data: Bytes) -> Result<String, ImageServiceError> {
        let res = actix_web::web::block(move ||  P::process(&data)).await;
        let (image, ext) = match res {
            Ok(Ok(img)) => img,
            Ok(Err(e)) => return Err(e.into()),
            Err(e) => return Err(ImageServiceError::Other(e.to_string())),
        };

        let mut key = format!("{}/{}", image_type.prefix(), Uuid::new_v4().to_string());
        key.push_str(ext);

        match self.storage.store(&self.bucket, &key, image).await {
            Ok(_) => Ok(key),
            Err(e) => {
                tracing::error!("Failed to upload image: {:?}", e);
                Err(e.into())
            },
        }
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