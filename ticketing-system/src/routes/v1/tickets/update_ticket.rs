use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Deserialize;
use sqlx::{Execute as _, PgPool};

use crate::{build_update_query, domain::description::Description, schema::tickets::{TicketId, TicketPriority, TicketStatus}, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct UpdateTicketSchema {
    pub title: Option<String>,
    pub description: Option<Description>,
    pub author: Option<String>,
    pub author_contacts: Option<String>,
    pub status: Option<TicketStatus>,
    pub priority: Option<TicketPriority>,
    pub cabinet: Option<String>,
    pub note: Option<String>,
    pub building_id: Option<i16>,
}

#[derive(thiserror::Error)]
pub enum UpdateTicketError {
    #[error("All fields are empty")]
    AllFieldsEmpty,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for UpdateTicketError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateTicketError {
    fn status_code(&self) -> StatusCode {
        match self {
            UpdateTicketError::AllFieldsEmpty => StatusCode::BAD_REQUEST,
            UpdateTicketError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn update_ticket(
    ticket_id: web::Path<TicketId>,
    web::Json(schema): web::Json<UpdateTicketSchema>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, UpdateTicketError> {
    let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE tickets SET ");
    let mut has_fields = false;

    let description = schema.description.as_ref().map(|desc| desc.as_ref());

    build_update_query!(builder, has_fields, schema.title, "title");
    build_update_query!(builder, has_fields, description, "description");
    build_update_query!(builder, has_fields, schema.author, "author");
    build_update_query!(builder, has_fields, schema.author_contacts, "author_contacts");
    build_update_query!(builder, has_fields, schema.status, "status");
    build_update_query!(builder, has_fields, schema.priority, "priority");
    build_update_query!(builder, has_fields, schema.cabinet, "cabinet");
    build_update_query!(builder, has_fields, schema.note, "note");
    build_update_query!(builder, has_fields, schema.building_id, "building_id");

    if !has_fields {
        return Err(UpdateTicketError::AllFieldsEmpty);
    }

    builder.push(" WHERE id = ");
    builder.push_bind(ticket_id.into_inner());

    let query = builder.build();
    
    tracing::debug!("Update ticket query: {:?}", query.sql());

    query.execute(pool.as_ref()).await
        .context("Failed to update ticket.")?;

    Ok(HttpResponse::Ok().finish())
}