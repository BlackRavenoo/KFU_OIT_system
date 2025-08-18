use std::time::Duration;

use anyhow::Context;
use async_trait::async_trait;
use reqwest::Client;
use secrecy::{ExposeSecret as _, SecretString};
use serde::Serialize;

use crate::{domain::email::Email, email_client::{EmailClient, EmailClientError}};

pub struct MailerSendClient{
    http_client: Client,
    base_url: String,
    sender: Email,
    auth_token: SecretString,
}

impl MailerSendClient {
    pub fn new(base_url: String, sender: Email, auth_token: SecretString, timeout: Duration) -> Self {
        let http_client = Client::builder()
            .timeout(timeout)
            .build()
            .unwrap();

        Self {
            http_client,
            base_url: base_url.trim_end_matches('/').to_owned(),
            sender,
            auth_token,
        }
    }
}

#[async_trait]
impl EmailClient for MailerSendClient {
    async fn send_email(
        &self,
        recipient: &Email,
        subject: &str,
        html_content: &str,
        text_content: &str
    ) -> Result<(), EmailClientError> {
        let url = format!("{}/{}", self.base_url, "v1/email");

        let request_body = SendEmailRequest {
            from: ObjectField {
                email: self.sender.as_ref(),
                name: None
            },
            to: ObjectField {
                email: recipient.as_ref(),
                name: None
            },
            subject,
            text: text_content,
            html: html_content,
        };

        self.http_client
            .post(url)
            .bearer_auth(self.auth_token.expose_secret())
            .json(&request_body)
            .send()
            .await
            .context("Failed to send email request")?
            .error_for_status()
            .context("API returned an error response")?;

        Ok(())
    }
}

#[derive(Serialize)]
struct ObjectField<'a> {
    email: &'a str,
    name: Option<&'a str>
}

#[derive(Serialize)]
struct SendEmailRequest<'a> {
    from: ObjectField<'a>,
    to: ObjectField<'a>,
    subject: &'a str,
    text: &'a str,
    html: &'a str,
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use claim::{assert_err, assert_ok};
    use fake::{faker::{internet::en::SafeEmail, lorem::en::{Paragraph, Sentence}}, Fake, Faker};
    use secrecy::SecretString;
    use wiremock::{matchers::{any, header, header_exists, method, path}, Match, Mock, MockServer, Request, ResponseTemplate};

    use crate::{domain::email::Email, email_client::{mailersend::MailerSendClient, EmailClient as _}};


    fn subject() -> String {
        Sentence(1..2).fake()
    }

    fn content() -> String {
        Paragraph(1..10).fake()
    }

    fn email() -> Email {
        Email::parse(SafeEmail().fake()).unwrap()
    }

    fn email_client(base_url: String) -> MailerSendClient {
        MailerSendClient::new(
            base_url,
            email(),
            SecretString::new(Faker.fake::<String>().into()),
            Duration::from_millis(100),
        )
    }

    struct SendEmailBodyMatcher;

    impl Match for SendEmailBodyMatcher {
        fn matches(&self, request: &Request) -> bool {
            let res: Result<serde_json::Value, _> = serde_json::from_slice(&request.body);
            match res {
                Ok(body) => body.get("from").is_some()
                            && body.get("to").is_some()
                            && body.get("subject").is_some()
                            && body.get("text").is_some()
                            && body.get("html").is_some(),
                Err(_) => false,
            }
        }
    }

    #[tokio::test]
    async fn send_email_sends_the_expected_request() {
        let mock_server = MockServer::start().await;
        let email_client = email_client(mock_server.uri());

        Mock::given(header_exists("Authorization"))
            .and(header("Content-Type", "application/json"))
            .and(path("/v1/email"))
            .and(method("POST"))
            .and(SendEmailBodyMatcher)
            .respond_with(ResponseTemplate::new(200))
            .expect(1)
            .mount(&mock_server)
            .await;

        let _ = email_client
            .send_email(&email(), &subject(), &content(), &content())
            .await;
    }

    #[tokio::test]
    async fn send_email_succeeds_if_the_server_returns_200() {
        let mock_server = MockServer::start().await;
        let email_client = email_client(mock_server.uri());

        Mock::given(any())
            .respond_with(ResponseTemplate::new(200))
            .expect(1)
            .mount(&mock_server)
            .await;

        let outcome = email_client
            .send_email(&email(), &subject(), &content(), &content())
            .await;

        assert_ok!(outcome);
    }

    #[tokio::test]
    async fn send_email_fails_if_the_server_returns_500() {
        let mock_server = MockServer::start().await;
        let email_client = email_client(mock_server.uri());

        Mock::given(any())
            .respond_with(ResponseTemplate::new(500))
            .expect(1)
            .mount(&mock_server)
            .await;

        let outcome = email_client
            .send_email(&email(), &subject(), &content(), &content())
            .await;

        assert_err!(outcome);
    }

    #[tokio::test]
    async fn send_email_times_out_if_the_server_takes_too_long() {
        let mock_server = MockServer::start().await;
        let email_client = email_client(mock_server.uri());

        Mock::given(any())
            .respond_with(
                ResponseTemplate::new(200)
                    .set_delay(Duration::from_secs(180))
            )
            .expect(1)
            .mount(&mock_server)
            .await;

        let outcome = email_client
            .send_email(&email(), &subject(), &content(), &content())
            .await;

        assert_err!(outcome);
    }
}