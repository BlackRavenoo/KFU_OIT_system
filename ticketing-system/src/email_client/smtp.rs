use std::time::Duration;

use anyhow::Context;
use async_trait::async_trait;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor, message::{Mailbox, MultiPart, SinglePart, header::ContentType}, transport::smtp::authentication::Credentials};
use secrecy::{ExposeSecret, SecretString};

use crate::{domain::email::Email, email_client::{EmailClient, EmailError}};

pub struct SmtpClient{
    transport: AsyncSmtpTransport<Tokio1Executor>,
    sender: Mailbox,
}

impl SmtpClient {
    pub fn new(base_url: String, sender: Email, username: &SecretString, password: &SecretString, timeout: Duration) -> Self {
        let creds = Credentials::new(username.expose_secret().to_owned(), password.expose_secret().to_owned());

        let transport = AsyncSmtpTransport::<Tokio1Executor>::relay(&base_url)
            .expect("Failed to create SMTP transport")
            .credentials(creds)
            .timeout(Some(timeout))
            .build();

        Self {
            transport,
            sender: sender.as_ref().parse().unwrap()
        }
    }
}

#[async_trait]
impl EmailClient for SmtpClient {
    async fn send_email(
        &self,
        recipient: &Email,
        subject: &str,
        html_content: &str,
        text_content: &str
    ) -> Result<(), EmailError> {
        let email = Message::builder()
            .from(self.sender.clone())
            .to(recipient.as_ref().parse().context("Failed to parse recipient email")?)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_PLAIN)
                            .body(text_content.to_string())
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(html_content.to_string())
                    )
            )
            .context("Failed to create multipart message")?;
        
        self.transport.send(email).await
            .context("Failed to send message")?;

        Ok(())
    }
}