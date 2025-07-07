use std::net::TcpListener;

use actix_web::{dev::Server, web::{self, Data}, App, HttpResponse, HttpServer};
use tracing_actix_web::TracingLogger;

use crate::auth::token_store::TokenStore;

pub fn run(
    listener: TcpListener,
    token_store: TokenStore,
) -> Result<Server, std::io::Error> {
    let token_store = Data::new(token_store);
    let server = HttpServer::new(move || {
        App::new()
            .wrap(TracingLogger::default())
            .app_data(token_store.clone())
            .route("/health", web::to(HttpResponse::Ok))
    })
    .listen(listener)?
    .run();

    Ok(server)
}