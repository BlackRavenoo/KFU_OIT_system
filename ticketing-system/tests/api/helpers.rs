use fake::{faker::internet::en::SafeEmail, Fake};
use sqlx::{Connection, Executor, PgConnection, PgPool, postgres::PgPoolOptions};
use wiremock::{Mock, MockServer, ResponseTemplate, matchers::{method, path, path_regex}};
use std::{borrow::Cow, path::Path, sync::LazyLock};
use uuid::Uuid;
use ticketing_system::{
    auth::types::UserRole, config::{get_config, DatabaseSettings}, schema::{common::UserId, tickets::TicketId}, startup::Application, telemetry::{get_subscriber, init_subscriber}
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

pub const NEXT_USER_ID: UserId = 3;

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
    pub async fn get_jwt_tokens(&self, login: &str, password: &str) -> (String, String) {
        let json = serde_json::json!({
            "login": login,
            "password": password,
            "fingerprint": "something",
        });

        let resp = self.login(&json).await
            .error_for_status()
            .unwrap();

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

        let login = email.split('@').next().unwrap();
        
        // Password: admin
        sqlx::query!("
            INSERT INTO users (name, email, login, password_hash, role)
            VALUES (
                'user',
                $1,
                $2,
                '$argon2id$v=19$m=19456,t=2,p=1$842ILagOz0rdwfNELPZhPg$KobLaelwC6ZPo2X0555H1rbyPlBo/+N7G+N2NOvKS7w',
                $3
            )",
            email,
            login,
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
            assert!(matches!(links.len(), 1 | 5));
            let raw_link = links[links.len() - 1].as_str().to_owned();
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

    pub async fn create_test_ticket(&self) -> reqwest::Response {
        let json = serde_json::json!({
            "title": "Test",
            "description": "Test description",
            "author": "Test author",
            "author_contacts": "Test contacts",
            "building_id": 1,
            "department_id": 1,
        });

        self.create_ticket(&json, None).await
    }

    pub async fn create_ticket(&self, body: &serde_json::Value, attachments: Option<Vec<Attachment>>) -> reqwest::Response {
        let (access, _) = self.get_admin_jwt_tokens().await;
        
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
            .bearer_auth(&access)
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

    pub async fn update_ticket(&self, ticket_id: TicketId, body: &serde_json::Value) -> reqwest::Response {
        let (access, _) = self.get_admin_jwt_tokens().await;

        reqwest::Client::new()
            .put(format!("{}/v1/tickets/{}", self.address, ticket_id))
            .json(body)
            .bearer_auth(access)
            .send()
            .await
            .unwrap()
    }

    pub async fn deactivate_user_account(&self, user_id: UserId) -> reqwest::Response {
        let (access, _) = self.get_admin_jwt_tokens().await;

        reqwest::Client::new()
            .post(format!("{}/v1/user/{}/deactivate", self.address, user_id))
            .bearer_auth(access)
            .send()
            .await
            .unwrap()
    }

    pub async fn update_avatar(&self, access: Option<&str>, avatar: Vec<u8>) -> reqwest::Response {
        let form = reqwest::multipart::Form::new()
            .part(
                "avatar",
                reqwest::multipart::Part::bytes(avatar)
                    .file_name("avatar.png")
                    .mime_str("image/png")
                    .unwrap(),
            );

        let mut builder = reqwest::Client::new()
            .put(format!("{}/v1/user/avatar", self.address))
            .multipart(form);
        
        if let Some(access) = access {
            builder = builder.bearer_auth(access);
        }
        
        builder
            .send()
            .await
            .unwrap()
    }

    pub async fn get_pages(&self, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
        let mut builder = reqwest::Client::new()
            .get(format!(
                "{}/v1/pages/?{}",
                self.address,
                serde_qs::to_string(body).unwrap()
            ));

        if let Some(token) = token {
            builder = builder.bearer_auth(token);
        }

        builder
            .send()
            .await
            .unwrap()
    }

    pub async fn create_page(&self, body: &serde_json::Value, token: Option<&str>, expect: u64) -> reqwest::Response {
        let mut builder = reqwest::Client::new()
            .post(format!("{}/v1/pages/", self.address))
            .json(body);
        
        if let Some(token) = token {
            builder = builder.bearer_auth(token);
        }
    
        let _mock_guard = Mock::given(path_regex(r"/*-bucket/pages/.*\.json"))
            .and(method("PUT"))
            .respond_with(ResponseTemplate::new(200))
            .expect(expect)
            .mount_as_scoped(&self.s3_server)
            .await;
    
        builder
            .send()
            .await
            .unwrap()
    }

    pub async fn create_tag(&self, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
        let mut builder = reqwest::Client::new()
            .post(format!("{}/v1/tags/", self.address))
            .json(body);

        if let Some(token) = token {
            builder = builder.bearer_auth(token);
        }

        builder
            .send()
            .await
            .unwrap()
    }

    pub async fn create_test_tag(&self) {
        let (access, _) = self.get_admin_jwt_tokens().await;
    
        let json = serde_json::json!({
            "name": "Test tag",
            "synonyms": []
        });
    
        self.create_tag(&json, Some(&access)).await;
    }

    pub async fn create_test_page(&self) {
        let (access, _) = self.get_admin_jwt_tokens().await;
    
        let body = serde_json::json!({
            "data": {
                "text": "Some text"
            },
            "title": "Test title",
            "tags": [],
            "related": [],
            "is_public": true
        });
    
        self.create_page(&body, Some(&access), 1).await;
    }
    
    pub async fn create_private_page(&self) {
        let (access, _) = self.get_admin_jwt_tokens().await;
    
        let body = serde_json::json!({
            "data": {
                "text": "Some text"
            },
            "title": "Test title",
            "tags": [],
            "related": [],
            "is_public": false
        });
    
        self.create_page(&body, Some(&access), 1).await;
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

        c.storage = ticketing_system::config::StorageSettings {
            access_key: "access_key".into(),
            secret_key: "secret_key".into(),
            region: "ru-central-1".into(),
            bucket: "test-bucket".into(),
            private_bucket: "private-bucket".into(),
            endpoint: s3_server.uri(),
            always_proxy: true,
            path_style: true,
        };
        
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

    let connection_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect_with(config.with_db())
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