use async_trait::async_trait;

use crate::{domain::email::Email, utils::error_chain_fmt};

pub mod mailersend;
pub mod smtp;

#[async_trait]
pub trait EmailClient: Send + Sync + 'static {
    async fn send_email(
        &self,
        recipient: &Email,
        subject: &str,
        html_content: &str,
        text_content: &str
    ) -> Result<(), EmailError>;
}

#[derive(thiserror::Error)]
pub enum EmailError {
    #[error("Authentication failed")]
    AuthenticationError,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for EmailError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}