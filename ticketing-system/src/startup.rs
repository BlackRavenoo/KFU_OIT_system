use std::net::TcpListener;

use actix_web::{dev::Server, web, App, HttpResponse, HttpServer};
use bb8_redis::{bb8::Pool, RedisConnectionManager};
use tracing_actix_web::TracingLogger;

use crate::{config::Settings};

pub fn run(
    listener: TcpListener,
    config: Settings,
    redis_pool: Pool<RedisConnectionManager>,
) -> Result<Server, std::io::Error> {
    let server = HttpServer::new(move || {
        App::new()
            .wrap(TracingLogger::default())
            .route("/health", web::to(HttpResponse::Ok))
    })
    .listen(listener)?
    .run();

    Ok(server)
}