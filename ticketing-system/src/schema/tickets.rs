use chrono::{DateTime, Utc};
use num_enum::FromPrimitive;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type, Row};

use crate::schema::common::SortOrder;

// Common

#[derive(Serialize, Deserialize, Type, FromPrimitive)]
#[repr(i16)]
pub enum TicketStatus {
    #[default]
    Open = 0,
    Closed = 1,
    InProgress = 2,
    Cancelled = 3
}

#[derive(Serialize, Deserialize, Type, FromPrimitive)]
#[repr(i16)]
pub enum TicketPriority {
    #[default]
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3
}

#[derive(Deserialize, Clone, Copy)]
pub enum OrderBy {
    Id = 0,
    PlannedAt = 1,
    Priority = 2,
}

impl OrderBy {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderBy::Id => "По айди",
            OrderBy::PlannedAt => "По запланированному времени",
            OrderBy::Priority => "По приоритету",
        }
    }
}

impl Serialize for OrderBy {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer
    {
        serde_json::json!({
            "name": self.as_str(),
            "id": *self as i16
        }).serialize(serializer)
    }
}

// Input

#[derive(Deserialize)]
pub struct CreateTicketSchema {
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub planned_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct UpdateTicketSchema {
    pub id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub author_contacts: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Deserialize)]
pub struct GetTicketsSchema {
    pub statuses: Option<Vec<TicketStatus>>,
    pub priorities: Option<Vec<TicketPriority>>,
    pub planned_from: Option<DateTime<Utc>>,
    pub planned_to: Option<DateTime<Utc>>,
    pub order_by: OrderBy,
    pub sort_order: SortOrder,
}

// Output

#[derive(Serialize)]
pub struct User {
    pub id: i32,
    pub name: String,
}

#[derive(Serialize)]
pub struct TicketSchema {
    pub id: i64,
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

impl FromRow<'_, sqlx::postgres::PgRow> for TicketSchema {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        let (name, id) = (row.try_get("name")?, row.try_get("id")?);
        let assigned_to = if let (Some(name), Some(id)) = (name, id) {
            Some(User {
                id,
                name,
            })
        } else {
            None
        };

        Ok(Self {
            id: row.try_get("id")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            author: row.try_get("author")?,
            author_contacts: row.try_get("author_contacts")?,
            status: row.try_get("status")?,
            priority: row.try_get("priority")?,
            planned_at: row.try_get("planned_at")?,
            assigned_to,
            created_at: row.try_get("created_at")?,
        })
    }
}

impl From<TicketQueryResult> for TicketSchema {
    fn from(ticket: TicketQueryResult) -> Self {
        let assigned_to = if let (Some(name), Some(id)) = (
            ticket.assigned_to_name,
            ticket.assigned_to_id,
        ) {
            Some(User {
                id,
                name,
            })
        } else {
            None
        };

        TicketSchema {
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
        }
    }
}

// sqlx

pub struct TicketQueryResult {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub assigned_to_id: Option<i32>,
    pub assigned_to_name: Option<String>,
    pub created_at: DateTime<Utc>,
}