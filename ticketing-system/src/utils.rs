use std::{sync::Arc, time::Duration};

use futures_util::{stream, StreamExt as _};

use crate::services::image::{ImageService, ImageType};

#[tracing::instrument(
    name="Cleanup images",
    skip(image_service)
)]
pub async fn cleanup_images(
    image_service: Arc<ImageService>,
    keys: Vec<String>,
    timeout_secs: u64,
    image_type: ImageType,
) {
    tokio::spawn(async move {
        let cleanup = async {
            let keys_len = keys.len();
            let _results = stream::iter(keys)
                .map(|key| {
                    let service = &image_service;
                    let image_type = image_type.clone();
                    async move {
                        if let Err(e) = service.delete_image(image_type, &key).await {
                            tracing::warn!("Cleanup failed for {}: {:?}", key, e);
                        }
                    }
                })
                .buffer_unordered(keys_len)
                .collect::<Vec<_>>()
                .await;
        };

        if tokio::time::timeout(Duration::from_secs(timeout_secs), cleanup).await.is_err() {
            tracing::error!("Cleanup timed out after {} seconds", timeout_secs);
        }
    });
}