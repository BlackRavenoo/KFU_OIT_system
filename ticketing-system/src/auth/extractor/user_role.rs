use std::future::{ready, Ready};

use actix_web::{FromRequest, HttpMessage, HttpRequest};

use crate::{auth::{extractor::JwtExtractorError, jwt::Claims, types::UserRole}};

pub struct UserRoleExtractor(pub UserRole);

impl FromRequest for UserRoleExtractor {
    type Error = JwtExtractorError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        let result = req
            .extensions()
            .get::<Claims>()
            .ok_or(JwtExtractorError::MissingClaims)
            .and_then(|claims| {
                Ok(UserRoleExtractor(claims.role))
            });

        ready(result)
    }
}