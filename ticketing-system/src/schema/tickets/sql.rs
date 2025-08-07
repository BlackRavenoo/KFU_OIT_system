use chrono::{DateTime, Utc};
use sqlx::{FromRow, Row as _};

use crate::schema::tickets::{create_assigned_users, Building, TicketId, TicketPriority, TicketStatus, User};

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

pub struct TicketWithMeta {
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
    pub total_items: i64,
    pub building: Building,
    pub cabinet: Option<String>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for TicketWithMeta {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        let assigned_to = create_assigned_users(
            row.try_get("assigned_to_name")?,
            row.try_get("assigned_to_id")?
        );

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
            total_items: row.try_get("total_items")?,
            building: Building {
                id: row.try_get("building_id")?,
                code: row.try_get("building_code")?,
                name: row.try_get("building_name")?
            },
            cabinet: row.try_get("cabinet")?
        })
    }
}