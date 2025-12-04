use std::{net::TcpListener, sync::Arc, time::Duration};

use actix_multipart::form::MultipartFormConfig;
use actix_web::{dev::Server, web::{self, Data}, App, HttpResponse, HttpServer};
use bb8_redis::{bb8::Pool, RedisConnectionManager};
use moka::future::CacheBuilder;
use sqlx::{postgres::PgPoolOptions, PgPool};
use tracing_actix_web::TracingLogger;

use crate::{auth::{jwt::JwtService, token_store::TokenStore}, cache_expiry::CacheExpiry, config::Settings, email_client::EmailClient, events::event_publisher::EventPublisher, routes::v1::{config, tickets::stats::TicketsStats}, services::{attachment::AttachmentService, pages::PageService, registration_token::RegistrationTokenStore}};

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

        let storage = config.storage.into_storage().await;
        
        let email_client = config.email_client.get_email_client();

        let jwt_service = JwtService::new(&config.auth).unwrap();
        let attachment_service = AttachmentService::new(storage.clone(), config.storage.bucket());
        let page_service = PageService::new(
            storage,
            config.storage.bucket(),
            config.storage.private_bucket()
        );

        let timeout = config.event_publisher.timeout();

        let event_publisher = EventPublisher::new(
            config.event_publisher.base_url,
            config.event_publisher.bot_token,
            config.event_publisher.chat_id,
            timeout,
        );

        let port = listener.local_addr().unwrap().port();

        let server = run(
            listener,
            redis_pool,
            jwt_service,
            connection_pool,
            attachment_service,
            page_service,
            email_client,
            event_publisher,
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
    attachment_service: AttachmentService,
    page_service: PageService,
    email_client: Arc<dyn EmailClient>,
    event_publisher: EventPublisher,
    base_url: String,
) -> Result<Server, std::io::Error> {
    let token_store = Data::new(TokenStore::new(redis_pool.clone()));
    let reg_store = Data::new(RegistrationTokenStore::new(redis_pool));
    let jwt_service = Data::new(jwt_service);
    let attachment_service = Data::new(attachment_service);
    let page_service = Data::new(page_service);
    let pool = Data::new(pool);
    let email_client = Data::from(email_client);
    let event_publisher = Data::new(event_publisher);
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
            .app_data(attachment_service.clone())
            .app_data(page_service.clone())
            .app_data(pool.clone())
            .app_data(email_client.clone())
            .app_data(event_publisher.clone())
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