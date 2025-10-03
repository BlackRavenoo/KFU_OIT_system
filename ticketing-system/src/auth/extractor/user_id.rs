use std::future::{ready, Ready};

use actix_web::{FromRequest, HttpMessage, HttpRequest};
use anyhow::Context;

use crate::{auth::{extractor::JwtExtractorError, jwt::Claims}, schema::common::UserId};

pub struct UserIdExtractor(pub UserId);

impl FromRequest for UserIdExtractor {
    type Error = JwtExtractorError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        let result = req
            .extensions()
            .get::<Claims>()
            .ok_or(JwtExtractorError::MissingClaims)
            .and_then(|claims| {
                claims.sub.parse()
                    .context("Failed to parse id from claims")
                    .map_err(Into::into)
            })
            .map(UserIdExtractor);

        ready(result)
    }
}