pub mod s3;
pub mod filesystem;

use std::pin::Pin;

use async_trait::async_trait;
use bytes::Bytes;
use futures_util::Stream;

// TODO: Add errors
#[derive(thiserror::Error, Debug)]
pub enum StorageError {
    #[error("File not found")]
    NotFound,
    #[error("Other error: {0}")]
    Other(String)
}

type ReponseStream = Pin<Box<dyn Stream<Item = Result<Bytes, anyhow::Error>> + Send>>;

pub enum FileAccess {
    InternalUrl(String),
    ExternalUrl(String),
    Stream(ReponseStream),
}

#[async_trait]
pub trait FileStorage: Sync + Send + 'static {
    async fn store(&self, bucket: &str, key: &str, data: Vec<u8>) -> Result<(), StorageError>;
    async fn delete(&self, bucket: &str, key: &str) -> Result<(), StorageError>;
    async fn get_file_access(&self, bucket: &str, key: &str, is_public: bool) -> Result<FileAccess, StorageError>;
}