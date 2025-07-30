use std::time::Duration;

use async_trait::async_trait;
use aws_config::{meta::credentials::CredentialsProviderChain, BehaviorVersion, Region};
use aws_sdk_s3::{error::SdkError, operation::{get_object::GetObjectError, head_object::HeadObjectError}, presigning::PresigningConfig, primitives::ByteStream, Client, Config};
use futures_util::TryStreamExt;
use secrecy::ExposeSecret;
use tokio_util::io::ReaderStream;

use crate::{config::S3Settings, storage::{FileAccess, FileStorage, StorageError}};

pub struct S3Storage {
    client: Client,
    base_url: String,
    always_proxy: bool,
}

impl S3Storage {
    pub async fn new(config: &S3Settings) -> Self {
        let creds = CredentialsProviderChain::default_provider()
            .await
            .or_else("custom", aws_sdk_s3::config::Credentials::new(
                &config.access_key,
                config.secret_key.expose_secret(),
                None,
                None,
                "custom"
            ));

        let s3_config = Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new(config.region.clone()))
            .credentials_provider(creds)
            .endpoint_url(&config.endpoint)
            .build();

        Self {
            client: Client::from_conf(s3_config),
            base_url: config.endpoint.trim_start_matches("http://")
                .trim_start_matches("https://")
                .to_string(),
            always_proxy: config.always_proxy,
        }
    }
}

#[async_trait]
impl FileStorage for S3Storage {
    async fn get_file_access(&self, bucket: &str, key: &str, is_public: bool) -> Result<FileAccess, StorageError> {
        if self.always_proxy {
            return match self.client
                .get_object()
                .bucket(bucket)
                .key(key)
                .send()
                .await {
                    Ok(res) => {
                        let stream = ReaderStream::new(res.body.into_async_read());
                        let stream = stream.map_err(anyhow::Error::from);
                        Ok(FileAccess::Stream(Box::pin(stream)))
                    },
                    Err(e) => {
                        tracing::error!("Failed to get file from S3: {:?}", e);
                        match &e {
                            SdkError::ServiceError(err) => match err.err() {
                                GetObjectError::NoSuchKey(_) => Err(StorageError::NotFound),
                                _ => Err(StorageError::Other(e.to_string())),
                            },
                            _ => Err(StorageError::Other(e.to_string()))
                        } 
                    }
                }
        }
        
        match self.client
            .head_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await {
                Ok(_) => {
                    let url = if is_public {
                        format!(
                            "https://{}.{}/{}",
                            bucket,
                            self.base_url,
                            key
                        )
                    } else {
                        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(3600))
                            .map_err(|e| StorageError::Other(e.to_string()))?;

                        let presigned_url = self.client
                            .get_object()
                            .bucket(bucket)
                            .key(key)
                            .presigned(presigning_config)
                            .await
                            .map_err(|e| StorageError::Other(e.to_string()))?;

                            presigned_url.uri().to_string()
                    };

                    Ok(FileAccess::ExternalUrl(url))
                },
                Err(e) => {
                    tracing::error!("Failed to get file from S3: {:?}", e);
                    match &e {
                        SdkError::ServiceError(err) => match err.err() {
                            HeadObjectError::NotFound(_) => Err(StorageError::NotFound),
                            _ => Err(StorageError::Other(e.to_string())),
                        },
                        _ => Err(StorageError::Other(e.to_string()))
                    }
                }
            }
    }

    async fn store(&self, bucket: &str, key: &str, data: Vec<u8>) -> Result<(), StorageError> {
        match self.client
            .put_object()
            .bucket(bucket)
            .key(key)
            .body(ByteStream::from(data))
            .send()
            .await {
                Ok(_) => Ok(()),
                Err(e) => {
                    tracing::error!("Failed to put object in S3: {:?}", e);
                    Err(StorageError::Other(e.to_string()))
                }
            }
    }

    async fn delete(&self, bucket: &str, key: &str) -> Result<(), StorageError> {
        match self.client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await {
                Ok(_) => Ok(()),
                Err(e) => {
                    tracing::error!("Failed to delete object from S3: {:?}", e);
                    Err(StorageError::Other(e.to_string()))
                }
            }
    }
}