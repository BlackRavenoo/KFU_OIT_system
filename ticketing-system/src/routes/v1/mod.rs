use actix_web::web;

use crate::{auth::{middleware::JwtMiddleware, types::UserRole}, routes::v1::{auth::{change_email, change_name, change_password, login, me, refresh_token}, images::get_image, tickets::{assign_ticket, create_ticket, delete_ticket, get_consts, get_ticket, get_tickets, unassign_ticket, update_ticket}, user::get_stats}};

pub mod auth;
pub mod tickets;
pub mod images;
pub mod user;

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("v1")
            .service(
                web::scope("/auth")
                    .route("/login", web::post().to(login))
                    .route("/me", web::get().to(me)
                        .wrap(JwtMiddleware::default()))
                    .route("/token", web::post().to(refresh_token))
            )
            .service(
                web::scope("/tickets")
                    .route("/consts", web::get().to(get_consts))
                    .route("/", web::post().to(create_ticket))
                    .route("/{id}", web::put().to(update_ticket)
                        .wrap(JwtMiddleware::default()))
                    .route("/", web::get().to(get_tickets)
                        .wrap(JwtMiddleware::default()))
                    .route("/{id}/assign", web::patch().to(assign_ticket)
                        .wrap(JwtMiddleware::default()))
                    .route("/{id}/unassign", web::patch().to(unassign_ticket)
                        .wrap(JwtMiddleware::default()))
                    .route("/{id}", web::get().to(get_ticket)
                        .wrap(JwtMiddleware::default()))
                    .route("/{id}", web::delete().to(delete_ticket)
                        .wrap(JwtMiddleware::min_role(UserRole::Admin)))       
            )
            .service(
                web::scope("/images")
                    .route("/{prefix}/{key}", web::get().to(get_image))
            )
            .service(
                web::scope("/user")
                    .wrap(JwtMiddleware::default())
                    .route("/stats", web::get().to(get_stats))
                    .route("/change_email", web::post().to(change_email))
                    .route("/change_name", web::post().to(change_name))
                    .route("/change_password", web::post().to(change_password))
            )
    );
}