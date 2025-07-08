use actix_web::{web, HttpResponse, Responder};

use crate::{auth::{jwt::JwtService, token_store::TokenStore, user_service::UserService}, schema::{LoginRequest, RefreshToken, TokenResponse}};


pub async fn login(
    web::Json(req): web::Json<LoginRequest>,
    user_service: web::Data<UserService>,
    jwt_service: web::Data<JwtService>,
    token_store: web::Data<TokenStore>
) -> impl Responder {
    match user_service.authenticate(&req.email, req.password).await {
        Ok(user) => {
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

            let refresh_token = match token_store.generate_refresh_token(refresh_token_data).await {
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