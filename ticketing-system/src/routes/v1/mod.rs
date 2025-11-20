use actix_web::web;

use crate::{auth::{middleware::JwtMiddleware, types::UserRole}, routes::v1::{attachments::get_attachment, auth::{change_password, login, me, refresh_token, register, validate_register_token}, pages::{create_page, delete_page, get_page, get_page_data, get_pages}, tags::{create_tag, delete_tag, search_tags, update_tag}, tickets::{assign_ticket_to_self, assign_ticket_to_user, create_ticket, delete_ticket, get_consts, get_ticket, get_tickets, unassign_ticket_from_self, unassign_ticket_from_user, update_ticket}, user::{activate_account, change_user_role, change_user_status, deactivate_account, get_users, invite_user, update_avatar, update_user_profile}}};

pub mod auth;
pub mod tickets;
pub mod attachments;
pub mod user;
pub mod pages;
pub mod tags;

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
                    .route("/", web::post().to(create_ticket)
                        .wrap(JwtMiddleware::default()))
                    .route("/{id}", web::put().to(update_ticket)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/", web::get().to(get_tickets)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/{id}/assign", web::patch().to(assign_ticket_to_self)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/{id}/unassign", web::patch().to(unassign_ticket_from_self)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/{id}/assign/{user_id}", web::post().to(assign_ticket_to_user)
                        .wrap(JwtMiddleware::min_role(UserRole::Moderator)))
                    .route("/{id}/unassign/{user_id}", web::post().to(unassign_ticket_from_user)
                        .wrap(JwtMiddleware::min_role(UserRole::Moderator)))
                    .route("/{id}", web::get().to(get_ticket)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/{id}", web::delete().to(delete_ticket)
                        .wrap(JwtMiddleware::min_role(UserRole::Admin)))
            )
            // TODO: Delete this
            .service(
                web::scope("/images")
                    .route("/{prefix}/{key}", web::get().to(get_attachment))
            )
            .service(
                web::scope("/attachments")
                    .route("/{prefix}/{key}", web::get().to(get_attachment))
            )
            .service(
                web::scope("/user/admin")
                .wrap(JwtMiddleware::min_role(UserRole::Admin))
                    .route("/invite", web::post().to(invite_user))
                    .route("/role", web::patch().to(change_user_role))
            )
            .service(
                web::scope("/user")
                    .route("/stats", web::get().to(user::get_stats)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/profile", web::put().to(update_user_profile)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/password", web::put().to(change_password)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/list", web::get().to(get_users)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/status", web::patch().to(change_user_status)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/avatar", web::put().to(update_avatar)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .service(
                        web::scope("/{id}")
                        .route("/activate", web::post().to(activate_account)
                            .wrap(JwtMiddleware::min_role(UserRole::Admin)))
                        .route("/deactivate", web::post().to(deactivate_account)
                            .wrap(JwtMiddleware::min_role(UserRole::Admin)))
                    )
            )
            .service(
                web::scope("/pages")
                    .route("/", web::post().to(create_page)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
                    .route("/", web::get().to(get_pages)
                        .wrap(JwtMiddleware::optional()))
                    .route("/{id}", web::get().to(get_page)
                        .wrap(JwtMiddleware::optional()))
                    .route("/{id}", web::delete().to(delete_page)
                        .wrap(JwtMiddleware::min_role(UserRole::Employee)))
            )
            .service(
                web::scope("/page")
                    .route("/{prefix}/{key}", web::get().to(get_page_data)
                        .wrap(JwtMiddleware::optional()))
            )
            .service(
                web::scope("/tags")
                    .route("/", web::post().to(create_tag)
                        .wrap(JwtMiddleware::min_role(UserRole::Moderator)))
                    .route("/", web::get().to(search_tags))
                    .route("/{id}", web::put().to(update_tag)
                        .wrap(JwtMiddleware::min_role(UserRole::Moderator)))
                    .route("/{id}", web::delete().to(delete_tag)
                        .wrap(JwtMiddleware::min_role(UserRole::Moderator)))
            )
    );
}