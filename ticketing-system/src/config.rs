use std::{sync::Arc, time::Duration};

use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Deserializer};
use serde_aux::field_attributes::{deserialize_number_from_string, deserialize_bool_from_anything};
use sqlx::{postgres::{PgConnectOptions, PgSslMode}, ConnectOptions};

use crate::{domain::email::Email, email_client::{EmailClient, mailersend::MailerSendClient, smtp::SmtpClient}, storage::Storage};

#[derive(Deserialize, Debug)]
pub struct Settings {
    pub application: ApplicationSettings,
    pub database: DatabaseSettings,
    pub auth: AuthSettings,
    pub redis: RedisSettings,
    pub storage: StorageSettings,
    pub email_client: EmailClientSettings,
    pub event_publisher: EventPublisherSettings,
}

#[derive(Deserialize, Debug)]
pub struct ApplicationSettings {
    #[serde(deserialize_with = "deserialize_number_from_string")]
    pub port: u16,
    pub host: String,
    pub base_url: String,
}

#[derive(Deserialize, Debug)]
pub struct DatabaseSettings {
    pub username: String,
    pub password: SecretString,
    #[serde(deserialize_with = "deserialize_number_from_string")]
    pub port: u16,
    pub host: String,
    pub database_name: String,
    pub require_ssl: bool,
}

#[derive(Deserialize, Debug)]
pub struct AuthSettings {
    #[serde(deserialize_with = "deserialize_duration")]
    pub access_token_lifetime: Duration,
    #[serde(deserialize_with = "deserialize_duration")]
    pub refresh_token_lifetime: Duration,
    pub private_key_path: String,
    pub public_key_path: String,
    pub issuer: String,
}

#[derive(Deserialize, Debug)]
pub struct RedisSettings {
    pub url: String,
}

#[derive(Deserialize, Debug)]
pub struct StorageSettings {
    pub access_key: String,
    pub secret_key: SecretString,
    pub region: String,
    pub bucket: String,
    pub private_bucket: String,
    pub endpoint: String,
    #[serde(default = "default_always_proxy", deserialize_with = "deserialize_bool_from_anything")]
    pub always_proxy: bool,
    #[serde(default = "default_path_style", deserialize_with = "deserialize_bool_from_anything")]
    pub path_style: bool,
}

fn default_path_style() -> bool {
    true
}

fn default_always_proxy() -> bool {
    false
}

impl StorageSettings {
    pub async fn into_storage(&self) -> Storage {
        Storage::new(self).await
    }

    pub fn bucket(&self) -> String {
        self.bucket.clone()
    }

    pub fn private_bucket(&self) -> String {
        self.private_bucket.clone()
    }
}

impl DatabaseSettings {
    pub fn without_db(&self) -> PgConnectOptions {
        let ssl_mode = if self.require_ssl {
            PgSslMode::Require
        } else {
            PgSslMode::Prefer
        };
        PgConnectOptions::new()
            .host(&self.host)
            .username(&self.username)
            .password(self.password.expose_secret())
            .port(self.port)
            .ssl_mode(ssl_mode)
    }

    pub fn with_db(&self) -> PgConnectOptions {
        self.without_db().database(&self.database_name)
            .log_statements(tracing::log::LevelFilter::Trace)
    }
}

pub fn get_config() -> Result<Settings, config::ConfigError> {
    let base_path = std::env::current_dir().expect("Failed to determine the current directory");
    let config_dir = base_path.join("configuration");

    let env: Environment = std::env::var("APP_ENV")
        .unwrap_or_else(|_| "local".into())
        .try_into()
        .expect("Failed to parse APP_ENV");

    let settings = config::Config::builder()
        .add_source(config::File::from(config_dir.join("base")).required(true))
        .add_source(config::File::from(config_dir.join(env.as_str())).required(true))
        .add_source(
            config::Environment::with_prefix("APP")
                .prefix_separator("_")
                .separator("__"),
        )
        .build()?;

    settings.try_deserialize::<Settings>()
}

#[derive(Debug, Deserialize)]
pub struct EmailClientSettings {
    pub base_url: String,
    pub sender_email: String,
    pub timeout_milliseconds: u64,
    pub client_type: EmailClientType,
}

impl EmailClientSettings {
    pub fn get_email_client(&self) -> Arc<dyn EmailClient> {
        let sender = Email::parse(self.sender_email.clone()).expect("Invalid sender email address.");
        let timeout = Duration::from_millis(self.timeout_milliseconds);


        match &self.client_type {
            EmailClientType::MailerSend {
                authorization_token
            } => Arc::new(MailerSendClient::new(
                self.base_url.clone(),
                sender,
                authorization_token.clone(),
                timeout
            )),
            EmailClientType::Smtp {
                username,
                password
            } => Arc::new(SmtpClient::new(
                self.base_url.clone(),
                sender,
                username,
                password,
                timeout
            )),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "client_name", rename_all = "lowercase")]
pub enum EmailClientType {
    MailerSend {
        authorization_token: SecretString
    },
    Smtp {
        username: SecretString,
        password: SecretString,
    },
}

#[derive(Deserialize, Debug)]
pub struct EventPublisherSettings {
    pub base_url: String,
    pub bot_token: SecretString,
    pub chat_id: String,
    timeout_milliseconds: u64,
}

impl EventPublisherSettings {
    pub fn timeout(&self) -> Duration {
        Duration::from_millis(self.timeout_milliseconds)
    }
}

pub enum Environment {
    Local,
    Production,
}

impl Environment{
    pub fn as_str(&self) -> &'static str {
        match self {
            Environment::Local => "local",
            Environment::Production => "production",
        }
    }
}

impl TryFrom<String> for Environment {
    type Error = String;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "local" => Ok(Environment::Local),
            "production" => Ok(Environment::Production),
            other => Err(format!("{} is not a supported environment", other)),
        }
    }
}

pub fn deserialize_duration<'de, D>(deserializer: D) -> Result<Duration, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    parse_duration(&s).map_err(serde::de::Error::custom)
}

fn parse_duration(s: &str) -> Result<Duration, String> {
    let mut digits = String::new();
    let mut unit = String::new();
    
    for c in s.chars() {
        if c.is_ascii_digit() {
            digits.push(c);
        } else {
            unit.push(c);
        }
    }

    let num = digits.parse::<u64>().map_err(|e| e.to_string())?;
    
    match unit.as_str() {
        "s" => Ok(Duration::from_secs(num)),
        "m" => Ok(Duration::from_secs(num * 60)),
        "h" => Ok(Duration::from_secs(num * 3600)),
        "d" => Ok(Duration::from_secs(num * 86400)),
        _ => Err(format!("Unknown duration unit: {}", unit)),
    }
}