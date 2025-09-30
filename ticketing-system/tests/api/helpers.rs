use fake::{faker::internet::en::SafeEmail, Fake};
use sqlx::{Connection, Executor, PgConnection, PgPool};
use wiremock::{matchers::{method, path}, Mock, MockServer, ResponseTemplate};
use std::{borrow::Cow, path::Path, sync::LazyLock};
use uuid::Uuid;
use ticketing_system::{
    auth::types::{UserRole, UserStatus}, config::{get_config, DatabaseSettings, S3Settings}, schema::{common::UserId, tickets::TicketId}, startup::Application, telemetry::{get_subscriber, init_subscriber}
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

pub struct InvitationLinks {
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
    pub async fn login(&self, body: &serde_json::Value) -> reqwest::Response {
        reqwest::Client::new()
            .post(format!("{}/v1/auth/login", self.address))
            .json(&body)
            .send()
            .await
            .expect("Failed to execute request")
    }

    // Returns access, refresh tokens
    pub async fn get_jwt_tokens(&self, email: &str, password: &str) -> (String, String) {
        let json = serde_json::json!({
            "email": email,
            "password": password,
            "fingerprint": "something",
        });

        let resp = self.login(&json).await;

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

    pub async fn get_admin_jwt_tokens(&self) -> (String, String) {
        self.get_jwt_tokens("admin@example.com", "admin").await
    }

    // Returns email
    pub async fn create_user(&self, role: UserRole) -> String {
        let email = SafeEmail().fake::<String>();
        
        // Password: admin
        sqlx::query!("
            INSERT INTO users (name, email, password_hash, role)
            VALUES (
                'user',
                $1,
                '$argon2id$v=19$m=19456,t=2,p=1$842ILagOz0rdwfNELPZhPg$KobLaelwC6ZPo2X0555H1rbyPlBo/+N7G+N2NOvKS7w',
                $2
            )",
            email,
            role as i16
        )
        .execute(&self.db_pool)
        .await
        .unwrap();

        email
    }

    pub async fn invite_user(&self, body: &serde_json::Value, access: Option<&str>) -> reqwest::Response {
        let mut builder = reqwest::Client::new()
            .post(format!("{}/v1/user/admin/invite", self.address))
            .json(body);

        if let Some(access) = access {
            builder = builder.bearer_auth(access)
        }
        
        builder.send()
            .await
            .expect("Failed to execute request")
    }

    pub fn get_invitation_links(
        &self,
        email_request: &wiremock::Request
    ) -> InvitationLinks {
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
            let mut invitation_link = reqwest::Url::parse(&raw_link).unwrap();
            assert_eq!(invitation_link.host_str().unwrap(), "127.0.0.1");

            invitation_link.set_port(Some(self.port)).unwrap();
            invitation_link
        };

        let html = get_link(&body["html"].as_str().unwrap());
        let plain_text = get_link(&body["text"].as_str().unwrap());

        InvitationLinks {
            html,
            plain_text
        }
    }

    pub async fn change_user_status(
        &self,
        user_id: UserId,
        status: UserStatus,
    ) {
        sqlx::query!(
            "
                UPDATE users
                SET status = $1
                WHERE id = $2
            ",
            status as i16,
            user_id
        )
        .execute(&self.db_pool)
        .await
        .unwrap();
    }

    pub async fn create_test_ticket(&self) -> reqwest::Response {
        let json = serde_json::json!({
            "title": "Test",
            "description": "Test description",
            "author": "Test author",
            "author_contacts": "Test contacts",
            "building_id": 1
        });

        self.create_ticket(&json, None).await
    }

    pub async fn create_ticket(&self, body: &serde_json::Value, attachments: Option<Vec<Attachment>>) -> reqwest::Response {
        let json_string = serde_json::to_string(body).unwrap();

        let mut form = reqwest::multipart::Form::new();
    
        form = form.part("fields", 
            reqwest::multipart::Part::text(json_string)
                .mime_str("application/json")
                .unwrap()
        );

        if let Some(files) = attachments {
            for attachment in files.into_iter() {
                form = form.part(
                    "attachments",
                    reqwest::multipart::Part::bytes(attachment.data)
                        .file_name(attachment.filename)
                        .mime_str(&attachment.mime_type)
                        .unwrap()
                );
            }
        }

        reqwest::Client::new()
            .post(format!("{}/v1/tickets/", self.address))
            .multipart(form)
            .send()
            .await
            .unwrap()
    }

    pub async fn get_ticket(&self, ticket_id: TicketId) -> reqwest::Response {
        let (access, _) = self.get_admin_jwt_tokens().await;

        reqwest::Client::new()
            .get(format!("{}/v1/tickets/{}", self.address, ticket_id))
            .bearer_auth(access)
            .send()
            .await
            .unwrap()
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
            path_style: true,
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
    
    // TODO: I need to clear my redis instance
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

// Returns email + token
pub async fn create_invitation(app: &TestApp) -> (String, String) {
    let email = SafeEmail().fake::<String>();

    let (access, _) = app.get_admin_jwt_tokens().await;

    let mock_guard = Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount_as_scoped(&app.email_server)
        .await;

    app.invite_user(
        &serde_json::json!({
            "email": email
        }),
        Some(&access)
    ).await;

    let email_request = &mock_guard.received_requests().await[0];

    let url = app.get_invitation_links(email_request).html;

    let (_, token) = url.query_pairs()
        .find(|(key, _)| key == &Cow::Borrowed("token"))
        .unwrap();

    (email, token.to_string())
}

#[derive(Debug, Clone)]
pub struct Attachment {
    pub data: Vec<u8>,
    pub filename: String,
    pub mime_type: String,
}

impl Attachment {
    pub fn new(data: Vec<u8>, filename: impl Into<String>, mime_type: impl Into<String>) -> Self {
        Self {
            data,
            filename: filename.into(),
            mime_type: mime_type.into(),
        }
    }

    pub fn from_filename(data: Vec<u8>, filename: impl Into<String>) -> Self {
        let filename = filename.into();
        let mime_type = match Path::new(&filename).extension().and_then(|s| s.to_str()) {
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("png") => "image/png",
            Some("gif") => "image/gif",
            Some("pdf") => "application/pdf",
            Some("txt") => "text/plain",
            _ => "application/octet-stream",
        };
        Self::new(data, filename, mime_type)
    }
}