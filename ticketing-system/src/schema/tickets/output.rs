use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::schema::{common::UserId, tickets::{TicketId, TicketPriority, TicketStatus, TicketQueryResult}};

#[derive(Serialize)]
pub struct User {
    pub id: UserId,
    pub name: String,
}

#[derive(Serialize)]
pub struct TicketSchema {
    pub id: TicketId,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub assigned_to: Option<User>,
    pub created_at: DateTime<Utc>,
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
    pub assigned_to: Option<User>,
    pub created_at: DateTime<Utc>,
    pub attachments: Option<Vec<String>>,
}

fn create_assigned_user(name: Option<String>, id: Option<UserId>) -> Option<User> {
    if let (Some(name), Some(id)) = (name, id) {
        Some(User { id, name })
    } else {
        None
    }
}

impl From<TicketQueryResult> for TicketSchemaWithAttachments {
    fn from(ticket: TicketQueryResult) -> Self {
        let assigned_to = create_assigned_user(ticket.assigned_to_name, ticket.assigned_to_id);

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
            attachments: ticket.attachments
        }
    }
}