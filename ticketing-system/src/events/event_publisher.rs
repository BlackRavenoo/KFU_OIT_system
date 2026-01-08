use std::time::Duration;

use anyhow::Context;
use chrono::Local;
use reqwest::Client;
use secrecy::{ExposeSecret, SecretString};

use crate::{events::Event, startup::ApplicationBaseUrl};

pub struct EventPublisher {
    http_client: Client,
    bot_token: SecretString,
    base_url: String,
    chat_id: String,
}

impl EventPublisher {
    pub fn new(base_url: String, bot_token: SecretString, chat_id: String, timeout: Duration) -> Self {
        let http_client = Client::builder()
            .timeout(timeout)
            .build()
            .unwrap();

        Self {
            http_client,
            bot_token,
            base_url: base_url.trim_end_matches('/').to_owned(),
            chat_id,
        }
    }

    #[tracing::instrument(
        name = "Publish an event",
        skip(self, application_url)
    )]
    pub async fn publish_event(&self, event: Event, application_url: &ApplicationBaseUrl) -> Result<(), anyhow::Error> {
        let text = Self::format_event(event, application_url);
        
        self.http_client
            .post(format!("{}/bot{}/sendMessage", self.base_url, self.bot_token.expose_secret()))
            .json(&serde_json::json!({
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": "HTML"
            }))
            .send()
            .await
            .context("Failed to send http request")?
            .error_for_status()
            .context("Failed to publish event")?;

        Ok(())
    }

    fn format_event(event: Event, application_url: &ApplicationBaseUrl) -> String {
        match event {
            Event::TicketCreated { id, title, author, author_contacts, description, planned_at, cabinet, building_name } => {                
                let description = description.as_ref();

                let description_preview = if description.chars().count() > 100 {
                    description.chars().take(100).collect::<String>() + "..."
                } else {
                    description.to_string()
                };

                let mut result = format!(
                    r#"<b>❗️Новая заявка❗️</b>
<a href="{}/ticket/{}"><b>{}</b></a>

{}

<i>🙋‍♂ Заявитель: {}
☎️ {}

🏛 {}, кабинет {}"#,
                    application_url.0,
                    id,
                    escape_html(&title),
                    escape_html(&description_preview),
                    escape_html(&author),
                    escape_html(&author_contacts),
                    escape_html(&building_name),
                    cabinet.as_deref().map(escape_html).unwrap_or("не указан".to_string())
                );

                if let Some(date) = planned_at {
                    result.push_str(&format!(".\n📅 Плановая дата: {}", date.with_timezone(&Local)));
                }

                result.push_str("</i>");
                result
            },
        }
    }
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}