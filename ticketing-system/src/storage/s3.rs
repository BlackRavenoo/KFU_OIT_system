use std::time::Duration;

use anyhow::Context;
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
            .force_path_style(config.path_style)
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
                        match &e {
                            SdkError::ServiceError(err) => match err.err() {
                                GetObjectError::NoSuchKey(_) => Err(StorageError::NotFound),
                                _ => Err(StorageError::Other(e.into())),
                            },
                            _ => Err(StorageError::Other(e.into()))
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
                            .context("Failed to create presigned config")?;

                        let presigned_url = self.client
                            .get_object()
                            .bucket(bucket)
                            .key(key)
                            .presigned(presigning_config)
                            .await
                            .context("Failed to get presigned url")?;

                        presigned_url.uri().to_string()
                    };

                    Ok(FileAccess::ExternalUrl(url))
                },
                Err(e) => {
                    match &e {
                        SdkError::ServiceError(err) => match err.err() {
                            HeadObjectError::NotFound(_) => Err(StorageError::NotFound),
                            _ => Err(StorageError::Other(e.into())),
                        },
                        _ => Err(StorageError::Other(e.into()))
                    }
                }
            }
    }

    async fn store(&self, bucket: &str, key: &str, data: Vec<u8>) -> Result<(), StorageError> {
        self.client
            .put_object()
            .bucket(bucket)
            .key(key)
            .body(ByteStream::from(data))
            .send()
            .await
            .context("Failed to put object in S3")?;

        Ok(())
    }

    async fn delete(&self, bucket: &str, key: &str) -> Result<(), StorageError> {
        self.client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .context("Failed to delete object from S3")?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use aws_sdk_s3::{operation::{get_object::GetObjectOutput, head_object::HeadObjectOutput, put_object::PutObjectOutput}, Client};
    use aws_smithy_mocks::{mock, Rule, RuleMode};
    use claims::assert_ok;

    use crate::storage::{FileAccess, FileStorage};

    use super::S3Storage;

    fn get_s3_storage(mocks: &[Rule], always_proxy: bool) -> S3Storage {
        let client = aws_smithy_mocks::mock_client!(
            aws_sdk_s3,
            RuleMode::Sequential,
            mocks
        );

        S3Storage {
            client,
            base_url: "https://example.com".to_string(),
            always_proxy,
        }
    }

    #[tokio::test]
    async fn get_public_file_access_returns_external_link() {
        let mock = mock!(Client::head_object)
            .match_requests(|req| req.bucket() == Some("test-bucket") && req.key() == Some("test-key"))
            .then_output(|| HeadObjectOutput::builder().build());

        let storage = get_s3_storage(&[mock], false);

        let access = storage.get_file_access("test-bucket", "test-key", true).await.unwrap();

        assert!(matches!(access, FileAccess::ExternalUrl(_)));
    }

    #[tokio::test]
    async fn get_private_file_access_returns_external_link() {
        let head_mock = mock!(Client::head_object)
            .match_requests(|req| req.bucket() == Some("test-bucket") && req.key() == Some("test-key"))
            .then_output(|| HeadObjectOutput::builder().build());

        let get_mock = mock!(Client::get_object)
            .match_requests(|req| req.bucket() == Some("test-bucket") && req.key() == Some("test-key"))
            .then_output(|| GetObjectOutput::builder().build());

        let storage = get_s3_storage(&[head_mock, get_mock], false);

        let access = storage.get_file_access("test-bucket", "test-key", false).await.unwrap();

        assert!(matches!(access, FileAccess::ExternalUrl(_)));
    }

    #[tokio::test]
    async fn get_file_access_returns_stream_if_always_proxy() {
        let get_mock = mock!(Client::get_object)
            .match_requests(|req| req.bucket() == Some("test-bucket") && req.key() == Some("test-key"))
            .then_output(|| GetObjectOutput::builder().build());

        let storage = get_s3_storage(&[get_mock], true);

        let access = storage.get_file_access("test-bucket", "test-key", false).await.unwrap();

        assert!(matches!(access, FileAccess::Stream(_)));
    }

    #[tokio::test]
    async fn store_data_correctly_sends_data() {
        let data = b"test-data";

        let store_mock = mock!(Client::put_object)
            .match_requests(|req| req.bucket() == Some("test-bucket") && req.key() == Some("test-key") && req.body().bytes() == Some(data))
            .then_output(|| PutObjectOutput::builder().build());

            let storage = get_s3_storage(&[store_mock], false);

            let res = storage.store("test-bucket", "test-key", data.into()).await;

            assert_ok!(res);
    }
}