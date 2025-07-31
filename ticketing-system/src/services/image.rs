use std::marker::PhantomData;

use bytes::Bytes;
use thiserror::Error;
use uuid::Uuid;

use crate::{image::{webp::WebpProcessor, ImageProcessor, ProcessingError}, storage::{FileStorage, StorageError}};

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

pub type ImageService = Service<WebpProcessor>;

impl<P: ImageProcessor> Service<P> {
    pub fn new(storage: Box<dyn FileStorage>, bucket: String) -> Self {
        Self {
            storage,
            bucket,
            _phantom: PhantomData
        }
    }

    pub async fn upload_image(&self, data: Bytes) -> Result<String, ImageServiceError> {
        let res = actix_web::web::block(move ||  P::process(&data)).await;
        let (image, ext) = match res {
            Ok(Ok(img)) => img,
            Ok(Err(e)) => return Err(e.into()),
            Err(e) => return Err(ImageServiceError::Other(e.to_string())),
        };

        let mut key = Uuid::new_v4().to_string();
        key.push_str(ext);

        match self.storage.store(&self.bucket, &key, image).await {
            Ok(_) => Ok(key),
            Err(e) => {
                tracing::error!("Failed to upload image: {:?}", e);
                Err(e.into())
            },
        }
    }

    pub async fn delete_image(&self, key: &str) -> Result<(), ImageServiceError> {
        Ok(self.storage.delete(&self.bucket, &key).await?)
    }
}