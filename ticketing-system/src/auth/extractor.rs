use std::future::{ready, Ready};

use actix_web::{http::StatusCode, FromRequest, HttpMessage, HttpRequest, ResponseError};
use anyhow::Context;

use crate::{schema, utils::error_chain_fmt};

use super::jwt::Claims;

pub struct OptionalUserId(pub Option<schema::common::UserId>);

impl FromRequest for OptionalUserId {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        match req.extensions().get::<Claims>() {
            Some(claims) => {
                let user_id = match claims.sub.parse() {
                    Ok(id) => Some(id),
                    Err(e) => {
                        tracing::error!("Failed to parse id from sub field: {:?}", e);
                        None
                    },
                };
                ready(Ok(OptionalUserId(user_id)))
            },
            None => ready(Ok(OptionalUserId(None))),
        }
    }
}

pub struct UserId(pub schema::common::UserId);

#[derive(thiserror::Error)]
pub enum UserIdError {
    #[error("Missing claims")]
    MissingClaims,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for UserIdError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UserIdError {
    fn status_code(&self) -> StatusCode {
        match self {
            UserIdError::MissingClaims => StatusCode::UNAUTHORIZED,
            UserIdError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl FromRequest for UserId {
    type Error = UserIdError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        let result = req
            .extensions()
            .get::<Claims>()
            .ok_or(UserIdError::MissingClaims)
            .and_then(|claims| {
                claims.sub.parse()
                    .context("Failed to parse id from claims")
                    .map_err(Into::into)
            })
            .map(UserId);

        ready(result)
    }
}