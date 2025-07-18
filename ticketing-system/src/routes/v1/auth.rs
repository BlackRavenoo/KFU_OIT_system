use actix_web::{web, HttpResponse, Responder};

use crate::{auth::{extractor::UserId, jwt::JwtService, token_store::TokenStore, types::RefreshToken, user_service::UserService}, schema::{LoginRequest, RefreshTokenRequest, TokenResponse}};


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

pub async fn refresh_token(
    req: web::Json<RefreshTokenRequest>,
    token_store: web::Data<TokenStore>,
    user_service: web::Data<UserService>,
    jwt_service: web::Data<JwtService>,
) -> impl Responder {
    let req = req.into_inner();
    
    let refresh_token = match token_store.validate_refresh_token(&req.refresh_token, &req.fingerprint).await {
        Ok(token) => token,
        Err(e) => {
            tracing::error!("Failed to validate refresh token: {:?}", e);
            return HttpResponse::BadRequest().finish()
        }
    };

    let role = match user_service.get_user_role(refresh_token.user_id).await {
        Ok(role) => role,
        Err(e) => {
            tracing::error!("Failed to get user role: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    let access_token = match jwt_service.create_access_token(refresh_token.user_id, role) {
        Ok(token) => token,
        Err(e) => {
            tracing::error!("Failed to create access token: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    let refresh_token = match token_store.rotate_refresh_token(
        &req.refresh_token,
        RefreshToken {
            user_id: refresh_token.user_id,
            fingerprint: req.fingerprint
        }
    ).await {
        Ok(token) => token,
        Err(e) => {
            tracing::error!("Failed to rotate refresh token: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    HttpResponse::Ok().json(TokenResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: jwt_service.access_token_lifetime.num_seconds()
    })
}