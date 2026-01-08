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
            .ok_or(Self::Error::MissingClaims)
            .map(|claims| {
                Self(claims.role)
            });

        ready(result)
    }
}

pub struct OptionalUserRoleExtractor(pub Option<UserRole>);

impl FromRequest for OptionalUserRoleExtractor {
    type Error = JwtExtractorError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        let result = match req
            .extensions()
            .get::<Claims>() {
                Some(claims) => Ok(Self(Some(claims.role))),
                None => Ok(Self(None)),
            };

        ready(result)
    }
}