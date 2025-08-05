use std::path::PathBuf;

use async_trait::async_trait;
use tokio::{fs, io::AsyncWriteExt};

use crate::config::FilesystemSettings;

use super::{FileAccess, FileStorage, StorageError};

pub struct FilesystemStorage {
    base_path: PathBuf,
    base_url: String,
}

impl FilesystemStorage {
    pub fn new(settings: &FilesystemSettings) -> Self {
        Self {
            base_path: settings.base_path.clone().into(),
            base_url: settings.base_url.clone(),
        }
    }

    fn get_file_path(&self, key: &str) -> PathBuf {
        self.base_path.join(key)
    }
}

#[async_trait]
impl FileStorage for FilesystemStorage {
    async fn store(&self, _bucket: &str, key: &str, data: Vec<u8>) -> Result<(), StorageError> {
        let file_path = self.get_file_path(key);
        
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| StorageError::Other(format!("Failed to create directory: {}", e)))?;
        }

        let mut file = fs::File::create(&file_path)
            .await
            .map_err(|e| StorageError::Other(format!("Failed to create file: {}", e)))?;

        file.write_all(&data)
            .await
            .map_err(|e| StorageError::Other(format!("Failed to write file: {}", e)))?;

        Ok(())
    }

    async fn delete(&self, _bucket: &str, key: &str) -> Result<(), StorageError> {
        let file_path = self.get_file_path(key);
        
        match fs::remove_file(&file_path).await {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err(StorageError::NotFound),
            Err(e) => Err(StorageError::Other(format!("Failed to delete file: {}", e))),
        }
    }

    async fn get_file_access(&self, _bucket: &str, key: &str, _is_public: bool) -> Result<FileAccess, StorageError> {
        let file_path = self.get_file_path(key);
        
        match fs::metadata(&file_path).await {
            Ok(_) => {
                let url = format!("{}/{}", self.base_url.trim_end_matches('/'), key);
                Ok(FileAccess::InternalUrl(url))
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err(StorageError::NotFound),
            Err(e) => Err(StorageError::Other(format!("Failed to access file: {}", e))),
        }
    }
}