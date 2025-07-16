use std::{future::{ready, Ready}, rc::Rc};

use actix_web::{body::{EitherBody, MessageBody}, dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform}, http::{header::AUTHORIZATION, StatusCode}, web::Data, Error, HttpMessage as _, HttpResponse};
use futures_util::future::LocalBoxFuture;

use crate::auth::{jwt::JwtService, types::UserRole};

#[derive(Clone)]
pub struct JwtConfig {
    pub min_role: UserRole,
    pub optional: bool,
}

impl Default for JwtConfig {
    fn default() -> Self {
        Self {
            min_role: UserRole::Employee,
            optional: false,
        }
    }
}

impl JwtConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn min_role(mut self, role: UserRole) -> Self {
        self.min_role = role;
        self
    }

    pub fn optional(mut self) -> Self {
        self.optional = true;
        self
    }
}

pub struct JwtMiddleware {
    config: JwtConfig,
}

impl JwtMiddleware {
    pub fn new(config: JwtConfig) -> Self {
        Self { config }
    }
}

impl Default for JwtMiddleware {
    fn default() -> Self {
        Self::new(JwtConfig::default())
    }
}

impl JwtMiddleware {
    pub fn min_role(role: UserRole) -> Self {
        Self::new(JwtConfig::new().min_role(role))
    }

    pub fn optional() -> Self {
        Self::new(JwtConfig::new().optional())
    }
}

impl<S, B> Transform<S, ServiceRequest> for JwtMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = JwtMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(JwtMiddlewareService {
            service: Rc::new(service),
            config: self.config.clone(),
        }))
    }
}

pub struct JwtMiddlewareService<S> {
    service: Rc<S>,
    config: JwtConfig,
}

impl<S, B> Service<ServiceRequest> for JwtMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let config = self.config.clone();

        Box::pin(async move {
            let validator = match req.app_data::<Data<JwtService>>() {
                Some(v) => v,
                None => {
                    tracing::error!("JwtService not found in app data");
                    return Ok(create_error_response(req, "", StatusCode::INTERNAL_SERVER_ERROR));
                }
            };

            let auth_header = req
                .headers()
                .get(AUTHORIZATION)
                .and_then(|h| h.to_str().ok());

            let auth_header = match auth_header {
                Some(header) => header,
                None => {
                    if config.optional {
                        let res = service.call(req).await?;
                        return Ok(res.map_body(|_, body| EitherBody::left(body)));
                    } else {
                        return Ok(create_error_response(req, "Missing Authorization header", StatusCode::UNAUTHORIZED));
                    }
                }
            };

            if !auth_header.starts_with("Bearer ") {
                return Ok(create_error_response(req, "Invalid Authorization header format", StatusCode::UNAUTHORIZED));
            }
        
            let token = auth_header.trim_start_matches("Bearer ");
            
            if token.is_empty() {
                return Ok(create_error_response(req, "Empty token", StatusCode::UNAUTHORIZED));
            }

            let claims = match validator.validate_token(&token) {
                Ok(claims) => claims,
                Err(e) => {
                    tracing::warn!("JWT validation failed: {}", e);
                    return Ok(create_error_response(req, &e.to_string(), StatusCode::UNAUTHORIZED));
                }
            };

            if !claims.role.has_access(config.min_role) {
                tracing::warn!("User {} lacks required role: {:?}", claims.sub, config.min_role);
                return Ok(create_error_response(req, "Insufficient permissions", StatusCode::FORBIDDEN));
            }

            req.extensions_mut().insert(claims);

            let res = service.call(req).await?;
            Ok(res.map_body(|_, body| EitherBody::left(body)))
        })
    }
}

fn create_error_response<B>(req: ServiceRequest, message: &str, status: StatusCode) -> ServiceResponse<EitherBody<B>>
where
    B: MessageBody
{
    let (req, _) = req.into_parts();
    let response = HttpResponse::build(status)
        .json(serde_json::json!({
            "error": status.canonical_reason().unwrap_or("Unknown error"),
            "message": message
        }))
        .map_body(|_, body| EitherBody::right(body));
    
    ServiceResponse::new(req, response)
}