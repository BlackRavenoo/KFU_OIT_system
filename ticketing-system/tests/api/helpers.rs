use sqlx::{Connection, Executor, PgConnection, PgPool};
use wiremock::MockServer;
use std::sync::LazyLock;
use uuid::Uuid;
use ticketing_system::{
    config::{get_config, DatabaseSettings, S3Settings}, startup::Application, telemetry::{get_subscriber, init_subscriber}
};

static TRACING: LazyLock<()> = LazyLock::new(|| {
    let default_filter_level = "info".to_string();
    let subscriber_name = "test".to_string();

    if std::env::var("TEST_LOG").is_ok() {
        let subscriber = get_subscriber(subscriber_name, default_filter_level, std::io::stdout);
        init_subscriber(subscriber);
    } else {
        let subscriber = get_subscriber("test".into(), "debug".into(), std::io::sink);
        init_subscriber(subscriber);
    };
});

pub struct ConfirmationLinks {
    pub html: reqwest::Url,
    pub plain_text: reqwest::Url,
}

pub struct TestApp {
    pub address: String,
    pub port: u16,
    pub db_pool: PgPool,
    pub email_server: MockServer,
    pub s3_server: MockServer,
}

impl TestApp {
    // Returns access, refresh tokens
    pub async fn get_admin_jwt_tokens(&self) -> (String, String) {
        let json = serde_json::json!({
            "email": "admin@example.com",
            "password": "admin",
            "fingerprint": "something",
        });

        let resp = reqwest::Client::new()
            .post(format!("{}/v1/auth/login", self.address))
            .json(&json)
            .send()
            .await
            .expect("Failed to execute request")
            .error_for_status()
            .expect("Failed to get successful response");

        let response_json: serde_json::Value = resp
            .json()
            .await
            .expect("Failed to parse response as JSON");

        (
            response_json["access_token"]
                .as_str()
                .unwrap()
                .to_string(),
            response_json["refresh_token"]
                .as_str()
                .unwrap()
                .to_string()
        )
    }

    pub fn get_confirmation_links(
        &self,
        email_request: &wiremock::Request
    ) -> ConfirmationLinks {
        let body: serde_json::Value = serde_json::from_slice(
            &email_request.body
        ).unwrap();

        let get_link = |s| {
            let links: Vec<_> = linkify::LinkFinder::new()
                .links(s)
                .filter(|l| *l.kind() == linkify::LinkKind::Url)
                .collect();
            assert_eq!(links.len(), 1);
            let raw_link = links[0].as_str().to_owned();
            let mut confirmation_link = reqwest::Url::parse(&raw_link).unwrap();
            assert_eq!(confirmation_link.host_str().unwrap(), "127.0.0.1");

            confirmation_link.set_port(Some(self.port)).unwrap();
            confirmation_link
        };

        let html = get_link(&body["html"].as_str().unwrap());
        let plain_text = get_link(&body["text"].as_str().unwrap());

        ConfirmationLinks {
            html,
            plain_text
        }
    }
}

pub async fn spawn_app() -> TestApp {
    LazyLock::force(&TRACING);

    let email_server = MockServer::start().await;
    let s3_server = MockServer::start().await;

    let config = {
        let mut c = get_config().expect("Failed to read configuration");

        c.database.database_name = Uuid::new_v4().to_string();

        c.application.port = 0;

        c.email_client.base_url = email_server.uri();

        c.storage = ticketing_system::config::StorageSettings::S3(S3Settings {
            access_key: "access_key".into(),
            secret_key: "secret_key".into(),
            region: "ru-central-1".into(),
            bucket: "test-bucket".into(),
            endpoint: s3_server.uri(),
            always_proxy: true,
            path_style: false,
        });
        
        c
    };

    let db_pool = configure_database(&config.database).await;

    let application = Application::build(config)
        .await
        .expect("Failed to build application");

    let application_port = application.port();

    let address = format!("http://127.0.0.1:{}", application.port());

    let _ = tokio::spawn(application.run_until_stopped());
    
    TestApp {
        address,
        port: application_port,
        db_pool,
        email_server,
        s3_server,
    }
}

async fn configure_database(config: &DatabaseSettings) -> PgPool {
    let mut connection = PgConnection::connect_with(&config.without_db())
        .await
        .expect("Failed to connect to Postgres");
    connection
        .execute(format!(r#"CREATE DATABASE "{}";"#, config.database_name).as_str())
        .await
        .expect("Failed to create database");

    let connection_pool = PgPool::connect_with(config.with_db())
        .await
        .expect("Failed to connect to Postgres");
    sqlx::migrate!("./migrations")
        .run(&connection_pool)
        .await
        .expect("Failed to migrate the database");

    connection_pool
}