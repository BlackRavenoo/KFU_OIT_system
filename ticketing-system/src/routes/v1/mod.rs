use actix_web::web;

use crate::{auth::{middleware::JwtMiddleware, types::UserRole}, routes::v1::{auth::{login, me, refresh_token}, tickets::{create_ticket, delete_ticket, get_ticket, update_ticket}}};

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
                    .route("/", web::put().to(update_ticket)
                        .wrap(JwtMiddleware::default()))
                    .route("/{id}", web::delete().to(delete_ticket)
                        .wrap(JwtMiddleware::min_role(UserRole::Admin)))
                    .route("/{id}", web::get().to(get_ticket))
            )
    );
}