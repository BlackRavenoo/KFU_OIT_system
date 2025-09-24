use actix_multipart::form::{bytes::Bytes, json::Json, MultipartForm};
use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use chrono::{DateTime, Utc};
use futures_util::{stream, StreamExt as _};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{domain::description::Description, services::image::{ImageService, ImageType}, utils::{cleanup_images, error_chain_fmt}};

#[derive(Deserialize)]
pub struct CreateTicketSchema {
    pub title: String,
    pub description: Description,
    pub author: String,
    pub author_contacts: String,
    pub planned_at: Option<DateTime<Utc>>,
    pub cabinet: Option<String>,
    pub building_id: i16,
}

#[derive(MultipartForm)]
pub struct CreateTicketForm {
    pub fields: Json<CreateTicketSchema>,
    pub attachments: Vec<Bytes>,
}

#[derive(thiserror::Error)]
pub enum CreateTicketError {
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
            CreateTicketError::ALotOfAttachments => StatusCode::BAD_REQUEST,
            CreateTicketError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn create_ticket(
    MultipartForm(ticket): MultipartForm<CreateTicketForm>,
    pool: web::Data<PgPool>,
    image_service: web::Data<ImageService>
) -> Result<HttpResponse, CreateTicketError> {
    if ticket.attachments.len() > 5 {
        return Err(CreateTicketError::ALotOfAttachments)
    }

    let fields = ticket.fields;

    let mut transaction = pool.begin().await
        .context("Failed to begin transaction")?;

    let ticket_id = sqlx::query!(
        r#"
        INSERT INTO tickets(title, description, author, author_contacts, planned_at, cabinet, building_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
        fields.title,
        fields.description.as_ref(),
        fields.author,
        fields.author_contacts,
        fields.planned_at,
        fields.cabinet,
        fields.building_id,
    )
    .fetch_one(&mut *transaction)
    .await
    .context("Failed to create ticket")?
    .id;

    let attachments_len = ticket.attachments.len();

    if attachments_len != 0 {
        let results = stream::iter(ticket.attachments)
            .map(|attachment| image_service.upload_image(ImageType::Attachments, attachment.data))
            .buffer_unordered(attachments_len)
            .collect::<Vec<_>>()
            .await;
    
        let mut keys = Vec::with_capacity(attachments_len);
        let mut has_error = false;
    
        for result in results {
            match result {
                Ok(file_path) => keys.push(file_path),
                Err(_) => {
                    has_error = true;
                }
            }
        }
    
        if has_error && !keys.is_empty() {
            cleanup_images(image_service.into_inner(), keys, 30, ImageType::Attachments).await;
            // TODO: Better error handling
            return Ok(HttpResponse::InternalServerError().finish())
        }
        
        if let Err(e) = sqlx::query!(
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
        .execute(&mut *transaction)
        .await
        .context("Failed to insert data into ticket_attachments") {
            if !keys.is_empty() {
                cleanup_images(image_service.into_inner(), keys, 30, ImageType::Attachments).await;
            }

            return Err(CreateTicketError::Unexpected(e));
        }
    }


    transaction.commit().await
        .context("Failed to commit transaction")?;

    Ok(HttpResponse::Created().finish())
}