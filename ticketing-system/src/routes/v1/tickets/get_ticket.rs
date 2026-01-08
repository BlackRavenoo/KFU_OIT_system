use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, types::Json};

use crate::{auth::{extractor::{UserIdExtractor, UserRoleExtractor}, types::UserRole}, schema::{common::UserId, tickets::{Building, Department, TicketId, TicketPriority, TicketSource, TicketStatus}}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum GetTicketError {
    #[error("Insufficient permissions to get this ticket")]
    InsufficientPermissions,
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
            GetTicketError::InsufficientPermissions => StatusCode::FORBIDDEN,
            GetTicketError::NotFound => StatusCode::NOT_FOUND,
            GetTicketError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Debug)]
struct TicketQueryResult {
    pub id: TicketId,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub assigned_to: Json<Vec<User>>,
    pub created_at: DateTime<Utc>,
    pub attachments: Option<Vec<String>>,
    pub building: Json<Building>,
    pub cabinet: Option<String>,
    pub department: Json<Department>,
    pub source: TicketSource,
    pub author_id: Option<UserId>,
}

#[derive(Serialize)]
struct TicketSchemaWithAttachments {
    pub id: TicketId,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub assigned_to: Vec<User>,
    pub created_at: DateTime<Utc>,
    pub attachments: Option<Vec<String>>,
    pub building: Building,
    pub cabinet: Option<String>,
    pub department: Department,
    pub source: TicketSource,
}

#[derive(Deserialize, Serialize, Debug)]
struct User {
    pub id: UserId,
    pub name: String,
    pub avatar_key: Option<String>,
}

impl From<TicketQueryResult> for TicketSchemaWithAttachments {
    fn from(ticket: TicketQueryResult) -> Self {
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
            assigned_to: ticket.assigned_to.0,
            attachments: ticket.attachments,
            building: ticket.building.0,
            cabinet: ticket.cabinet,
            department: ticket.department.0,
            source: ticket.source,
        }
    }
}

pub async fn get_ticket(
    id: web::Path<TicketId>,
    user_id: UserIdExtractor,
    user_role: UserRoleExtractor,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, GetTicketError> {
    let id = id.into_inner();

    let ticket = select_ticket(&pool, id).await
        .context("Failed to get ticket by id")?
        .ok_or(GetTicketError::NotFound)?;

    if user_role.0 == UserRole::Client 
        && ticket.author_id.is_none_or(|id| id != user_id.0) 
    {
        return Err(GetTicketError::InsufficientPermissions);
    }

    Ok(HttpResponse::Ok().json(TicketSchemaWithAttachments::from(ticket)))
}

#[tracing::instrument(
    name = "Get ticket from database",
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
            source,
            t.author_id,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', u.id,
                        'name', u.name,
                        'avatar_key', u.avatar_key
                    )
                ) FILTER (WHERE u.id IS NOT NULL),
                '[]'::json
            ) as "assigned_to!: Json<Vec<User>>",
            t.created_at,
            ARRAY_AGG(DISTINCT ta.key) FILTER (WHERE ta.key IS NOT NULL) as attachments,
            JSON_BUILD_OBJECT(
                'id', b.id,
                'code', b.code,
                'name', b.name
            ) as "building!: Json<Building>",
            cabinet,
            JSON_BUILD_OBJECT(
                'id', d.id,
                'name', d.name
            ) as "department!: Json<Department>"
        FROM tickets t
        LEFT JOIN tickets_users tu ON tu.ticket_id = t.id 
        LEFT JOIN users u ON u.id = tu.assigned_to
        LEFT JOIN ticket_attachments ta ON ta.ticket_id = t.id
        JOIN buildings b ON b.id = t.building_id
        JOIN departments d ON d.id = t.department_id
        WHERE t.id = $1
        GROUP BY t.id, b.id, d.id
        "#,
        id
    )
    .fetch_optional(pool)
    .await
}