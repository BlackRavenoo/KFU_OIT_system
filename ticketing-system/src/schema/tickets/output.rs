use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::schema::{common::UserId, tickets::{TicketId, TicketPriority, TicketQueryResult, TicketStatus}};

#[derive(Serialize)]
pub struct User {
    pub id: UserId,
    pub name: String,
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

pub fn create_assigned_users(names: Option<Vec<String>>, ids: Option<Vec<UserId>>) -> Option<Vec<User>> {
    if let (Some(names), Some(ids)) = (names, ids) {
        Some(
            names.into_iter()
                .zip(ids)
                .map(|(name, id)| User {
                    id,
                    name,
                })
                .collect()
        )
    } else {
        None
    }
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

#[derive(Serialize)]
pub struct Building {
    pub id: i16,
    pub code: String,
    pub name: String,
}