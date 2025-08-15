use std::{net::TcpListener, time::Duration};

use actix_multipart::form::MultipartFormConfig;
use actix_web::{dev::Server, web::{self, Data}, App, HttpResponse, HttpServer};
use bb8_redis::{bb8::Pool, RedisConnectionManager};
use sqlx::{postgres::PgPoolOptions, PgPool};
use tracing_actix_web::TracingLogger;

use crate::{auth::{jwt::JwtService, token_store::TokenStore, user_service::UserService}, config::Settings, routes::v1::config, services::image::ImageService};

pub struct Application {
    server: Server,
    port: u16,
}

impl Application {
    pub async fn build(config: Settings) -> Result<Self, std::io::Error> {
        let connection_pool = PgPoolOptions::new()
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

        let token_store = TokenStore::new(redis_pool.clone());
        let jwt_service = JwtService::new(&config.auth).unwrap();
        let user_service = UserService::new(connection_pool.clone());
        let image_service = ImageService::new(storage, config.storage.bucket());

        let port = listener.local_addr().unwrap().port();

        let server = run(
            listener,
            token_store,
            jwt_service,
            user_service,
            connection_pool,
            image_service
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

pub fn run(
    listener: TcpListener,
    token_store: TokenStore,
    jwt_service: JwtService,
    user_service: UserService,
    pool: PgPool,
    image_service: ImageService,
) -> Result<Server, std::io::Error> {
    let token_store = Data::new(token_store);
    let jwt_service = Data::new(jwt_service);
    let user_service = Data::new(user_service);
    let image_service = Data::new(image_service);
    let pool = Data::new(pool);

    let server = HttpServer::new(move || {
        App::new()
            .wrap(TracingLogger::default())
            .app_data(token_store.clone())
            .app_data(jwt_service.clone())
            .app_data(user_service.clone())
            .app_data(image_service.clone())
            .app_data(pool.clone())
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