use std::{net::TcpListener, time::Duration};

use actix_multipart::form::MultipartFormConfig;
use actix_web::{dev::Server, web::{self, Data}, App, HttpResponse, HttpServer};
use bb8_redis::{bb8::Pool, RedisConnectionManager};
use moka::future::CacheBuilder;
use sqlx::{postgres::PgPoolOptions, PgPool};
use tracing_actix_web::TracingLogger;

use crate::{auth::{jwt::JwtService, token_store::TokenStore}, cache_expiry::CacheExpiry, config::Settings, email_client::mailersend::MailerSendClient, routes::v1::{config, tickets::stats::TicketsStats}, services::{image::ImageService, pages::PageService, registration_token::RegistrationTokenStore}};

pub struct Application {
    server: Server,
    port: u16,
}

impl Application {
    pub async fn build(config: Settings) -> Result<Self, std::io::Error> {
        let connection_pool = PgPoolOptions::new()
            .max_connections(30)
            .connect_lazy_with(config.database.with_db());

        sqlx::migrate!("./migrations")
            .run(&connection_pool)
            .await
            .expect("Failed to migrate the database");

        let address = format!("{}:{}", config.application.host, config.application.port);

        let listener = TcpListener::bind(address)?;

        let redis_manager = RedisConnectionManager::new(config.redis.url.clone())
            .expect("Failed to create Redis manager");
        let redis_pool = Pool::builder()
            .connection_timeout(Duration::from_millis(500))
            .build(redis_manager)
            .await
            .expect("Failed to build Redis pool");

        let sender_email = config.email_client.sender()
            .expect("Invalid sender email address.");
        let timeout = config.email_client.timeout();

        let storage = config.storage.into_storage().await;
        
        let email_client = MailerSendClient::new(
            config.email_client.base_url,
            sender_email,
            config.email_client.authorization_token,
            timeout
        );

        let jwt_service = JwtService::new(&config.auth).unwrap();
        let image_service = ImageService::new(storage.clone(), config.storage.bucket());
        let page_service = PageService::new(
            storage,
            config.storage.bucket(),
            config.storage.private_bucket()
        );

        let port = listener.local_addr().unwrap().port();

        let server = run(
            listener,
            redis_pool,
            jwt_service,
            connection_pool,
            image_service,
            page_service,
            email_client,
            config.application.base_url
        )?;

        Ok(Self {
            server,
            port
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub async fn run_until_stopped(self) -> Result<(), std::io::Error> {
        self.server.await
    }
}

pub struct ApplicationBaseUrl(pub String);

pub fn run(
    listener: TcpListener,
    redis_pool: Pool<RedisConnectionManager>,
    jwt_service: JwtService,
    pool: PgPool,
    image_service: ImageService,
    page_service: PageService,
    email_client: MailerSendClient,
    base_url: String,
) -> Result<Server, std::io::Error> {
    let token_store = Data::new(TokenStore::new(redis_pool.clone()));
    let reg_store = Data::new(RegistrationTokenStore::new(redis_pool));
    let jwt_service = Data::new(jwt_service);
    let image_service = Data::new(image_service);
    let page_service = Data::new(page_service);
    let pool = Data::new(pool);
    let email_client = Data::new(email_client);
    let base_url = Data::new(ApplicationBaseUrl(base_url));

    let stats_cache = Data::new(
        CacheBuilder::<(), TicketsStats, _>::new(1)
            .expire_after(CacheExpiry(Duration::from_secs(300)))
            .build()
    );

    let server = HttpServer::new(move || {
        App::new()
            .wrap(TracingLogger::default())
            .app_data(token_store.clone())
            .app_data(reg_store.clone())
            .app_data(jwt_service.clone())
            .app_data(image_service.clone())
            .app_data(page_service.clone())
            .app_data(pool.clone())
            .app_data(email_client.clone())
            .app_data(base_url.clone())
            .app_data(stats_cache.clone())
            .app_data(
                MultipartFormConfig::default()
                    .memory_limit(30 * 1024 * 1024)   
            )
            .service(
                web::scope("")
                    .route("/health", web::to(HttpResponse::Ok))
                    .configure(config)
            )
    })
    .listen(listener)?
    .run();

    Ok(server)
}