use std::ops::Deref;
use actix_multipart::form::{MultipartForm, bytes::Bytes, json::Json};
use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::{Execute as _, PgPool, Postgres, Transaction};

use crate::{build_update_query, domain::description::Description, routes::v1::tickets::create_ticket::{insert_attachments, upload_attachments}, schema::tickets::{TicketId, TicketPriority, TicketSource, TicketStatus}, services::attachment::{AttachmentService, AttachmentServiceError, AttachmentType}, utils::{cleanup_images, error_chain_fmt}};

#[derive(Deserialize, Debug)]
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
    pub department_id: Option<i16>,
    pub source: Option<TicketSource>,
    pub planned_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub attachments_to_delete: Vec<String>,
}

#[derive(MultipartForm)]
pub struct UpdateTicketForm {
    pub fields: Json<UpdateTicketSchema>,
    pub attachments_to_add: Vec<Bytes>,
}

impl UpdateTicketSchema {
    fn all_fields_none(&self) -> bool {
        self.title.is_none()
            && self.description.is_none()
            && self.author.is_none()
            && self.author_contacts.is_none()
            && self.status.is_none()
            && self.priority.is_none()
            && self.cabinet.is_none()
            && self.note.is_none()
            && self.building_id.is_none()
            && self.department_id.is_none()
            && self.source.is_none()
            && self.planned_at.is_none()
    }
}

#[derive(thiserror::Error)]
pub enum UpdateTicketError {
    #[error(transparent)]
    AttachmentServiceError(#[from] AttachmentServiceError),
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
            UpdateTicketError::AttachmentServiceError(e) => e.status_code(),
            UpdateTicketError::AllFieldsEmpty => StatusCode::BAD_REQUEST,
            UpdateTicketError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn update_ticket(
    ticket_id: web::Path<TicketId>,
    MultipartForm(form): MultipartForm<UpdateTicketForm>,
    pool: web::Data<PgPool>,
    service: web::Data<AttachmentService>,
) -> Result<HttpResponse, UpdateTicketError> {
    let schema = form.fields.0;
    let ticket_id = ticket_id.into_inner();

    let all_fields_none = schema.all_fields_none();

    if all_fields_none
        && form.attachments_to_add.is_empty()
        && schema.attachments_to_delete.is_empty() {
        return Err(UpdateTicketError::AllFieldsEmpty)
    }

    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    let attachments_len = form.attachments_to_add.len();

    if attachments_len != 0 {
        let (keys, status) = upload_attachments(service.deref().clone(), form.attachments_to_add).await;

        if let Err(e) = status {
            if !keys.is_empty() {
                cleanup_images(service.into_inner(), keys, 30, AttachmentType::TicketAttachments).await;
            }
            return Err(e.into());
        }
    
        if let Err(e) = insert_attachments(&mut transaction, ticket_id, &keys).await
            .context("Failed to insert attachments into database") {
                if !keys.is_empty() {
                    cleanup_images(service.deref().clone(), keys, 30, AttachmentType::TicketAttachments).await;
                }
        
                return Err(UpdateTicketError::Unexpected(e));
            }
    }
    
    delete_ticket_attachments(
        &mut transaction,
        ticket_id,
        &schema.attachments_to_delete
    ).await
    .context("Failed to delete ticket attachments")?;

    if !all_fields_none {
        update(ticket_id, &schema, &mut transaction)
            .await?;
    }

    if !schema.attachments_to_delete.is_empty() {
        cleanup_images(service.into_inner(), schema.attachments_to_delete, 30, AttachmentType::TicketAttachments).await;
    }

    transaction.commit().await
        .context("Failed to commit transaction")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Update ticket in database",
    skip(transaction),
)]
async fn update(
    ticket_id: TicketId,
    schema: &UpdateTicketSchema,
    transaction: &mut Transaction<'_, Postgres>,
) -> Result<(), UpdateTicketError> {
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
    build_update_query!(builder, has_fields, schema.department_id, "department_id");
    build_update_query!(builder, has_fields, schema.source, "source");
    build_update_query!(builder, has_fields, schema.planned_at, "planned_at");
    
    let _ = has_fields;

    builder.push(" WHERE id = ");
    builder.push_bind(ticket_id);

    let query = builder.build();
    
    tracing::debug!("Update ticket query: {:?}", query.sql());

    query.execute(transaction.as_mut()).await
        .context("Failed to update ticket.")?;

    Ok(())
}

#[tracing::instrument(
    name = "Delete ticket attachments",
    skip(transaction)
)]
async fn delete_ticket_attachments(
    transaction: &mut Transaction<'_, Postgres>,
    ticket_id: TicketId,
    attachment_keys: &[String],
) -> Result<(), sqlx::Error> {
    if attachment_keys.is_empty() {
        return Ok(());
    }

    let mut builder = sqlx::QueryBuilder::new("DELETE FROM ticket_attachments WHERE ticket_id = ");
    
    builder.push_bind(ticket_id)
        .push(" AND key IN (");

    let mut separated = builder.separated(", ");

    for key in attachment_keys {
        separated.push_bind(key);
    }

    builder.push(")");

    builder.build()
        .execute(transaction.as_mut())
        .await?;

    Ok(())
}