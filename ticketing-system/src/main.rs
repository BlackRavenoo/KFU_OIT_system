use ticketing_system::{config::get_config, startup::Application, telemetry::{get_subscriber, init_subscriber}};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let subscriber = get_subscriber("ticketing-system".into(), "info".into(), std::io::stdout);
    init_subscriber(subscriber);

    let config = get_config().unwrap();

    let server = Application::build(config).await?;

    server.run_until_stopped().await?;

    Ok(())
}