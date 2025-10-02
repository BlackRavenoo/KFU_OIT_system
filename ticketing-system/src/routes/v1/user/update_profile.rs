use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::{Execute, PgPool};

use crate::{auth::extractor, build_update_query, domain::{email::Email, login::Login, name::Name}, schema::common::UserId, utils::error_chain_fmt};


#[derive(Debug, Deserialize)]
pub struct UpdateProfileSchema {
    pub email: Option<Email>,
    pub name: Option<Name>,
    pub login: Option<Login>,
}

#[derive(thiserror::Error)]
pub enum UpdateProfileError {
    #[error("There are no fields in the request")]
    HasNoFields,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for UpdateProfileError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateProfileError {
    fn status_code(&self) -> StatusCode {
        match self {
            UpdateProfileError::HasNoFields => StatusCode::BAD_REQUEST,
            UpdateProfileError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn update_user_profile(
    user_id: extractor::UserId,
    web::Json(schema): web::Json<UpdateProfileSchema>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, UpdateProfileError> {
    update_profile(user_id.0, &schema, &pool).await?;
    
    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Update user profile in the database",
)]
async fn update_profile(
    user_id: UserId,
    schema: &UpdateProfileSchema,
    pool: &PgPool,
) -> Result<(), UpdateProfileError> {
    let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE users SET ");
    let mut has_fields = false;

    let name = schema.name.as_ref().map(|name| name.as_ref());
    let email = schema.email.as_ref().map(|email| email.as_ref());
    let login = schema.login.as_ref().map(|login| login.as_ref());

    build_update_query!(builder, has_fields, name, "name");
    build_update_query!(builder, has_fields, email, "email");
    build_update_query!(builder, has_fields, login, "login");

    if !has_fields {
        return Err(UpdateProfileError::HasNoFields);
    }

    builder.push(" WHERE id = ").push_bind(user_id);

    let query = builder.build();

    tracing::debug!("Update user profile query: {:?}", query.sql());

    query.execute(pool).await
        .context("Failed to update profile.")?;

    Ok(())
}