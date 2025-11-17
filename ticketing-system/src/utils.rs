use std::{sync::Arc, time::Duration};

use futures_util::{stream, StreamExt as _};
use argon2::{
    password_hash::{
        self, PasswordHash, PasswordVerifier
    },
    Argon2
};

use crate::services::attachment::{AttachmentService, AttachmentType};

#[tracing::instrument(
    name="Cleanup attachments",
    skip(service)
)]
pub async fn cleanup_images(
    service: Arc<AttachmentService>,
    keys: Vec<String>,
    timeout_secs: u64,
    image_type: AttachmentType,
) {
    tokio::spawn(async move {
        let cleanup = async {
            let keys_len = keys.len();
            let _results = stream::iter(keys)
                .map(|key| {
                    let service = &service;
                    let image_type = image_type.clone();
                    async move {
                        if let Err(e) = service.delete(image_type, &key).await {
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

pub fn error_chain_fmt(
    e: &impl std::error::Error,
    f: &mut std::fmt::Formatter<'_>,
) -> std::fmt::Result {
    writeln!(f, "{}\n", e)?;
    let mut current = e.source();
    while let Some(cause) = current {
        writeln!(f, "Caused by\n\t{}", cause)?;
        current = cause.source();
    }
    Ok(())
}

pub fn is_password_valid(
    password: &str,
    stored_hash: &str,
) -> Result<bool, password_hash::Error> {
    let parsed_hash = PasswordHash::new(stored_hash)?;
    
    match Argon2::default().verify_password(password.as_bytes(), &parsed_hash) {
        Ok(_) => Ok(true),
        Err(e) => match e {
            argon2::password_hash::Error::Password => Ok(false),
            _ => Err(e),
        },
    }
}