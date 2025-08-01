use std::net::TcpListener;

use actix_multipart::form::MultipartFormConfig;
use actix_web::{dev::Server, web::{self, Data}, App, HttpResponse, HttpServer};
use sqlx::PgPool;
use tracing_actix_web::TracingLogger;

use crate::{auth::{jwt::JwtService, token_store::TokenStore, user_service::UserService}, routes::v1::config, services::image::ImageService};

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