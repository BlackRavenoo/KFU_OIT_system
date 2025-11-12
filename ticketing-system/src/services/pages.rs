use actix_web::{http::StatusCode, ResponseError};
use anyhow::anyhow;
use bytes::Bytes;

use crate::{storage::{FileAccess, FileStorage, Storage, StorageError}, utils::error_chain_fmt};

pub struct PageService {
    storage: Storage,
    public_bucket: String,
    protected_bucket: String,
}

#[derive(thiserror::Error)]
pub enum PageServiceError {
    #[error("Storage error: {0}")]
    StorageError(#[from] StorageError),
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for PageServiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for PageServiceError {
    fn status_code(&self) -> StatusCode {
        match self {
            PageServiceError::StorageError(storage_error) => storage_error.status_code(),
            PageServiceError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

#[derive(Debug, Clone)]
pub enum PageType {
    Public,
    Private,
}

impl TryFrom<String> for PageType {
    type Error = anyhow::Error;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.as_str() {
            "public" => Ok(PageType::Public),
            "private" => Ok(PageType::Private),
            _ => Err(anyhow!("Unknown page type: {}", value)),
        }
    }
}

impl PageType {
    pub fn is_public(&self) -> bool {
        match self {
            PageType::Public => true,
            PageType::Private => false,
        }
    }
}

impl PageService {
    pub fn new(storage: Storage, public_bucket: String, protected_bucket: String) -> Self {
        Self {
            storage,
            public_bucket,
            protected_bucket
        }
    }

    fn get_bucket(&self, is_public: bool) -> &str {
        if is_public {
            &self.public_bucket
        } else {
            &self.protected_bucket
        }
    }

    pub fn get_key(&self, key: &str) -> String {
        format!("pages/{}", key)
    }

    pub async fn upload_page(&self, mut key: String, data: Bytes, is_public: bool) -> Result<(), PageServiceError> {
        let bucket = self.get_bucket(is_public);

        key.push_str(".json");

        self.storage.store(&bucket, &key, data.to_vec()).await?;

        Ok(())
    }

    pub async fn get_page(&self, key: &str, is_public: bool) -> Result<FileAccess, PageServiceError> {
        let key = self.get_key(key);
        let bucket = self.get_bucket(is_public);
        Ok(self.storage.get_file_access(bucket, &key, is_public).await?)
    }

    pub async fn delete_page(&self, key: &str, is_public: bool) -> Result<(), PageServiceError> {
        let key = self.get_key(key);
        let bucket = self.get_bucket(is_public);
        Ok(self.storage.delete(bucket, &key).await?)
    }
}