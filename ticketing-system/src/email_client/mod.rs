use async_trait::async_trait;

use crate::domain::email::Email;

pub mod mailersend;

#[async_trait]
pub trait EmailClient: Send + Sync + 'static {
    async fn send_email(
        &self,
        recipient: &Email,
        subject: &str,
        html_content: &str,
        text_content: &str
    ) -> Result<(), reqwest::Error>;
}