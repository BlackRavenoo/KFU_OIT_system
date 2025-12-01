use std::{ops::Deref, sync::Arc};

use actix_multipart::form::{bytes::Bytes, json::Json, MultipartForm};
use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use chrono::{DateTime, Utc};
use futures_util::{stream, StreamExt as _};
use serde::Deserialize;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{auth::extractor::UserIdExtractor, domain::description::Description, events::{event_publisher::EventPublisher, events::Event}, schema::{common::UserId, tickets::TicketId}, services::attachment::{Attachment, AttachmentService, AttachmentServiceError, AttachmentType}, startup::ApplicationBaseUrl, utils::{cleanup_images, error_chain_fmt}};

#[derive(Deserialize, Debug)]
pub struct CreateTicketSchema {
    pub title: String,
    pub description: Description,
    pub author: String,
    pub author_contacts: String,
    pub planned_at: Option<DateTime<Utc>>,
    pub cabinet: Option<String>,
    pub building_id: i16,
    pub department_id: i16,
}

#[derive(MultipartForm)]
pub struct CreateTicketForm {
    pub fields: Json<CreateTicketSchema>,
    pub attachments: Vec<Bytes>,
}

#[derive(thiserror::Error)]
pub enum CreateTicketError {
    #[error(transparent)]
    AttachmentServiceError(#[from] AttachmentServiceError),
    #[error("A lot of attachments")]
    ALotOfAttachments,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for CreateTicketError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateTicketError {
    fn status_code(&self) -> StatusCode {
        match self {
            CreateTicketError::AttachmentServiceError(e) => e.status_code(),
            CreateTicketError::ALotOfAttachments => StatusCode::BAD_REQUEST,
            CreateTicketError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn create_ticket(
    MultipartForm(ticket): MultipartForm<CreateTicketForm>,
    pool: web::Data<PgPool>,
    service: web::Data<AttachmentService>,
    base_url: web::Data<ApplicationBaseUrl>,
    event_publisher: web::Data<EventPublisher>,
    user_id: UserIdExtractor,
) -> Result<HttpResponse, CreateTicketError> {
    if ticket.attachments.len() > 5 {
        return Err(CreateTicketError::ALotOfAttachments)
    }

    let fields = ticket.fields;

    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    let ticket_id = insert_ticket(&mut transaction, &fields.0, user_id.0).await
        .context("Failed to create ticket")?;

    let attachments_len = ticket.attachments.len();

    if attachments_len != 0 {
        let (keys, status) = upload_attachments(service.deref().clone(), ticket.attachments).await;

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
        
                return Err(CreateTicketError::Unexpected(e));
            }
    }

    transaction.commit().await
        .context("Failed to commit transaction")?;

    match fetch_building_name(
        &pool,
        fields.building_id
    )
    .await {
        Ok(building_name) => {
            let res = event_publisher.publish_event(
                Event::TicketCreated {
                    id: ticket_id,
                    title: fields.0.title,
                    author: fields.0.author,
                    author_contacts: fields.0.author_contacts,
                    description: fields.0.description,
                    planned_at: fields.0.planned_at,
                    cabinet: fields.0.cabinet,
                    building_name
                },
                &base_url
            )
            .await;

            if let Err(e) = res {
                tracing::error!("{:?}", e);
            }
        },
        Err(e) => tracing::error!("Failed to fetch building name: {:?}", e),
    };

    Ok(HttpResponse::Created().finish())
}

#[tracing::instrument(
    name = "Insert ticket into database",
    skip(transaction)
)]
async fn insert_ticket(
    transaction: &mut Transaction<'_, Postgres>,
    fields: &CreateTicketSchema,
    author_id: UserId,
) -> Result<TicketId, sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO tickets(title, description, author, author_contacts, planned_at, cabinet, building_id, department_id, author_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        "#,
        fields.title,
        fields.description.as_ref(),
        fields.author,
        fields.author_contacts,
        fields.planned_at,
        fields.cabinet,
        fields.building_id,
        fields.department_id,
        author_id
    )
    .fetch_one(transaction.as_mut())
    .await
    .map(|row| row.id)
}

#[tracing::instrument(
    name = "Upload attachments",
    skip_all
)]
async fn upload_attachments(
    service: Arc<AttachmentService>,
    attachments: Vec<Bytes>,
) -> (Vec<String>, Result<(), AttachmentServiceError>) {
    let attachments_len = attachments.len();

    let attachments: Result<Vec<_>, _> = attachments.into_iter()
        .map(|b| Attachment::try_from(b))
        .collect();
    
    let attachments = match attachments {
        Ok(att) => att,
        Err(e) => return (vec![], Err(e.into())),
    };

    let results = stream::iter(attachments)
        .map(|attachment| service.upload(
            AttachmentType::TicketAttachments,
            attachment,
            None
        ))
        .buffer_unordered(attachments_len)
        .collect::<Vec<_>>()
        .await;

    let mut keys = Vec::with_capacity(attachments_len);
    let mut status = Ok(());

    for result in results {
        match result {
            Ok(file_path) => keys.push(file_path),
            Err(e) => {
                status = Err(e);
            }
        }
    }

    (keys, status)
}

#[tracing::instrument(
    name = "Insert attachments into database",
    skip(transaction)
)]
async fn insert_attachments(
    transaction: &mut Transaction<'_, Postgres>,
    ticket_id: TicketId,
    keys: &[String],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO ticket_attachments (ticket_id, key)
        SELECT * FROM UNNEST(
            $1::BIGINT[],
            $2::VARCHAR(64)[]
        )
        "#,
        &vec![ticket_id; keys.len()],
        &keys
    )
    .execute(transaction.as_mut())
    .await?;

    Ok(())
}

#[tracing::instrument(
    name = "Fetch building name from database",
    skip(pool)
)]
async fn fetch_building_name(
    pool: &PgPool,
    building_id: i16,
) -> Result<String, sqlx::Error> {
    sqlx::query!(
        "
            SELECT name
            FROM buildings
            WHERE id = $1
        ",
        building_id
    )
    .fetch_one(pool)
    .await
    .map(|r| r.name)
}