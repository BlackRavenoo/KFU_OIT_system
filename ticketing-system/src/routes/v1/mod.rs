use actix_web::web;

use crate::{auth::{middleware::JwtMiddleware, types::UserRole}, routes::v1::{auth::{login, me}, tickets::create_ticket}};

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
            )
            .service(
                web::scope("/tickets")
                    .route("/", web::post().to(create_ticket))
            )
    );
}