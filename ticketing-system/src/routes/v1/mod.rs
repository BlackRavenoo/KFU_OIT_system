use actix_web::web;

use crate::{auth::{middleware::JwtMiddleware, types::UserRole}, routes::v1::{auth::{change_password, login, me, refresh_token, register, validate_register_token}, images::get_image, tickets::{assign_ticket, create_ticket, delete_ticket, get_consts, get_ticket, get_tickets, unassign_ticket, update_ticket}, user::{change_user_role, change_user_status, get_users, invite_user, update_user_profile}}};

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
                    .route("/register", web::post().to(register))
                    .route("/validate", web::post().to(validate_register_token))
            )
            .service(
                web::scope("/tickets")
                    .route("/consts", web::get().to(get_consts))
                    .route("/stats", web::get().to(tickets::get_stats))
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
                web::scope("/user/admin")
                .wrap(JwtMiddleware::min_role(UserRole::Admin))
                .route("/invite", web::post().to(invite_user))
                .route("/role", web::patch().to(change_user_role))
            )
            .service(
                web::scope("/user")
                    .wrap(JwtMiddleware::default())
                    .route("/stats", web::get().to(user::get_stats))
                    .route("/profile", web::put().to(update_user_profile))
                    .route("/password", web::put().to(change_password))
                    .route("/list", web::get().to(get_users))
                    .route("/status", web::patch().to(change_user_status))
            )
    );
}