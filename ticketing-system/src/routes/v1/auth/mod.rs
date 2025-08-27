use actix_web::{web, HttpResponse, Responder};

use crate::{auth::{extractor::UserId, jwt::JwtService, token_store::TokenStore, types::RefreshToken, user_service::UserService}, schema::{auth::{LoginRequest, TokenResponse}, tickets::{ChangeEmailSchema, ChangeNameSchema}}};

pub mod change_password;
pub mod refresh_token;

pub use change_password::change_password;
pub use refresh_token::refresh_token;

pub async fn login(
    web::Json(req): web::Json<LoginRequest>,
    user_service: web::Data<UserService>,
    jwt_service: web::Data<JwtService>,
    token_store: web::Data<TokenStore>
) -> impl Responder {
    match user_service.authenticate(req.email, req.password).await {
        Ok(user) => {
            if !user.status.can_auth() {
                return HttpResponse::Forbidden().finish()
            }
            
            let access_token = match jwt_service.create_access_token(user.id, user.role) {
                Ok(token) => token,
                Err(e) => {
                    tracing::error!("Failed to create access token: {:?}", e);
                    return HttpResponse::InternalServerError().finish();
                },
            };

            let refresh_token_data = RefreshToken {
                user_id: user.id,
                fingerprint: req.fingerprint,
            };

            let refresh_token = match token_store.generate_refresh_token(&refresh_token_data).await {
                Ok(token) => token,
                Err(e) => {
                    tracing::error!("Failed to create refresh token: {:?}", e);
                    return HttpResponse::InternalServerError().finish()
                },
            };

            let resp = TokenResponse {
                access_token,
                refresh_token,
                token_type: "Bearer".to_string(),
                expires_in: jwt_service.access_token_lifetime.num_seconds(),
            };
            
            HttpResponse::Ok().json(resp)
        },
        Err(_) => {
            HttpResponse::Unauthorized().finish()
        },
    }
}

pub async fn me(
    id: UserId,
    user_service: web::Data<UserService>
) -> impl Responder {
    let user_id = match id.0 {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish()
    };

    match user_service.get_user(user_id).await {
        Ok(Some(user)) => HttpResponse::Ok().json(user),
        Ok(None) => HttpResponse::Unauthorized().finish(),
        Err(e) => {
            tracing::error!("Failed to get user: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn change_name(
    user_id: UserId,
    web::Json(req): web::Json<ChangeNameSchema>,
    user_service: web::Data<UserService>,
) -> impl Responder {
    let user_id = match user_id.0 {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish()
    };

    match user_service.change_username(user_id, req.name).await {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(e) => {
            tracing::error!("Failed to change username: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}

pub async fn change_email(
    user_id: UserId,
    web::Json(req): web::Json<ChangeEmailSchema>,
    user_service: web::Data<UserService>,
) -> impl Responder {
    let user_id = match user_id.0 {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish()
    };

    match user_service.change_email(user_id, req.email).await {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(e) => {
            tracing::error!("Failed to change email: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}