pub mod s3;

use std::pin::Pin;

use actix_web::{http::StatusCode, ResponseError};
use async_trait::async_trait;
use bytes::Bytes;
use futures_util::Stream;

use crate::storage::s3::S3Storage;

// TODO: Add errors
#[derive(thiserror::Error, Debug)]
pub enum StorageError {
    #[error("File not found")]
    NotFound,
    #[error(transparent)]
    Other(#[from] anyhow::Error)
}

impl ResponseError for StorageError {
    fn status_code(&self) -> StatusCode {
        match self {
            StorageError::NotFound => StatusCode::NOT_FOUND,
            StorageError::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

type ResponseStream = Pin<Box<dyn Stream<Item = Result<Bytes, anyhow::Error>> + Send>>;

pub enum FileAccess {
    ExternalUrl(String),
    Stream(ResponseStream),
}

#[async_trait]
pub trait FileStorage: Sync + Send + Clone + 'static {
    async fn store(&self, bucket: &str, key: &str, data: Bytes) -> Result<(), StorageError>;
    async fn delete(&self, bucket: &str, key: &str) -> Result<(), StorageError>;
    async fn get_file_access(&self, bucket: &str, key: &str, is_public: bool) -> Result<FileAccess, StorageError>;
}

pub type Storage = S3Storage;