use actix_web::web;

use crate::{auth::{middleware::JwtMiddleware}, routes::v1::{auth::{login, me, refresh_token}, tickets::create_ticket}};

pub mod auth;
pub mod tickets;

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("v1")
            .service(
                web::scope("/auth")
                    .route("/login", web::post().to(login))
                    .route("/me", web::get().to(me)
                        .wrap(JwtMiddleware::default()))
                    .route("/token", web::get().to(refresh_token))
            )
            .service(
                web::scope("/tickets")
                    .route("/", web::post().to(create_ticket))
            )
    );
}