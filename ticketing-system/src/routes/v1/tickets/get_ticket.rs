use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;

use crate::{schema::tickets::{create_assigned_users, Building, TicketId, TicketPriority, TicketStatus, User}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum GetTicketError {
    #[error("Ticket not found")]
    NotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetTicketError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetTicketError {
    fn status_code(&self) -> StatusCode {
        match self {
            GetTicketError::NotFound => StatusCode::NOT_FOUND,
            GetTicketError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Debug)]
pub struct TicketQueryResult {
    pub id: TicketId,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub assigned_to_id: Option<Vec<i32>>,
    pub assigned_to_name: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub attachments: Option<Vec<String>>,
    pub building_id: i16,
    pub building_code: String,
    pub building_name: String,
    pub note: Option<String>,
    pub cabinet: Option<String>,
}

#[derive(Serialize)]
pub struct TicketSchemaWithAttachments {
    pub id: TicketId,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub assigned_to: Option<Vec<User>>,
    pub created_at: DateTime<Utc>,
    pub attachments: Option<Vec<String>>,
    pub building: Building,
    pub note: Option<String>,
    pub cabinet: Option<String>,
}

impl From<TicketQueryResult> for TicketSchemaWithAttachments {
    fn from(ticket: TicketQueryResult) -> Self {
        let assigned_to = create_assigned_users(ticket.assigned_to_name, ticket.assigned_to_id);

        let building = Building {
            id: ticket.building_id,
            code: ticket.building_code,
            name: ticket.building_name,
        };

        TicketSchemaWithAttachments {
            id: ticket.id,
            title: ticket.title,
            description: ticket.description,
            author: ticket.author,
            author_contacts: ticket.author_contacts,
            status: ticket.status,
            priority: ticket.priority,
            planned_at: ticket.planned_at,
            created_at: ticket.created_at,
            assigned_to,
            attachments: ticket.attachments,
            building,
            note: ticket.note,
            cabinet: ticket.cabinet,
        }
    }
}

pub async fn get_ticket(
    id: web::Path<TicketId>,
    pool: web::Data<PgPool>
) -> Result<HttpResponse, GetTicketError> {
    let id = id.into_inner();

    let ticket = select_ticket(&pool, id).await
        .context("Failed to get ticket by id")?
        .ok_or(GetTicketError::NotFound)?;

    Ok(HttpResponse::Ok().json(TicketSchemaWithAttachments::from(ticket)))
}

#[tracing::instrument(
    name = "Get tickets from database",
    skip(pool)
)]
async fn select_ticket(
    pool: &PgPool,
    id: TicketId,
) -> Result<Option<TicketQueryResult>, sqlx::Error> {
    sqlx::query_as!(
        TicketQueryResult,
        r#"
        SELECT 
            t.id,
            title,
            description,
            author,
            author_contacts,
            t.status,
            priority,
            planned_at,
            ARRAY_AGG(DISTINCT u.id) FILTER (WHERE u.id IS NOT NULL) as assigned_to_id,
            ARRAY_AGG(DISTINCT u.name) FILTER (WHERE u.name IS NOT NULL) as assigned_to_name,
            t.created_at,
            ARRAY_AGG(DISTINCT ta.key) FILTER (WHERE ta.key IS NOT NULL) as attachments,
            b.id as "building_id",
            b.code as "building_code",
            b.name as "building_name",
            note,
            cabinet
        FROM tickets t
        LEFT JOIN tickets_users tu ON tu.ticket_id = t.id 
        LEFT JOIN users u ON u.id = tu.assigned_to
        LEFT JOIN ticket_attachments ta ON ta.ticket_id = t.id
        JOIN buildings b ON b.id = t.building_id
        WHERE t.id = $1
        GROUP BY t.id, b.id
        "#,
        id
    )
    .fetch_optional(pool)
    .await
}