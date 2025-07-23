use chrono::{DateTime, Utc};
use num_enum::FromPrimitive;
use serde::{Deserialize, Serialize};
use sqlx::Type;

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

// Output

#[derive(Serialize)]
pub struct User {
    pub id: i32,
    pub name: String,
}

#[derive(Serialize, Type, FromPrimitive)]
#[repr(i16)]
pub enum TicketStatus {
    #[default]
    Open = 0,
    Closed = 1,
    InProgress = 2,
    Cancelled = 3
}

#[derive(Serialize, Type, FromPrimitive)]
#[repr(i16)]
pub enum TicketPriority {
    #[default]
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3
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