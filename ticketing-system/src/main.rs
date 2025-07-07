use bb8_redis::{bb8::Pool, RedisConnectionManager};
use sqlx::postgres::PgPoolOptions;
use std::net::TcpListener;

use ticketing_system::{auth::token_store::TokenStore, config::get_config, startup::run, telemetry::{get_subscriber, init_subscriber}};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let subscriber = get_subscriber("ticketing-system".into(), "info".into(), std::io::stdout);
    init_subscriber(subscriber);

    let config = get_config().unwrap();

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
        .build(redis_manager)
        .await
        .expect("Failed to build Redis pool");

    let token_store = TokenStore::new(redis_pool.clone());

    run(
        listener,
        token_store
    )?.await
}