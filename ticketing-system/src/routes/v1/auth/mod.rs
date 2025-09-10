use actix_web::{web, HttpResponse, Responder};

use crate::{auth::{jwt::JwtService, token_store::TokenStore, types::RefreshToken, user_service::UserService}, schema::{auth::{LoginRequest, TokenResponse}}};

pub mod change_password;
pub mod refresh_token;
pub mod register;
pub mod me;

pub use change_password::change_password;
pub use refresh_token::refresh_token;
pub use register::register;
pub use me::me;

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