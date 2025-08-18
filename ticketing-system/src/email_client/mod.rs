use async_trait::async_trait;

use crate::domain::email::Email;

pub mod mailersend;

#[derive(Debug, thiserror::Error)]
pub enum EmailClientError {
    #[error(transparent)]
    UnexpectedError(#[from] anyhow::Error),
}

#[async_trait]
pub trait EmailClient: Send + Sync + 'static {
    async fn send_email(
        &self,
        recipient: &Email,
        subject: &str,
        html_content: &str,
        text_content: &str
    ) -> Result<(), EmailClientError>;
}